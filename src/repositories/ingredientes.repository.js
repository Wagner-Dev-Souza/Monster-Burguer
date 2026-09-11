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

/**
 * EXCLUSÃO DE VERDADE do ingrediente.
 *
 * Por que aqui pode ser DELETE (e produto não)? Porque ingrediente não tem
 * histórico: nenhum pedido/venda aponta para ele. Já o produto vai aparecer nos
 * pedidos das próximas fases — apagar de verdade quebraria o histórico.
 * O service só permite excluir quando NENHUMA ficha técnica usa o ingrediente.
 */
export function excluir(id) {
  db.prepare('DELETE FROM ingredientes WHERE id = ?').run(id);
}

/** Produtos cuja ficha técnica usa este ingrediente (para avisar antes de excluir). */
export function listarProdutosQueUsam(ingredienteId) {
  return db
    .prepare(`
      SELECT p.id, p.nome
        FROM produto_ingredientes pi
        JOIN produtos p ON p.id = pi.produto_id
       WHERE pi.ingrediente_id = ?
       ORDER BY p.nome COLLATE NOCASE
    `)
    .all(ingredienteId);
}

/** Atualiza SÓ o custo unitário (usado pelo custo médio ponderado das compras). */
export function atualizarCusto(id, custoUnitarioCentavos) {
  db.prepare("UPDATE ingredientes SET custo_unitario = ?, atualizado_em = datetime('now') WHERE id = ?")
    .run(custoUnitarioCentavos, id);

  return buscarPorId(id);
}

/** Quantos itens de ficha técnica usam este ingrediente (para avisar antes de desativar). */
export function contarUsos(id) {
  return db
    .prepare('SELECT COUNT(*) AS total FROM produto_ingredientes WHERE ingrediente_id = ?')
    .get(id).total;
}
