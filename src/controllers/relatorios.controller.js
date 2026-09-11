import * as relatoriosService from '../services/relatorios.service.js';

/** Relatórios financeiros (Fase 8) — só admin. */

export function caixa(req, res) {
  const fluxo = relatoriosService.fluxoDeCaixa({
    agrupamento: req.query.agrupamento ?? 'dia',
    limite: Number(req.query.limite) || 30,
  });

  return res.json({
    ...fluxo,
    extrato: relatoriosService.extratoDoCaixa({ limite: Number(req.query.extrato) || 15 }).movimentacoes,
  });
}

export function produtos(req, res) {
  return res.json({ produtos: relatoriosService.margemPorProduto() });
}
