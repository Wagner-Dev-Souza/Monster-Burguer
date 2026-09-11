-- =====================================================================
-- 007_promocoes_cupons_mascote.sql
-- FASE 6/7 + mascote por produto.
--
-- O que entra aqui:
--  * produtos.mascote        -> o dono escolhe a arte do produto no painel
--  * promocoes               -> desconto por produto, com vigência opcional
--  * cupons                  -> código de desconto com regras (mínimo, validade, usos)
--  * pedidos.cupom_*         -> registro do cupom usado (histórico não se reescreve)
--  * pedido_itens.preco_original -> guarda quanto custava antes da promoção, para
--                                   o relatório saber quanto o cliente economizou
--
-- Obs.: o CHECK de `pedidos.forma_pagamento` continua aceitando 'na_entrega'
-- (valor antigo já gravado em pedidos existentes). A opção saiu da APLICAÇÃO:
-- crédito, débito e dinheiro já são pagamentos na entrega. Reescrever o CHECK
-- exigiria recriar a tabela inteira — trabalho sem ganho real.
-- =====================================================================

ALTER TABLE produtos ADD COLUMN mascote TEXT;

ALTER TABLE pedidos ADD COLUMN cupom_codigo TEXT;
ALTER TABLE pedidos ADD COLUMN cupom_percentual INTEGER;

ALTER TABLE pedido_itens ADD COLUMN preco_original INTEGER;

-- FASE 7 — PROMOÇÕES por produto -------------------------------
CREATE TABLE IF NOT EXISTS promocoes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id    INTEGER NOT NULL REFERENCES produtos (id),
  percentual    INTEGER NOT NULL CHECK (percentual BETWEEN 1 AND 90),
  inicio        TEXT,                       -- AAAA-MM-DD (opcional)
  fim           TEXT,                       -- AAAA-MM-DD (opcional)
  ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT
);

CREATE INDEX IF NOT EXISTS idx_promocoes_produto ON promocoes (produto_id, ativo);

-- FASE 7 — CUPONS de desconto ----------------------------------
CREATE TABLE IF NOT EXISTS cupons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo        TEXT    NOT NULL UNIQUE,     -- sempre em MAIÚSCULAS
  percentual    INTEGER NOT NULL CHECK (percentual BETWEEN 1 AND 90),
  valor_minimo  INTEGER NOT NULL DEFAULT 0,  -- centavos (0 = sem mínimo)
  usos_maximos  INTEGER,                     -- NULL = ilimitado
  usos          INTEGER NOT NULL DEFAULT 0,
  valido_ate    TEXT,                        -- AAAA-MM-DD (opcional)
  ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT
);
