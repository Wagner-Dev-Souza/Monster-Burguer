import { db } from '../database/connection.js';

/**
 * REPOSITORY da AUDITORIA (registro de quem fez o quê).
 *
 * Decisão importante: guardamos uma CÓPIA do nome e do papel do usuário no
 * momento da ação (`usuario_nome`, `usuario_papel`), além do id.
 * Por quê? Log de auditoria não pode mudar depois: se amanhã a Maria virar
 * admin (ou mudar de nome), o registro de ontem precisa continuar dizendo que
 * foi a Maria, cliente, quem alterou o preço. Auditoria é fotografia, não espelho.
 */
function mapear(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    usuarioId: linha.usuario_id,
    usuarioCodigo: linha.usuario_id ? `#${String(linha.usuario_id).padStart(4, '0')}` : '-',
    usuarioNome: linha.usuario_nome,
    usuarioPapel: linha.usuario_papel,
    acao: linha.acao,
    entidade: linha.entidade,
    entidadeId: linha.entidade_id,
    detalhe: linha.detalhe,
    criadoEm: linha.criado_em,
  };
}

export function registrar({ usuarioId, usuarioNome, usuarioPapel, acao, entidade, entidadeId = null, detalhe = null }) {
  const resultado = db
    .prepare(`
      INSERT INTO auditoria (usuario_id, usuario_nome, usuario_papel, acao, entidade, entidade_id, detalhe)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(usuarioId ?? null, usuarioNome, usuarioPapel, acao, entidade, entidadeId, detalhe);

  return mapear(db.prepare('SELECT * FROM auditoria WHERE id = ?').get(resultado.lastInsertRowid));
}

export function listar({ limite = 50, entidade } = {}) {
  const parametros = [];
  const onde = entidade ? 'WHERE entidade = ?' : '';

  if (entidade) parametros.push(entidade);
  parametros.push(limite);

  return db
    .prepare(`SELECT * FROM auditoria ${onde} ORDER BY id DESC LIMIT ?`)
    .all(...parametros)
    .map(mapear);
}
