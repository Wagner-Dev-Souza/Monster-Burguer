-- =====================================================================
-- 004_auditoria.sql
-- Registro de QUEM fez cada alteração no sistema (auditoria).
--
-- Por quê? Em uma loja com mais de um administrador, "quem mudou o preço do
-- X-Burguer?" precisa ter resposta. Guardamos:
--   * quem fez (id + CÓPIA do nome e do papel no momento da ação)
--   * o que fez (acao: criar/atualizar/excluir/ficha/promover...)
--   * em que (entidade + entidade_id) e um detalhe legível
--   * quando (criado_em)
--
-- Sobre o "id simples" do usuário: ele já existe (usuarios.id). Na interface
-- mostramos como código curto (#0001, #0002...) para facilitar a conversa:
-- "foi o admin #0001 que reajustou o preço".
-- =====================================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER REFERENCES usuarios (id),
  usuario_nome  TEXT    NOT NULL,   -- fotografia do nome na hora da ação
  usuario_papel TEXT    NOT NULL,   -- fotografia do papel (cliente/admin)
  acao          TEXT    NOT NULL,
  entidade      TEXT    NOT NULL,
  entidade_id   INTEGER,
  detalhe       TEXT,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auditoria_criado ON auditoria (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON auditoria (entidade, entidade_id);
