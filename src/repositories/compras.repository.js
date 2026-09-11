import { db } from '../database/connection.js';

/**
 * REPOSITORY de COMPRAS (despesas com fornecedores).
 * Valores em CENTAVOS.
 */
function mapear(linha) {
  if (!linha) return null;
  const quantidade = linha.quantidade || 1;

  return {
    id: linha.id,
    tipo: linha.tipo,
    ingredienteId: linha.ingrediente_id,
    produtoId: linha.produto_id,
    itemNome: linha.item_nome ?? '(item removido)',
    itemUnidade: linha.item_unidade ?? null,
    fornecedor: linha.fornecedor,
    quantidade: linha.quantidade,
    valorTotalCentavos: linha.valor_total,
    // Valor unitário é CALCULADO (não guardamos: é derivado de total ÷ quantidade)
    valorUnitarioCentavos: Math.round(linha.valor_total / quantidade),
    dataCompra: linha.data_compra,
    observacao: linha.observacao,
    usuarioId: linha.usuario_id,
    usuarioNome: linha.usuario_nome ?? null,
    criadoEm: linha.criado_em,
  };
}

const SELECT_COMPLETO = `
  SELECT c.*,
         COALESCE(i.nome, p.nome)  AS item_nome,
         i.unidade                 AS item_unidade,
         u.nome                    AS usuario_nome
    FROM compras c
    LEFT JOIN ingredientes i ON i.id = c.ingrediente_id
    LEFT JOIN produtos p     ON p.id = c.produto_id
    LEFT JOIN usuarios u     ON u.id = c.usuario_id
`;

export function criar({ tipo, ingredienteId = null, produtoId = null, fornecedor, quantidade, valorTotalCentavos, dataCompra, observacao, usuarioId }) {
  const resultado = db
    .prepare(`
      INSERT INTO compras (tipo, ingrediente_id, produto_id, fornecedor, quantidade, valor_total, data_compra, observacao, usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?, ?)
    `)
    .run(tipo, ingredienteId, produtoId, fornecedor, quantidade, valorTotalCentavos, dataCompra, observacao, usuarioId);

  return buscarPorId(resultado.lastInsertRowid);
}

export function buscarPorId(id) {
  return mapear(db.prepare(`${SELECT_COMPLETO} WHERE c.id = ?`).get(id));
}

export function listar({ tipo, limite = 100 } = {}) {
  const condicoes = [];
  const parametros = [];

  if (tipo) {
    condicoes.push('c.tipo = ?');
    parametros.push(tipo);
  }

  const onde = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
  parametros.push(limite);

  return db
    .prepare(`${SELECT_COMPLETO} ${onde} ORDER BY c.data_compra DESC, c.id DESC LIMIT ?`)
    .all(...parametros)
    .map(mapear);
}

export function excluir(id) {
  db.prepare('DELETE FROM compras WHERE id = ?').run(id);
}

/** Totais de compras de um item (base do custo médio ponderado). */
export function somarPorIngrediente(ingredienteId) {
  return db
    .prepare(`
      SELECT COALESCE(SUM(quantidade), 0) AS quantidade_total,
             COALESCE(SUM(valor_total), 0) AS valor_total
        FROM compras WHERE tipo = 'ingrediente' AND ingrediente_id = ?
    `)
    .get(ingredienteId);
}

export function somarPorProduto(produtoId) {
  return db
    .prepare(`
      SELECT COALESCE(SUM(quantidade), 0) AS quantidade_total,
             COALESCE(SUM(valor_total), 0) AS valor_total
        FROM compras WHERE tipo = 'produto' AND produto_id = ?
    `)
    .get(produtoId);
}

/** Resumo de despesas (usado pelo painel e, depois, pelo fluxo de caixa). */
export function resumo() {
  const total = db
    .prepare('SELECT COALESCE(SUM(valor_total), 0) AS total, COUNT(*) AS quantidade FROM compras')
    .get();

  const doMes = db
    .prepare(`
      SELECT COALESCE(SUM(valor_total), 0) AS total, COUNT(*) AS quantidade
        FROM compras WHERE strftime('%Y-%m', data_compra) = strftime('%Y-%m', 'now')
    `)
    .get();

  return {
    totalCentavos: total.total,
    quantidadeCompras: total.quantidade,
    mesCentavos: doMes.total,
    comprasDoMes: doMes.quantidade,
  };
}
