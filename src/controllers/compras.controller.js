import * as comprasService from '../services/compras.service.js';
import * as auditoria from '../services/auditoria.service.js';

/** Compras/despesas — área administrativa. */

export function listar(req, res) {
  return res.json(comprasService.listarCompras({ tipo: req.query.tipo, limite: Number(req.query.limite) || 100 }));
}

export function criar(req, res) {
  const resultado = comprasService.registrarCompra(req.usuario, req.body ?? {});

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'compra',
    entidade: 'compra',
    entidadeId: resultado.compra.id,
    detalhe: `${resultado.itemNome}: ${resultado.compra.quantidade} por R$ ${resultado.compra.valorTotal}` +
      (resultado.fornecedor ? ` (${resultado.fornecedor})` : ''),
  });

  const detalhes = resultado.estoqueAtualizado !== undefined
    ? ` Estoque agora: ${resultado.estoqueAtualizado} unidade(s). Custo de compra: R$ ${resultado.custoUnitarioAtualizado}.`
    : ` Custo unitário atualizado para R$ ${resultado.custoUnitarioAtualizado} (média ponderada das compras).`;

  return res.status(201).json({
    mensagem: `Compra registrada! ${detalhes}`,
    ...resultado,
  });
}

export function excluir(req, res) {
  const compra = comprasService.excluirCompra(Number(req.params.id));

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'excluir',
    entidade: 'compra',
    entidadeId: compra.id,
    detalhe: `${compra.itemNome}: R$ ${compra.valorTotal} (custos recalculados)`,
  });

  return res.json({ mensagem: 'Compra excluída e custos recalculados.', compra });
}
