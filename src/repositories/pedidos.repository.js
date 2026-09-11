import { db } from '../database/connection.js';

/**
 * REPOSITORY de PEDIDOS (Fase 5).
 * Dinheiro em CENTAVOS; nome e preço do produto ficam CONGELADOS no item.
 */
function mapearPedido(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    usuarioId: linha.usuario_id,
    clienteCodigo: `#${String(linha.usuario_id).padStart(4, '0')}`,
    clienteNome: linha.cliente_nome ?? null,
    status: linha.status,
    formaPagamento: linha.forma_pagamento,
    precisaTroco: Boolean(linha.precisa_troco),
    trocoParaCentavos: linha.troco_para,
    subtotalCentavos: linha.subtotal,
    descontoCentavos: linha.desconto,
    cupomCodigo: linha.cupom_codigo,
    cupomPercentual: linha.cupom_percentual,
    totalCentavos: linha.total,
    observacao: linha.observacao,
    criadoEm: linha.criado_em,
    pagoEm: linha.pago_em,
  };
}

function mapearItem(linha) {
  return {
    id: linha.id,
    produtoId: linha.produto_id,
    nome: linha.nome_produto,
    tipo: linha.tipo,
    quantidade: linha.quantidade,
    precoUnitarioCentavos: linha.preco_unitario,
    // Preço "de" (antes da promoção). Igual ao unitário quando não houve promoção.
    precoOriginalCentavos: linha.preco_original ?? linha.preco_unitario,
    subtotalCentavos: linha.subtotal,
    mascote: linha.mascote ?? null,
  };
}

const SELECT_PEDIDO = `
  SELECT p.*, u.nome AS cliente_nome
    FROM pedidos p
    LEFT JOIN usuarios u ON u.id = p.usuario_id
`;

/**
 * Itens do pedido com a arte do produto (LEFT JOIN).
 * O nome e o preço são cópias gravadas no pedido (preço congelado), mas a ARTE
 * vem do produto atual: se o dono trocar o mascote, os pedidos antigos acompanham
 * — é enfeite de tela, não valor cobrado.
 */
export function listarItens(pedidoId) {
  return db
    .prepare(`
      SELECT pi.*, p.mascote AS mascote
        FROM pedido_itens pi
        LEFT JOIN produtos p ON p.id = pi.produto_id
       WHERE pi.pedido_id = ?
       ORDER BY pi.id
    `)
    .all(pedidoId)
    .map(mapearItem);
}

export function buscarPorId(id) {
  const pedido = mapearPedido(db.prepare(`${SELECT_PEDIDO} WHERE p.id = ?`).get(id));
  if (!pedido) return null;

  return { ...pedido, itens: listarItens(pedido.id) };
}

/**
 * Cria o pedido E os itens numa ÚNICA transação.
 * Por quê? Pedido sem itens (ou item sem pedido) é dado corrompido. Ou grava
 * tudo, ou não grava nada.
 */
export function criar({
  usuarioId,
  itens,
  subtotalCentavos,
  totalCentavos,
  descontoCentavos = 0,
  cupomCodigo = null,
  cupomPercentual = null,
  observacao = null,
}) {
  const inserirPedido = db.prepare(`
    INSERT INTO pedidos (usuario_id, status, subtotal, desconto, cupom_codigo, cupom_percentual, total, observacao)
    VALUES (?, 'aguardando_pagamento', ?, ?, ?, ?, ?, ?)
  `);

  const inserirItem = db.prepare(`
    INSERT INTO pedido_itens (pedido_id, produto_id, nome_produto, tipo, quantidade, preco_unitario, preco_original, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transacao = db.transaction(() => {
    const resultado = inserirPedido.run(
      usuarioId,
      subtotalCentavos,
      descontoCentavos,
      cupomCodigo,
      cupomPercentual,
      totalCentavos,
      observacao,
    );
    const pedidoId = resultado.lastInsertRowid;

    for (const item of itens) {
      inserirItem.run(
        pedidoId,
        item.produtoId,
        item.nomeProduto,
        item.tipo,
        item.quantidade,
        item.precoUnitarioCentavos,
        item.precoOriginalCentavos ?? item.precoUnitarioCentavos,
        item.precoUnitarioCentavos * item.quantidade,
      );
    }

    return pedidoId;
  });

  return buscarPorId(transacao());
}

export function listarPorUsuario(usuarioId) {
  return db
    .prepare(`${SELECT_PEDIDO} WHERE p.usuario_id = ? ORDER BY p.id DESC LIMIT 30`)
    .all(usuarioId)
    .map((linha) => ({ ...mapearPedido(linha), itens: listarItens(linha.id) }));
}

export function listarTodos({ status, limite = 50 } = {}) {
  const condicoes = [];
  const parametros = [];

  if (status) {
    condicoes.push('p.status = ?');
    parametros.push(status);
  }

  const onde = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
  parametros.push(limite);

  return db
    .prepare(`${SELECT_PEDIDO} ${onde} ORDER BY p.id DESC LIMIT ?`)
    .all(...parametros)
    .map((linha) => ({ ...mapearPedido(linha), itens: listarItens(linha.id) }));
}

export function marcarPago(id, { formaPagamento, precisaTroco, trocoParaCentavos }) {
  db.prepare(`
    UPDATE pedidos
       SET status = 'pago', forma_pagamento = ?, precisa_troco = ?, troco_para = ?, pago_em = datetime('now')
     WHERE id = ?
  `).run(formaPagamento, precisaTroco ? 1 : 0, trocoParaCentavos, id);

  return buscarPorId(id);
}

/** Usado pela Fase 6 (fluxo de preparo/entrega), já disponível para testes. */
export function atualizarStatus(id, status) {
  db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, id);
  return buscarPorId(id);
}

/** Resumo das vendas (receita) — a Fase 8 usa isso no fluxo de caixa. */
export function resumo() {
  const pago = db
    .prepare("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS quantidade FROM pedidos WHERE status != 'cancelado' AND pago_em IS NOT NULL")
    .get();

  const doMes = db
    .prepare(`
      SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS quantidade
        FROM pedidos
       WHERE status != 'cancelado' AND pago_em IS NOT NULL
         AND strftime('%Y-%m', pago_em) = strftime('%Y-%m', 'now')
    `)
    .get();

  const aguardando = db
    .prepare("SELECT COUNT(*) AS quantidade FROM pedidos WHERE status = 'aguardando_pagamento'")
    .get();

  return {
    receitaTotalCentavos: pago.total,
    pedidosPagos: pago.quantidade,
    receitaMesCentavos: doMes.total,
    pedidosPagosMes: doMes.quantidade,
    aguardandoPagamento: aguardando.quantidade,
  };
}
