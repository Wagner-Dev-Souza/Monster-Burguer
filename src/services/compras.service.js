import * as comprasRepo from '../repositories/compras.repository.js';
import * as ingredientesRepo from '../repositories/ingredientes.repository.js';
import * as produtosRepo from '../repositories/produtos.repository.js';
import { centavosParaReais, reaisParaCentavos } from '../utils/moeda.js';
import { limitarTexto } from '../utils/texto.js';
import { ErroNaoEncontrado, ErroValidacao } from '../utils/errors.js';

/**
 * FASE 3 — COMPRAS (despesas com fornecedores).
 *
 * O que acontece quando o dono registra uma compra:
 *
 *  INGREDIENTE (ex.: 10 kg de carne por R$ 400,00)
 *    -> o CUSTO UNITÁRIO do ingrediente passa a ser a MÉDIA PONDERADA de tudo
 *       que já foi comprado dele: total gasto ÷ total comprado.
 *       Assim o custo do lanche acompanha o preço real do fornecedor, sem o
 *       dono ter que recalcular nada na mão.
 *
 *  PRODUTO/BEBIDA (ex.: 24 latas por R$ 84,00)
 *    -> o ESTOQUE aumenta e o custo de compra também vira média ponderada.
 *
 * Decisão registrada: usamos média ponderada de TODAS as compras (simples e
 * previsível). Uma média móvel por lote exigiria controlar estoque por lote —
 * complexidade que não se paga nesta fase.
 */
export const TIPOS = ['ingrediente', 'produto'];

function paraPublico(compra) {
  return {
    id: compra.id,
    tipo: compra.tipo,
    itemNome: compra.itemNome,
    itemUnidade: compra.itemUnidade,
    ingredienteId: compra.ingredienteId,
    produtoId: compra.produtoId,
    fornecedor: compra.fornecedor,
    quantidade: compra.quantidade,
    valorTotal: centavosParaReais(compra.valorTotalCentavos),
    valorUnitario: centavosParaReais(compra.valorUnitarioCentavos),
    dataCompra: compra.dataCompra,
    observacao: compra.observacao,
    usuarioNome: compra.usuarioNome,
    criadoEm: compra.criadoEm,
  };
}

export function listarCompras({ tipo, limite = 100 } = {}) {
  if (tipo && !TIPOS.includes(tipo)) {
    throw new ErroValidacao('Filtro de tipo inválido. Use "ingrediente" ou "produto".');
  }

  const compras = comprasRepo.listar({ tipo, limite });
  const resumo = comprasRepo.resumo();

  return {
    compras: compras.map(paraPublico),
    resumo: {
      totalDespesas: centavosParaReais(resumo.totalCentavos),
      quantidadeCompras: resumo.quantidadeCompras,
      despesasDoMes: centavosParaReais(resumo.mesCentavos),
      comprasDoMes: resumo.comprasDoMes,
    },
  };
}

/** Recalcula o custo do ingrediente pela média ponderada. Sem compras, mantém o valor atual. */
function recalcularCustoDoIngrediente(ingredienteId) {
  const totais = comprasRepo.somarPorIngrediente(ingredienteId);
  if (totais.quantidade_total <= 0) return null;

  const custoUnitarioCentavos = Math.round(totais.valor_total / totais.quantidade_total);
  ingredientesRepo.atualizarCusto(ingredienteId, custoUnitarioCentavos);

  return custoUnitarioCentavos;
}

function recalcularCustoDoProduto(produtoId) {
  const totais = comprasRepo.somarPorProduto(produtoId);
  if (totais.quantidade_total <= 0) return null;

  const custoCentavos = Math.round(totais.valor_total / totais.quantidade_total);
  produtosRepo.atualizarCustoCompra(produtoId, custoCentavos);

  return custoCentavos;
}

export function registrarCompra(usuario, dados) {
  const tipo = dados?.tipo;
  if (!TIPOS.includes(tipo)) {
    throw new ErroValidacao('Tipo de compra inválido. Use "ingrediente" ou "produto".');
  }

  const quantidade = Number(dados?.quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new ErroValidacao('Informe a quantidade comprada (maior que zero).');
  }

  const valorTotalCentavos = reaisParaCentavos(dados?.valorTotal);
  if (!Number.isInteger(valorTotalCentavos) || valorTotalCentavos <= 0) {
    throw new ErroValidacao('Informe o valor total pago (ex.: 120,00).');
  }

  const fornecedor = limitarTexto(dados?.fornecedor, 80) || null;
  const observacao = limitarTexto(dados?.observacao, 200) || null;
  const dataCompra = limitarTexto(dados?.dataCompra, 10) || null;

  if (dataCompra && !/^\d{4}-\d{2}-\d{2}$/.test(dataCompra)) {
    throw new ErroValidacao('Data inválida. Use o formato AAAA-MM-DD.');
  }

  const base = { fornecedor, quantidade, valorTotalCentavos, dataCompra, observacao, usuarioId: usuario?.id ?? null };

  if (tipo === 'ingrediente') {
    const ingrediente = ingredientesRepo.buscarPorId(Number(dados?.ingredienteId));
    if (!ingrediente) throw new ErroNaoEncontrado('Ingrediente não encontrado.');

    const compra = comprasRepo.criar({ tipo, ingredienteId: ingrediente.id, ...base });
    const novoCusto = recalcularCustoDoIngrediente(ingrediente.id);

    return {
      compra: paraPublico(compra),
      custoUnitarioAtualizado: centavosParaReais(novoCusto ?? ingrediente.custoUnitarioCentavos),
      itemNome: ingrediente.nome,
    };
  }

  // tipo === 'produto' (bebida de revenda)
  const produto = produtosRepo.buscarPorId(Number(dados?.produtoId));
  if (!produto) throw new ErroNaoEncontrado('Produto não encontrado.');

  if (produto.tipo !== 'bebida') {
    throw new ErroValidacao('Compras de produto são para BEBIDAS (revenda). Lanches são produzidos com ingredientes.');
  }

  if (!Number.isInteger(quantidade)) {
    throw new ErroValidacao('Para bebidas, a quantidade precisa ser um número inteiro de unidades.');
  }

  const compra = comprasRepo.criar({ tipo, produtoId: produto.id, ...base });
  const novoCusto = recalcularCustoDoProduto(produto.id);
  const produtoAtualizado = produtosRepo.ajustarEstoque(produto.id, quantidade);

  return {
    compra: paraPublico(compra),
    custoUnitarioAtualizado: centavosParaReais(novoCusto ?? produto.custoCompraCentavos ?? 0),
    estoqueAtualizado: produtoAtualizado.estoque,
    itemNome: produto.nome,
  };
}

/**
 * Exclui uma compra (lançamento errado) e RECALCULA os custos médios.
 * Se era compra de bebida, o estoque é reduzido na mesma quantidade.
 */
export function excluirCompra(id) {
  const compra = comprasRepo.buscarPorId(id);
  if (!compra) throw new ErroNaoEncontrado('Compra não encontrada.');

  comprasRepo.excluir(id);

  if (compra.tipo === 'ingrediente') {
    recalcularCustoDoIngrediente(compra.ingredienteId);
  } else {
    recalcularCustoDoProduto(compra.produtoId);
    produtosRepo.ajustarEstoque(compra.produtoId, -compra.quantidade);
  }

  return paraPublico(compra);
}
