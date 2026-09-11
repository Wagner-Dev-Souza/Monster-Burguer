-- =====================================================================
-- 005_compras.sql
-- FASE 3 — Compras dos fornecedores (as DESPESAS da loja).
--
-- Uma tabela serve para os dois tipos de compra, distinguidos por `tipo`:
--   * ingrediente -> o que entra na receita (pão, carne, queijo...)
--   * produto     -> bebida comprada pronta para revenda
-- O CHECK no fim garante que só um dos dois ids é preenchido (defesa no banco:
-- não existe compra "de ingrediente" apontando para produto).
--
-- O que uma compra FAZ no sistema (calculado no service, não aqui):
--   * ingrediente: recalcula o CUSTO UNITÁRIO como média ponderada
--     (total gasto ÷ total comprado) -> é o que faz o custo do lanche ficar real
--   * produto (bebida): aumenta o ESTOQUE e atualiza o custo de compra
-- =====================================================================

CREATE TABLE IF NOT EXISTS compras (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo           TEXT    NOT NULL CHECK (tipo IN ('ingrediente', 'produto')),
  ingrediente_id INTEGER REFERENCES ingredientes (id),
  produto_id     INTEGER REFERENCES produtos (id),
  fornecedor     TEXT,
  quantidade     REAL    NOT NULL CHECK (quantidade > 0),
  valor_total    INTEGER NOT NULL CHECK (valor_total > 0),   -- CENTAVOS pagos
  data_compra    TEXT    NOT NULL DEFAULT (date('now')),
  observacao     TEXT,
  usuario_id     INTEGER REFERENCES usuarios (id),            -- quem registrou
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now')),

  CHECK (
    (tipo = 'ingrediente' AND ingrediente_id IS NOT NULL AND produto_id IS NULL)
    OR (tipo = 'produto' AND produto_id IS NOT NULL AND ingrediente_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_compras_data ON compras (data_compra DESC);
CREATE INDEX IF NOT EXISTS idx_compras_ingrediente ON compras (ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_compras_produto ON compras (produto_id);
