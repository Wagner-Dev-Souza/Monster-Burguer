import * as auditoriaService from '../services/auditoria.service.js';

/** Histórico de alterações — só admin vê (é o registro de quem fez o quê). */

export function listar(req, res) {
  const historico = auditoriaService.listarHistorico({
    limite: req.query.limite,
    entidade: req.query.entidade,
  });

  return res.json({ historico });
}
