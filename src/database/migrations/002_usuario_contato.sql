-- =====================================================================
-- 002_usuario_contato.sql
-- Dados de contato do cliente: telefone e endereço.
--
-- Por que uma migration SEPARADA (e não editar a 001)?
--  * migrations já aplicadas nunca são alteradas: quem já rodou o sistema
--    tem o banco na versão 1 e precisa de um caminho de atualização.
--  * `ALTER TABLE ... ADD COLUMN` adiciona campos SEM perder dados — é assim
--    que um sistema em produção evolui.
--
-- Observação: telefone/endereço serão coletados no fechamento do pedido
-- (Fase 5), mas o cliente já pode mantê-los em "Minha conta".
-- =====================================================================

ALTER TABLE usuarios ADD COLUMN telefone   TEXT;
ALTER TABLE usuarios ADD COLUMN cep        TEXT;
ALTER TABLE usuarios ADD COLUMN endereco   TEXT;
ALTER TABLE usuarios ADD COLUMN numero     TEXT;
ALTER TABLE usuarios ADD COLUMN complemento TEXT;
ALTER TABLE usuarios ADD COLUMN bairro     TEXT;
ALTER TABLE usuarios ADD COLUMN cidade     TEXT;
