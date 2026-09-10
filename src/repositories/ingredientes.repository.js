import { db } from '../database/connection.js';

/**
 * REPOSITORY de ingredientes (os componentes: pão, carne, queijo, tomate...).
 * Só SQL aqui — regra de negócio mora no service.
 *
 * Valores em CENTAVOS (ver utils/moeda.js).
 */
function mapear(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    nome: linha.nome,
    unidade: linha.unidade,
    custoUnitarioCentavos: linha.custo_unitario,
    ativo: Boolean(linha.ativo),
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

export function criar({ nome, unidade, custoUnitarioCentavos = 0 }) {
  const resultado = db
    .prepare('INSERT INTO ingredientes (nome, unidade, custo_unitario) VALUES (?, ?, ?)')
    .run(nome, unidade, custoUnitarioCentavos);

  return buscarPorId(resultado.lastInsertRowid);
}

export function buscarPorId(id) {
  return mapear(db.prepare('SELECT * FROM ingredientes WHERE id = ?').get(id));
}

export function buscarPorNomeAtivo(nome) {
  return mapear(
    db.prepare('SELECT * FROM ingredientes WHERE nome = ? AND ativo = 1').get(nome),
  );
}

export function listar({ incluirInativos = false } = {}) {
  const sql = incluirInativos
    ? 'SELECT * FROM ingredientes ORDER BY nome COLLATE NOCASE'
    : 'SELECT * FROM ingredientes WHERE ativo = 1 ORDER BY nome COLLATE NOCASE';

  return db.prepare(sql).all().map(mapear);
}

export function atualizar(id, { nome, unidade, custoUnitarioCentavos }) {
  db.prepare(`
    UPDATE ingredientes SET nome = ?, unidade = ?, custo_unitario = ?, atualizado_em = datetime('now')
    WHERE id = ?
  `).run(nome, unidade, custoUnitarioCentavos, id);

  return buscarPorId(id);
}

export function desativar(id) {
  db.prepare("UPDATE ingredientes SET ativo = 0, atualizado_em = datetime('now') WHERE id = ?").run(id);
  return buscarPorId(id);
}

/** Quantos itens de ficha técnica usam este ingrediente (para avisar antes de desativar). */
export function contarUsos(id) {
  return db
    .prepare('SELECT COUNT(*) AS total FROM produto_ingredientes WHERE ingrediente_id = ?')
    .get(id).total;
}
