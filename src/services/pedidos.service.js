import * as pedidosRepo from '../repositories/pedidos.repository.js';
import * as produtosRepo from '../repositories/produtos.repository.js';
import { centavosParaReais, reaisParaCentavos } from '../utils/moeda.js';
import { limitarTexto } from '../utils/texto.js';
import { ErroNaoEncontrado, ErroProibido, ErroValidacao, ErroConflito } from '../utils/errors.js';

/**
 * FASE 5 — PEDIDOS, CHECKOUT E PAGAMENTO (simulado).
 *
 * Decisões que estão neste arquivo:
 *  * PREÇO CONGELADO: o item do pedido guarda o nome e o preço do momento da
 *    compra. Reajuste amanhã não reescreve o que o cliente já fechou.
 *  * DADOS DE ENTREGA OBRIGATÓRIOS: telefone e endereço são exigidos para
 *    fechar o pedido (é aqui que eles são "recolhidos", como combinado).
 *  * ESTOQUE DE BEBIDA: validado na criação e BAIXADO quando o pagamento é
 *    confirmado.
 *  * PAGAMENTO SIMULADO: nenhum dado de cartão, só o botão "confirmar
 *    pagamento" — a loja é de teste.
 */
export const STATUS = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  pronto: 'Pronto',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const FORMAS_PAGAMENTO = {
  pix: 'PIX',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  dinheiro: 'Dinheiro',
  na_entrega: 'Pagar na entrega',
};

const LIMITE_LINHAS = 40;
const LIMITE_QUANTIDADE_POR_ITEM = 50;

function paraPublico(pedido) {
  return {
    id: pedido.id,
    codigo: `#${String(pedido.id).padStart(4, '0')}`,
    cliente: { id: pedido.usuarioId, codigo: pedido.clienteCodigo, nome: pedido.clienteNome },
    status: pedido.status,
    statusLabel: STATUS[pedido.status] ?? pedido.status,
    formaPagamento: pedido.formaPagamento,
    formaPagamentoLabel: pedido.formaPagamento ? FORMAS_PAGAMENTO[pedido.formaPagamento] : null,
    precisaTroco: pedido.precisaTroco,
    trocoPara: centavosParaReais(pedido.trocoParaCentavos),
    subtotal: centavosParaReais(pedido.subtotalCentavos),
    desconto: centavosParaReais(pedido.descontoCentavos),
    total: centavosParaReais(pedido.totalCentavos),
    observacao: pedido.observacao,
    criadoEm: pedido.criadoEm,
    pagoEm: pedido.pagoEm,
    itens: pedido.itens.map((item) => ({
      produtoId: item.produtoId,
      nome: item.nome,
      tipo: item.tipo,
      quantidade: item.quantidade,
      precoUnitario: centavosParaReais(item.precoUnitarioCentavos),
      subtotal: centavosParaReais(item.subtotalCentavos),
    })),
  };
}

/**
 * Junta linhas repetidas do mesmo produto.
 * Por quê? Se o carrinho mandar "2 refrigerantes" em duas linhas, a validação de
 * estoque seria checada duas vezes com metade da quantidade — e o cliente poderia
 * comprar mais do que tem. Consolidar ANTES de validar fecha esse buraco.
 */
function consolidarItens(itensBrutos) {
  const porProduto = new Map();

  for (const item of itensBrutos) {
    const produtoId = Number(item?.produtoId);
    const quantidade = Number(item?.quantidade);

    if (!Number.isInteger(produtoId) || produtoId <= 0) {
      throw new ErroValidacao('Item do pedido com produto inválido.');
    }
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new ErroValidacao('A quantidade de cada item precisa ser um número inteiro maior que zero.');
    }
    if (quantidade > LIMITE_QUANTIDADE_POR_ITEM) {
      throw new ErroValidacao(`Quantidade máxima por item: ${LIMITE_QUANTIDADE_POR_ITEM}.`);
    }

    porProduto.set(produtoId, (porProduto.get(produtoId) ?? 0) + quantidade);
  }

  return [...porProduto.entries()].map(([produtoId, quantidade]) => ({ produtoId, quantidade }));
}

