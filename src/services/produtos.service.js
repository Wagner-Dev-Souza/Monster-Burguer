import * as produtosRepo from '../repositories/produtos.repository.js';
import * as ingredientesRepo from '../repositories/ingredientes.repository.js';
import { centavosParaReais, reaisParaCentavos } from '../utils/moeda.js';
import { limitarTexto } from '../utils/texto.js';
import { ErroConflito, ErroNaoEncontrado, ErroValidacao } from '../utils/errors.js';

/**
 * Regras de negócio dos PRODUTOS (lanches e bebidas) e da FICHA TÉCNICA.
 *
 * O cálculo central da Fase 2:
 *   custo do lanche  = soma de (quantidade do ingrediente x custo unitário)
 *   margem (R$)      = preço de venda - custo
 *   margem (%)       = margem / preço de venda * 100
 *
 * Bebida não tem receita: o custo dela é o valor de compra informado (revenda).
 */
const TIPOS = ['lanche', 'bebida'];

/** Calcula a margem a partir de centavos (evita erro de arredondamento). */
export function calcularMargem({ precoVendaCentavos, custoCentavos }) {
  const margemCentavos = precoVendaCentavos - custoCentavos;
  const margemPercentual = precoVendaCentavos > 0
    ? Number(((margemCentavos / precoVendaCentavos) * 100).toFixed(2))
    : null;

  return { margemCentavos, margemPercentual };
}

/** Monta a resposta da API já com custo, margem e (opcionalmente) a ficha técnica. */
function paraPublico(produto, composicao = null) {
  const temFichaTecnica = produto.itensFicha > 0;

  // Bebida: custo vem da compra. Lanche: custo vem da ficha técnica.
  // Math.round garante CENTAVO INTEIRO (a soma no SQL pode trazer fração de
  // centavo por causa da multiplicação com quantidade em REAL).
  const custoCentavos = produto.tipo === 'bebida'
    ? (produto.custoCompraCentavos ?? 0)
    : Math.round(produto.custoFichaCentavos);

  const { margemCentavos, margemPercentual } = calcularMargem({
    precoVendaCentavos: produto.precoVendaCentavos,
    custoCentavos,
  });

  return {
    id: produto.id,
    nome: produto.nome,
    descricao: produto.descricao,
    tipo: produto.tipo,
    precoVenda: centavosParaReais(produto.precoVendaCentavos),
    custoCompra: centavosParaReais(produto.custoCompraCentavos),
    estoque: produto.estoque,
    ativo: produto.ativo,
    custo: centavosParaReais(custoCentavos),
    custoOrigem: produto.tipo === 'bebida' ? 'compra' : 'ficha_tecnica',
    temFichaTecnica,
    // Margem de lanche SEM ficha técnica é ilusória: avisamos o front para não
    // exibir um "100% de margem" que não existe na prática.
    custoConfiavel: produto.tipo === 'bebida' || temFichaTecnica,
    margemValor: centavosParaReais(margemCentavos),
    margemPercentual,
    itensFicha: produto.itensFicha,
    ...(composicao ? { composicao } : {}),
    criadoEm: produto.criadoEm,
  };
}

/** Ficha técnica pronta para exibir (com o custo de cada item e o total). */
function composicaoPublica(produtoId) {
  const itens = produtosRepo.listarComposicao(produtoId);

  const itensPublicos = itens.map((item) => ({
    ingredienteId: item.ingredienteId,
    nome: item.nome,
    unidade: item.unidade,
    custoUnitario: centavosParaReais(item.custoUnitarioCentavos),
    quantidade: item.quantidade,
    custoTotal: centavosParaReais(Math.round(item.quantidade * item.custoUnitarioCentavos)),
    ingredienteAtivo: Boolean(item.ingredienteAtivo),
  }));

  const custoTotalCentavos = itens.reduce(
    (soma, item) => soma + Math.round(item.quantidade * item.custoUnitarioCentavos),
    0,
  );

  return { itens: itensPublicos, custoTotal: centavosParaReais(custoTotalCentavos) };
}

