-- =====================================================================
-- 006_pedidos.sql
-- FASE 5 — Pedidos do cliente final e pagamento (simulado).
--
-- DECISÕES IMPORTANTES (e por quê):
--  * `nome_produto` e `preco_unitario` são COPIADOS para o item do pedido.
--    Isso é o "preço congelado": se o dono mudar o preço amanhã, o pedido de
--    ontem continua valendo o que o cliente pagou. Histórico não se reescreve.
--  * dinheiro em CENTAVOS (INTEGER), como no resto do sistema.
--  * `desconto` já nasce aqui (zerado) para a Fase 7 (cupons) não precisar
--    mexer na estrutura de pedidos já criados.
--  * status começa em 'aguardando_pagamento' e vira 'pago' quando o cliente
--    confirma o pagamento simulado. O resto do fluxo (preparo, entrega) é a
--    Fase 6.
-- =====================================================================

CREATE TABLE IF NOT EXISTS pedidos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios (id),
  status          TEXT    NOT NULL DEFAULT 'aguardando_pagamento'
                          CHECK (status IN ('aguardando_pagamento', 'pago', 'em_preparo',
                                            'pronto', 'saiu_entrega', 'entregue', 'cancelado')),
  forma_pagamento TEXT    CHECK (forma_pagamento IN ('pix', 'credito', 'debito', 'dinheiro', 'na_entrega')),
  precisa_troco   INTEGER NOT NULL DEFAULT 0 CHECK (precisa_troco IN (0, 1)),
  troco_para      INTEGER,                                  -- centavos (quanto o cliente entrega em dinheiro)
  subtotal        INTEGER NOT NULL CHECK (subtotal >= 0),   -- centavos
  desconto        INTEGER NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  total           INTEGER NOT NULL CHECK (total >= 0),
  observacao      TEXT,
  criado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
  pago_em         TEXT
);

CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos (status, criado_em DESC);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  produto_id      INTEGER REFERENCES produtos (id),
  nome_produto    TEXT    NOT NULL,   -- congelado no momento do pedido
  tipo            TEXT    NOT NULL CHECK (tipo IN ('lanche', 'bebida')),
  quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario  INTEGER NOT NULL CHECK (preco_unitario >= 0),  -- congelado (centavos)
  subtotal        INTEGER NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens ON pedido_itens (pedido_id);
