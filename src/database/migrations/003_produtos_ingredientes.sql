-- =====================================================================
-- 003_produtos_ingredientes.sql
-- Fase 2: produtos (lanches e bebidas), ingredientes e FICHA TÉCNICA.
--
-- DECISÃO IMPORTANTE SOBRE DINHEIRO: valores são guardados em CENTAVOS
-- (INTEGER), não em decimal (REAL).
-- Por quê? Números decimais no computador são aproximados: 0.1 + 0.2 = 0.30000000000000004.
-- Somando dezenas de pedidos, apareceria centavo fantasma no caixa. Com centavos
-- inteiros, a conta fecha exatamente. A conversão (R$ 12,50 <-> 1250) acontece na
-- borda do sistema, em src/utils/moeda.js.
--
-- Sobre o CUSTO:
--  * lanche  -> custo CALCULADO pela ficha técnica (soma de quantidade x custo do ingrediente)
--  * bebida  -> custo INFORMADO em `custo_compra` (produto de revenda, comprado pronto)
--
-- Unidades de ingrediente: un | g | kg | ml | l | fatia | porcao
-- (a quantidade da receita é REAL: 0.15 kg de queijo, 2 fatias de bacon...)
-- =====================================================================

CREATE TABLE IF NOT EXISTS ingredientes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT    NOT NULL,
  unidade         TEXT    NOT NULL CHECK (unidade IN ('un', 'g', 'kg', 'ml', 'l', 'fatia', 'porcao')),
  custo_unitario  INTEGER NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0), -- em CENTAVOS
  ativo           INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Índice ÚNICO PARCIAL: impede dois ingredientes com o mesmo nome ATIVOS, mas
-- libera o nome quando o ingrediente é desativado (índice parcial do SQLite).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredientes_nome_ativo
  ON ingredientes (nome) WHERE ativo = 1;

CREATE TABLE IF NOT EXISTS produtos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL,
  descricao     TEXT,
  tipo          TEXT    NOT NULL CHECK (tipo IN ('lanche', 'bebida')),
  preco_venda   INTEGER NOT NULL CHECK (preco_venda >= 0),           -- em CENTAVOS
  custo_compra  INTEGER          CHECK (custo_compra IS NULL OR custo_compra >= 0), -- CENTAVOS (bebidas)
  estoque       INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),     -- controle de estoque (bebidas)
  ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_nome_ativo
  ON produtos (nome) WHERE ativo = 1;

CREATE INDEX IF NOT EXISTS idx_produtos_tipo_ativo ON produtos (tipo, ativo);

-- FICHA TÉCNICA: quais ingredientes (e quanto de cada) compõem um lanche.
CREATE TABLE IF NOT EXISTS produto_ingredientes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id     INTEGER NOT NULL REFERENCES produtos (id) ON DELETE CASCADE,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes (id),
  quantidade     REAL    NOT NULL CHECK (quantidade > 0),
  UNIQUE (produto_id, ingrediente_id)  -- o mesmo ingrediente não entra duas vezes
);

CREATE INDEX IF NOT EXISTS idx_composicao_produto ON produto_ingredientes (produto_id);
