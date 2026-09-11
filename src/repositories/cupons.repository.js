import { db } from '../database/connection.js';

/**
 * REPOSITORY de CUPONS de desconto.
 * Código é gravado e consultado SEMPRE em maiúsculas (MONSTER10), para o cliente
 * poder digitar "monster10" sem drama.
 */
function mapear(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    codigo: linha.codigo,
    percentual: linha.percentual,
    valorMinimoCentavos: linha.valor_minimo,
    usosMaximos: linha.usos_maximos,
    usos: linha.usos,
    validoAte: linha.valido_ate,
    ativo: Boolean(linha.ativo),
    criadoEm: linha.criado_em,
  };
}

export function criar({ codigo, percentual, valorMinimoCentavos, usosMaximos, validoAte }) {
  const resultado = db
    .prepare(`
      INSERT INTO cupons (codigo, percentual, valor_minimo, usos_maximos, valido_ate, ativo)
      VALUES (?, ?, ?, ?, ?, 1)
    `)
    .run(codigo, percentual, valorMinimoCentavos, usosMaximos, validoAte);

  return buscarPorId(resultado.lastInsertRowid);
}

export function buscarPorId(id) {
  return mapear(db.prepare('SELECT * FROM cupons WHERE id = ?').get(id));
}

export function buscarPorCodigo(codigo) {
  return mapear(db.prepare('SELECT * FROM cupons WHERE codigo = ?').get(String(codigo ?? '').toUpperCase()));
}

export function listar({ somenteAtivos = false } = {}) {
  const onde = somenteAtivos ? 'WHERE ativo = 1' : '';
  return db.prepare(`SELECT * FROM cupons ${onde} ORDER BY ativo DESC, id DESC`).all().map(mapear);
}

export function atualizar(id, { percentual, valorMinimoCentavos, usosMaximos, validoAte, ativo }) {
  db.prepare(`
    UPDATE cupons
       SET percentual = ?, valor_minimo = ?, usos_maximos = ?, valido_ate = ?, ativo = ?,
           atualizado_em = datetime('now')
     WHERE id = ?
  `).run(percentual, valorMinimoCentavos, usosMaximos, validoAte, ativo ? 1 : 0, id);

  return buscarPorId(id);
}

export function registrarUso(id) {
  db.prepare('UPDATE cupons SET usos = usos + 1 WHERE id = ?').run(id);
  return buscarPorId(id);
}

export function excluir(id) {
  db.prepare('DELETE FROM cupons WHERE id = ?').run(id);
}
