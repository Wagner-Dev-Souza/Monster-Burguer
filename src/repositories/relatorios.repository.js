import { db } from '../database/connection.js';

/**
 * REPOSITORY de RELATÓRIOS (Fase 8) — consultas de agregação.
 *
 * Nota de projeto: quando o relatório só precisa SOMAR e AGRUPAR, deixamos o
 * banco fazer isso (GROUP BY). Trazer todas as linhas para somar em JavaScript
 * funcionaria, mas ficaria lento conforme a loja cresce — e é justamente o tipo
 * de consulta que roda muito no fim do mês.
 */

const FORMATO_POR_AGRUPAMENTO = {
  dia: '%Y-%m-%d',
  mes: '%Y-%m',
  ano: '%Y',
};

export function formatoDe(agrupamento) {
  return FORMATO_POR_AGRUPAMENTO[agrupamento];
}

/** Receita por período (só pedidos PAGOS e não cancelados). */
export function receitaPorPeriodo(agrupamento, limite) {
  const formato = formatoDe(agrupamento);

  return db
    .prepare(`
      SELECT strftime('${formato}', pago_em) AS periodo,
             COALESCE(SUM(total), 0)         AS receita,
             COUNT(*)                        AS pedidos
        FROM pedidos
       WHERE pago_em IS NOT NULL AND status != 'cancelado'
       GROUP BY periodo
       ORDER BY periodo DESC
       LIMIT ?
    `)
    .all(limite);
}

/** Despesas por período (compras dos fornecedores). */
export function despesasPorPeriodo(agrupamento, limite) {
  const formato = formatoDe(agrupamento);

  return db
    .prepare(`
      SELECT strftime('${formato}', data_compra) AS periodo,
             COALESCE(SUM(valor_total), 0)       AS despesas,
             COUNT(*)                            AS compras
        FROM compras
       WHERE data_compra IS NOT NULL
       GROUP BY periodo
       ORDER BY periodo DESC
       LIMIT ?
    `)
    .all(limite);
}

export function resumoGeral() {
  const receita = db
    .prepare(`
      SELECT COALESCE(SUM(total), 0) AS receita, COUNT(*) AS pedidos
        FROM pedidos WHERE pago_em IS NOT NULL AND status != 'cancelado'
    `)
    .get();

  const despesas = db.prepare('SELECT COALESCE(SUM(valor_total), 0) AS despesas, COUNT(*) AS compras FROM compras').get();

  const descontos = db
    .prepare(`
      SELECT COALESCE(SUM(desconto), 0) AS descontos
        FROM pedidos WHERE pago_em IS NOT NULL AND status != 'cancelado'
    `)
    .get();

  const aguardando = db.prepare("SELECT COUNT(*) AS quantidade FROM pedidos WHERE status = 'aguardando_pagamento'").get();

  return {
    receitaCentavos: receita.receita,
    pedidosPagos: receita.pedidos,
    despesasCentavos: despesas.despesas,
    compras: despesas.compras,
    descontosCentavos: descontos.descontos,
    aguardandoPagamento: aguardando.quantidade,
  };
}

/** Movimentações detalhadas (entradas e saídas), para o extrato do caixa. */
export function extrato({ limite = 40 } = {}) {
  return db
    .prepare(`
      SELECT 'entrada' AS tipo,
             p.id       AS referencia_id,
             'Pedido #' || printf('%04d', p.id) AS descricao,
             p.total    AS valor,
             p.pago_em  AS quando
        FROM pedidos p
       WHERE p.pago_em IS NOT NULL AND p.status != 'cancelado'

       UNION ALL

      SELECT 'saida' AS tipo,
             c.id AS referencia_id,
             COALESCE(i.nome, pr.nome, 'Compra') || COALESCE(' - ' || c.fornecedor, '') AS descricao,
             -c.valor_total AS valor,
             c.criado_em    AS quando
        FROM compras c
        LEFT JOIN ingredientes i ON i.id = c.ingrediente_id
        LEFT JOIN produtos pr    ON pr.id = c.produto_id

       ORDER BY quando DESC
       LIMIT ?
    `)
    .all(limite);
}

/** Quanto cada produto vendeu (quantidade, receita) — só pedidos pagos. */
export function vendasPorProduto() {
  return db
    .prepare(`
      SELECT pi.produto_id            AS produtoId,
             pi.nome_produto          AS nome,
             pi.tipo                  AS tipo,
             SUM(pi.quantidade)       AS quantidade,
             SUM(pi.subtotal)         AS receita,
             SUM(COALESCE(pi.preco_original, pi.preco_unitario) * pi.quantidade) AS receitaSemPromocao
        FROM pedido_itens pi
        JOIN pedidos p ON p.id = pi.pedido_id
       WHERE p.pago_em IS NOT NULL AND p.status != 'cancelado'
       GROUP BY pi.produto_id, pi.nome_produto
       ORDER BY receita DESC
    `)
    .all();
}