export function criarPedido(usuario, dados) {
  const itensBrutos = Array.isArray(dados?.itens) ? dados.itens : null;

  if (!itensBrutos || itensBrutos.length === 0) {
    throw new ErroValidacao('Seu carrinho está vazio — escolha algum item do cardápio.');
  }
  if (itensBrutos.length > LIMITE_LINHAS) {
    throw new ErroValidacao(`Pedido com itens demais (máximo ${LIMITE_LINHAS} linhas).`);
  }

  // É AQUI que telefone e endereço são "recolhidos" para a entrega.
  const faltando = [];
  if (!usuario.telefone) faltando.push('telefone');
  if (!usuario.endereco) faltando.push('endereço');

  if (faltando.length > 0) {
    throw new ErroValidacao(
      `Complete seu ${faltando.join(' e ')} em "Minha conta" antes de fechar o pedido (é para onde a entrega vai).`,
    );
  }

  const itens = consolidarItens(itensBrutos).map((item) => {
    const produto = produtosRepo.buscarPorId(item.produtoId);

    if (!produto) throw new ErroNaoEncontrado(`Produto ${item.produtoId} não encontrado.`);
    if (!produto.ativo) throw new ErroConflito(`"${produto.nome}" saiu do cardápio. Remova do carrinho para continuar.`);

    if (produto.tipo === 'bebida' && produto.estoque < item.quantidade) {
      throw new ErroConflito(
        `Temos apenas ${produto.estoque} unidade(s) de "${produto.nome}" em estoque. Ajuste a quantidade.`,
      );
    }

    return {
      produtoId: produto.id,
      nomeProduto: produto.nome,               // CONGELADO
      tipo: produto.tipo,
      quantidade: item.quantidade,
      precoUnitarioCentavos: produto.precoVendaCentavos, // CONGELADO
    };
  });

  const subtotalCentavos = itens.reduce((soma, item) => soma + item.precoUnitarioCentavos * item.quantidade, 0);
  const descontoCentavos = 0; // Fase 7 (cupons) entra aqui

  const pedido = pedidosRepo.criar({
    usuarioId: usuario.id,
    itens,
    subtotalCentavos,
    descontoCentavos,
    totalCentavos: subtotalCentavos - descontoCentavos,
    observacao: limitarTexto(dados?.observacao, 200) || null,
  });

  return paraPublico(pedido);
}

export function buscarPedido(usuario, id) {
  const pedido = pedidosRepo.buscarPorId(Number(id));
  if (!pedido) throw new ErroNaoEncontrado('Pedido não encontrado.');

  // Cliente só vê o PRÓPRIO pedido (admin vê todos).
  const ehDono = pedido.usuarioId === usuario.id;
  if (!ehDono && usuario.papel !== 'admin') {
    throw new ErroProibido('Este pedido não é seu.');
  }

  return paraPublico(pedido);
}

export function listarMeusPedidos(usuario) {
  return pedidosRepo.listarPorUsuario(usuario.id).map(paraPublico);
}

export function listarTodosPedidos({ status, limite = 50 } = {}) {
  if (status && !STATUS[status]) {
    throw new ErroValidacao('Status inválido para filtro.');
  }

  return pedidosRepo.listarTodos({ status, limite }).map(paraPublico);
}

/**
 * PAGAMENTO SIMULADO: não existe cartão, PIX real nem gateway.
 * O botão apenas formaliza a compra — e é aqui que:
 *   * o pedido vira 'pago' (e passa a contar como receita)
 *   * o estoque das bebidas é baixado
 */
export function pagarPedido(usuario, id, dados) {
  const pedido = pedidosRepo.buscarPorId(Number(id));
  if (!pedido) throw new ErroNaoEncontrado('Pedido não encontrado.');

  if (pedido.usuarioId !== usuario.id) {
    throw new ErroProibido('Este pedido não é seu.');
  }

  if (pedido.status !== 'aguardando_pagamento') {
    throw new ErroValidacao(`Este pedido já está como "${STATUS[pedido.status] ?? pedido.status}".`);
  }

  const formaPagamento = dados?.formaPagamento;
  if (!Object.keys(FORMAS_PAGAMENTO).includes(formaPagamento)) {
    throw new ErroValidacao('Escolha uma forma de pagamento: PIX, crédito, débito, dinheiro ou na entrega.');
  }

  let precisaTroco = false;
  let trocoParaCentavos = null;

  if (formaPagamento === 'dinheiro' && dados?.precisaTroco) {
    trocoParaCentavos = reaisParaCentavos(dados?.trocoPara);

    if (!Number.isInteger(trocoParaCentavos) || trocoParaCentavos <= 0) {
      throw new ErroValidacao('Informe para quanto você precisa de troco (ex.: 50,00).');
    }
    if (trocoParaCentavos < pedido.totalCentavos) {
      throw new ErroValidacao('O valor para troco não pode ser menor que o total do pedido.');
    }

    precisaTroco = true;
  }

  // Baixa de estoque das bebidas (lanche não tem estoque: é produzido na hora).
  for (const item of pedido.itens) {
    if (item.tipo === 'bebida' && item.produtoId) {
      produtosRepo.ajustarEstoque(item.produtoId, -item.quantidade);
    }
  }

  const pago = pedidosRepo.marcarPago(pedido.id, { formaPagamento, precisaTroco, trocoParaCentavos });

  return paraPublico(pago);
}

export function resumoVendas() {
  const resumo = pedidosRepo.resumo();

  return {
    receitaTotal: centavosParaReais(resumo.receitaTotalCentavos),
    pedidosPagos: resumo.pedidosPagos,
    receitaDoMes: centavosParaReais(resumo.receitaMesCentavos),
    pedidosPagosMes: resumo.pedidosPagosMes,
    aguardandoPagamento: resumo.aguardandoPagamento,
  };
}
