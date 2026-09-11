import * as pedidosService from '../services/pedidos.service.js';
import * as auditoria from '../services/auditoria.service.js';

/**
 * Pedidos e pagamento.
 * Permissões: o CLIENTE cuida dos próprios pedidos; o ADMIN enxerga todos.
 */

export function criar(req, res) {
  const pedido = pedidosService.criarPedido(req.usuario, req.body ?? {});
  const totalFormatado = pedido.total.toFixed(2).replace('.', ',');

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'pedido',
    entidade: 'pedido',
    entidadeId: pedido.id,
    detalhe: `${pedido.codigo}: ${pedido.itens.length} item(ns), total R$ ${totalFormatado}`,
  });

  return res.status(201).json({
    mensagem: `Pedido ${pedido.codigo} criado! Total: R$ ${totalFormatado}. Escolha a forma de pagamento para concluir.`,
    pedido,
  });
}

export function listarMeus(req, res) {
  return res.json({ pedidos: pedidosService.listarMeusPedidos(req.usuario) });
}

export function buscar(req, res) {
  return res.json({ pedido: pedidosService.buscarPedido(req.usuario, req.params.id) });
}

/** 💳 O botão de pagamento (simulado): formaliza a compra e vira receita. */
export function pagar(req, res) {
  const pedido = pedidosService.pagarPedido(req.usuario, req.params.id, req.body ?? {});
  const totalFormatado = pedido.total.toFixed(2).replace('.', ',');

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'pagamento',
    entidade: 'pedido',
    entidadeId: pedido.id,
    detalhe: `${pedido.codigo}: R$ ${totalFormatado} pago em ${pedido.formaPagamentoLabel}`,
  });

  return res.json({
    mensagem: `Pagamento confirmado! Pedido ${pedido.codigo} pago com ${pedido.formaPagamentoLabel}. Obrigado! 🍔`,
    pedido,
  });
}

/* ----------------------------- área admin ----------------------------- */

/** FASE 6: a loja avança o pedido (pago → em preparo → pronto → saiu → entregue). */
export function avancarStatus(req, res) {
  const pedido = pedidosService.avancarStatus(req.usuario, req.params.id, req.body?.status);

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'status',
    entidade: 'pedido',
    entidadeId: pedido.id,
    detalhe: `${pedido.codigo} agora está como "${pedido.statusLabel}"`,
  });

  return res.json({ mensagem: `Pedido ${pedido.codigo}: ${pedido.statusLabel}.`, pedido });
}

export function listarTodos(req, res) {
  const status = req.query.status;
  const limite = Number(req.query.limite) || 50;

  return res.json({
    pedidos: pedidosService.listarTodosPedidos({ status, limite }),
    resumo: pedidosService.resumoVendas(),
    status: pedidosService.STATUS,
    proximosStatus: pedidosService.PROXIMOS_STATUS,
    etapas: pedidosService.ETAPAS_ACOMPANHAMENTO,
  });
}

export function listarFormasPagamento(req, res) {
  return res.json({ formas: pedidosService.FORMAS_PAGAMENTO, status: pedidosService.STATUS });
}