/** Valida e normaliza a entrada de produto. */
function validar(dados) {
  const nome = limitarTexto(dados?.nome, 80);
  if (nome.length < 3) {
    throw new ErroValidacao('Informe o nome do produto (mínimo 3 caracteres).');
  }

  const tipo = dados?.tipo;
  if (!TIPOS.includes(tipo)) {
    throw new ErroValidacao('Tipo inválido. Use "lanche" ou "bebida".');
  }

  const precoVendaCentavos = reaisParaCentavos(dados?.precoVenda);
  if (!Number.isInteger(precoVendaCentavos) || precoVendaCentavos <= 0) {
    throw new ErroValidacao('Preço de venda inválido. Informe um valor em reais (ex.: 15,90).');
  }

  // Bebida: custo vem da compra. Lanche: custo vem da ficha técnica (abaixo).
  let custoCompraCentavos = null;
  if (tipo === 'bebida') {
    custoCompraCentavos = reaisParaCentavos(dados?.custoCompra ?? 0);
    if (!Number.isInteger(custoCompraCentavos) || custoCompraCentavos < 0) {
      throw new ErroValidacao('Custo de compra inválido. Informe quanto você paga por unidade.');
    }
  }

  const estoque = Number(dados?.estoque ?? 0);
  if (!Number.isInteger(estoque) || estoque < 0) {
    throw new ErroValidacao('Estoque inválido. Informe um número inteiro (zero ou mais).');
  }

  return {
    nome,
    descricao: limitarTexto(dados?.descricao, 200) || null,
    tipo,
    precoVendaCentavos,
    custoCompraCentavos,
    estoque,
  };
}

export function listarProdutos({ tipo, incluirInativos = false } = {}) {
  if (tipo && !TIPOS.includes(tipo)) {
    throw new ErroValidacao('Filtro de tipo inválido. Use "lanche" ou "bebida".');
  }

  return produtosRepo.listar({ tipo, incluirInativos }).map((produto) => paraPublico(produto));
}

export function buscarProduto(id) {
  const produto = produtosRepo.buscarPorId(id);
  if (!produto) throw new ErroNaoEncontrado('Produto não encontrado.');

  return paraPublico(produto, composicaoPublica(id));
}

export function criarProduto(dados) {
  const validado = validar(dados);

  if (produtosRepo.buscarPorNomeAtivo(validado.nome)) {
    throw new ErroConflito('Já existe um produto ativo com esse nome.');
  }

  return paraPublico(produtosRepo.criar(validado));
}

export function atualizarProduto(id, dados) {
  const atual = produtosRepo.buscarPorId(id);
  if (!atual) throw new ErroNaoEncontrado('Produto não encontrado.');

  const validado = validar(dados);

  const comMesmoNome = produtosRepo.buscarPorNomeAtivo(validado.nome);
  if (comMesmoNome && comMesmoNome.id !== atual.id) {
    throw new ErroConflito('Já existe um produto ativo com esse nome.');
  }

  return paraPublico(produtosRepo.atualizar(id, validado));
}

/** Desativa o produto (soft delete): sai do cardápio, mas o histórico continua válido. */
export function desativarProduto(id) {
  const atual = produtosRepo.buscarPorId(id);
  if (!atual) throw new ErroNaoEncontrado('Produto não encontrado.');
  if (!atual.ativo) throw new ErroValidacao('Este produto já está desativado.');

  return paraPublico(produtosRepo.desativar(id));
}

/**
 * Define a FICHA TÉCNICA do lanche (substitui a lista inteira).
 *
 * Regras validadas aqui:
 *  * produto precisa ser do tipo 'lanche' (bebida não tem receita)
 *  * quantidade de cada item > 0
 *  * nenhum ingrediente repetido
 *  * ingrediente precisa existir e estar ativo
 */
export function definirComposicao(produtoId, itens) {
  const produto = produtosRepo.buscarPorId(produtoId);
  if (!produto) throw new ErroNaoEncontrado('Produto não encontrado.');

  if (produto.tipo !== 'lanche') {
    throw new ErroValidacao('Só lanches têm ficha técnica. Para bebidas, informe o custo de compra.');
  }

  if (!Array.isArray(itens)) {
    throw new ErroValidacao('Envie a lista de itens da ficha técnica.');
  }

  const jaVistos = new Set();
  const normalizados = itens.map((item) => {
    const ingredienteId = Number(item?.ingredienteId);
    const quantidade = Number(item?.quantidade);

    if (!Number.isInteger(ingredienteId) || ingredienteId <= 0) {
      throw new ErroValidacao('Item da ficha técnica com ingrediente inválido.');
    }
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new ErroValidacao('A quantidade de cada item da ficha técnica precisa ser maior que zero.');
    }
    if (jaVistos.has(ingredienteId)) {
      throw new ErroValidacao('O mesmo ingrediente não pode aparecer duas vezes na ficha técnica.');
    }
    jaVistos.add(ingredienteId);

    const ingrediente = ingredientesRepo.buscarPorId(ingredienteId);
    if (!ingrediente || !ingrediente.ativo) {
      throw new ErroNaoEncontrado(`Ingrediente ${ingredienteId} não encontrado ou desativado.`);
    }

    return { ingredienteId, quantidade };
  });

  produtosRepo.substituirComposicao(produtoId, normalizados);

  return buscarProduto(produtoId); // volta já com o custo/margem recalculados
}
