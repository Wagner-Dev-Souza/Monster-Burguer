-- =====================================================================
-- 001_usuarios.sql
-- Tabela de usuários do sistema.
--
-- Nasce como Fase 1 (autenticação e permissões), mas já é o alicerce de
-- tudo: é ela que diz QUEM está logado e O QUE essa pessoa pode fazer.
--
-- Decisões:
--  * `papel` distingue cliente de administrador (regra de ouro do sistema).
--    Regra do banco (CHECK) garante que ninguém grava um papel inválido,
--    mesmo que alguém erre no código da aplicação. Defesa em profundidade.
--  * `senha_hash`: guardamos apenas o hash bcrypt, NUNCA a senha em texto.
--  * `ativo`: desativar usuário em vez de apagar (histórico de pedidos
--    continua íntegro se um dia precisarmos do vínculo).
--  * `criado_em` / `atualizado_em`: rastreabilidade (bom para auditoria).
-- =====================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL,
  cpf           TEXT    NOT NULL UNIQUE,                          -- apenas dígitos (só números)
  senha_hash    TEXT    NOT NULL,
  papel         TEXT    NOT NULL DEFAULT 'cliente'
                        CHECK (papel IN ('cliente', 'admin')),
  ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- CPF é a credencial de login: busca frequente, logo precisa de índice.
CREATE INDEX IF NOT EXISTS idx_usuarios_cpf ON usuarios (cpf);
