import { db } from '../database/connection.js';

/**
 * REPOSITORY de produtos e da FICHA TÉCNICA.
 * Valores em CENTAVOS (ver utils/moeda.js).
 */
function mapear(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    tipo: linha.tipo,
    precoVendaCentavos: linha.preco_venda,
    custoCompraCentavos: linha.custo_compra,
    estoque: linha.estoque,
    ativo: Boolean(linha.ativo),
    // Campos calculados que vêm junto na consulta (SUM da ficha técnica):
    custoFichaCentavos: linha.custo_ficha_centavos ?? 0,
    itensFicha: linha.itens_ficha ?? 0,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

/**
 * Consulta base: já traz o CUSTO DA FICHA TÉCNICA calculado pelo próprio banco.
 *
 * Por quê fazer a soma no SQL? Porque evita o problema "N+1" (uma consulta por
 * produto). Com LEFT JOIN + GROUP BY, o banco devolve tudo numa passada só.
 */
const SELECT_COM_CUSTO = `
  SELECT p.*,
         COALESCE(SUM(pi.quantidade * i.custo_unitario), 0) AS custo_ficha_centavos,
         COUNT(pi.id) AS itens_ficha
    FROM produtos p
    LEFT JOIN produto_ingredientes pi ON pi.produto_id = p.id
    LEFT JOIN ingredientes i          ON i.id = pi.ingrediente_id
`;

export function criar({ nome, descricao, tipo, precoVendaCentavos, custoCompraCentavos, estoque }) {
  const resultado = db
    .prepare(`
      INSERT INTO produtos (nome, descricao, tipo, preco_venda, custo_compra, estoque)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(nome, descricao, tipo, precoVendaCentavos, custoCompraCentavos, estoque);

  return buscarPorId(resultado.lastInsertRowid);
}

export function buscarPorId(id) {
  return mapear(db.prepare(`${SELECT_COM_CUSTO} WHERE p.id = ? GROUP BY p.id`).get(id));
}

export function buscarPorNomeAtivo(nome) {
  return mapear(
    db.prepare(`${SELECT_COM_CUSTO} WHERE p.nome = ? AND p.ativo = 1 GROUP BY p.id`).get(nome),
  );
}

export function listar({ tipo, incluirInativos = false } = {}) {
  const condicoes = [];
  const parametros = [];

  if (!incluirInativos) condicoes.push('p.ativo = 1');
  if (tipo) {
    condicoes.push('p.tipo = ?');
    parametros.push(tipo);
  }

  const onde = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

  return db
    .prepare(`${SELECT_COM_CUSTO} ${onde} GROUP BY p.id ORDER BY p.tipo, p.nome COLLATE NOCASE`)
    .all(...parametros)
    .map(mapear);
}

export function atualizar(id, { nome, descricao, tipo, precoVendaCentavos, custoCompraCentavos, estoque }) {
  db.prepare(`
    UPDATE produtos SET nome = ?, descricao = ?, tipo = ?, preco_venda = ?, custo_compra = ?, estoque = ?,
           atualizado_em = datetime('now')
    WHERE id = ?
  `).run(nome, descricao, tipo, precoVendaCentavos, custoCompraCentavos, estoque, id);

  return buscarPorId(id);
}

export function desativar(id) {
  db.prepare("UPDATE produtos SET ativo = 0, atualizado_em = datetime('now') WHERE id = ?").run(id);
  return buscarPorId(id);
}

/* ------------------------------ FICHA TÉCNICA ------------------------------ */

/** Itens da ficha técnica com o nome/unidade/custo do ingrediente (para exibir e calcular). */
export function listarComposicao(produtoId) {
  return db
    .prepare(`
      SELECT pi.ingrediente_id AS ingredienteId,
             i.nome            AS nome,
             i.unidade         AS unidade,
             i.custo_unitario  AS custoUnitarioCentavos,
             i.ativo           AS ingredienteAtivo,
             pi.quantidade     AS quantidade
        FROM produto_ingredientes pi
        JOIN ingredientes i ON i.id = pi.ingrediente_id
       WHERE pi.produto_id = ?
       ORDER BY i.nome COLLATE NOCASE
    `)
    .all(produtoId);
}

/**
 * Substitui a ficha técnica INTEIRA do produto.
 *
 * Por quê "substituir tudo" em vez de adicionar/remover item por item?
 * Porque a operação fica IDEMPOTENTE e atômica: o que o dono salvou na tela é
 * exatamente o que fica no banco. Tudo dentro de UMA transação — ou aplica tudo,
 * ou não aplica nada.
 */
export function substituirComposicao(produtoId, itens) {
  const apagar = db.prepare('DELETE FROM produto_ingredientes WHERE produto_id = ?');
  const inserir = db.prepare(`
    INSERT INTO produto_ingredientes (produto_id, ingrediente_id, quantidade)
    VALUES (?, ?, ?)
  `);

  const transacao = db.transaction(() => {
    apagar.run(produtoId);
    for (const item of itens) {
      inserir.run(produtoId, item.ingredienteId, item.quantidade);
    }
  });

  transacao();
  return listarComposicao(produtoId);
}
