import { db } from '../database/connection.js';

/**
 * REPOSITORY de PROMOÇÕES (desconto por produto).
 * Datas em AAAA-MM-DD (formato que o SQLite compara como texto, na ordem certa).
 */
function mapear(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    produtoId: linha.produto_id,
    produtoNome: linha.produto_nome ?? null,
    percentual: linha.percentual,
    inicio: linha.inicio,
    fim: linha.fim,
    ativo: Boolean(linha.ativo),
    criadoEm: linha.criado_em,
  };
}

const SELECT_COMPLETO = `
  SELECT pr.*, p.nome AS produto_nome
    FROM promocoes pr
    LEFT JOIN produtos p ON p.id = pr.produto_id
`;

export function criar({ produtoId, percentual, inicio, fim }) {
  const resultado = db
    .prepare(`
      INSERT INTO promocoes (produto_id, percentual, inicio, fim, ativo)
      VALUES (?, ?, ?, ?, 1)
    `)
    .run(produtoId, percentual, inicio, fim);

  return buscarPorId(resultado.lastInsertRowid);
}

export function buscarPorId(id) {
  return mapear(db.prepare(`${SELECT_COMPLETO} WHERE pr.id = ?`).get(id));
}

export function listar({ somenteAtivas = false } = {}) {
  const onde = somenteAtivas ? 'WHERE pr.ativo = 1' : '';
  return db
    .prepare(`${SELECT_COMPLETO} ${onde} ORDER BY pr.ativo DESC, pr.id DESC`)
    .all()
    .map(mapear);
}

/** Promoção ATIVA e dentro do período (início/fim são opcionais) para um produto. */
export function buscarVigentePorProduto(produtoId) {
  return mapear(
    db.prepare(`
      ${SELECT_COMPLETO}
       WHERE pr.produto_id = ?
         AND pr.ativo = 1
         AND (pr.inicio IS NULL OR pr.inicio <= date('now'))
         AND (pr.fim IS NULL OR pr.fim >= date('now'))
       ORDER BY pr.id DESC
       LIMIT 1
    `).get(produtoId),
  );
}

/** Todas as promoções vigentes de uma vez (evita N+1 ao montar o cardápio). */
export function listarVigentes() {
  return db
    .prepare(`
      ${SELECT_COMPLETO}
       WHERE pr.ativo = 1
         AND (pr.inicio IS NULL OR pr.inicio <= date('now'))
         AND (pr.fim IS NULL OR pr.fim >= date('now'))
       ORDER BY pr.id DESC
    `)
    .all()
    .map(mapear);
}

export function atualizar(id, { percentual, inicio, fim, ativo }) {
  db.prepare(`
    UPDATE promocoes SET percentual = ?, inicio = ?, fim = ?, ativo = ?, atualizado_em = datetime('now')
     WHERE id = ?
  `).run(percentual, inicio, fim, ativo ? 1 : 0, id);

  return buscarPorId(id);
}

/** Só uma promoção ativa por produto: ao ativar uma, as outras do produto saem. */
export function desativarDoProduto(produtoId, excetoId = null) {
  if (excetoId) {
    db.prepare('UPDATE promocoes SET ativo = 0 WHERE produto_id = ? AND id != ?').run(produtoId, excetoId);
    return;
  }

  db.prepare('UPDATE promocoes SET ativo = 0 WHERE produto_id = ?').run(produtoId);
}

export function excluir(id) {
  db.prepare('DELETE FROM promocoes WHERE id = ?').run(id);
}
