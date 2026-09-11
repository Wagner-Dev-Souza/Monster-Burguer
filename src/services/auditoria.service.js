import * as auditoriaRepo from '../repositories/auditoria.repository.js';
import { ErroValidacao } from '../utils/errors.js';

/**
 * AUDITORIA — quem fez o quê.
 *
 * Como usar nos controllers: `auditoria.registrar({ usuario: req.usuario, ... })`
 * logo DEPOIS de a operação dar certo (não registramos tentativa que falhou).
 */
export function registrar({ usuario, acao, entidade, entidadeId = null, detalhe = null }) {
  return auditoriaRepo.registrar({
    usuarioId: usuario?.id ?? null,
    usuarioNome: usuario?.nome ?? 'sistema',
    usuarioPapel: usuario?.papel ?? '-',
    acao,
    entidade,
    entidadeId,
    detalhe,
  });
}

export function listarHistorico({ limite = 50, entidade } = {}) {
  const limiteNumerico = Number(limite);
  if (!Number.isInteger(limiteNumerico) || limiteNumerico <= 0 || limiteNumerico > 200) {
    throw new ErroValidacao('Limite inválido: informe um número entre 1 e 200.');
  }

  return auditoriaRepo.listar({ limite: limiteNumerico, entidade });
}
