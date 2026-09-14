import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Cria um ambiente isolado para os testes.
 *
 * Por que assim?
 *  * banco SQLite num arquivo TEMPORÁRIO -> os testes nunca tocam o banco real
 *    e cada arquivo de teste começa do zero (sem "sujeira" de um no outro)
 *  * usamos `import()` dinâmico porque os módulos leem as variáveis de
 *    ambiente no momento em que são importados; precisamos definir DB_PATH
 *    e JWT_SECRET ANTES de carregar o app
 *
 * ⚠️ IMPORTANTE: chame esta função UMA vez por ARQUIVO de teste (não uma vez
 * por `describe`). A conexão do banco é um singleton, aberta no primeiro
 * import — um segundo ambiente no mesmo processo continuaria apontando para o
 * primeiro banco. Como o `node --test` roda cada arquivo num processo próprio,
 * o isolamento entre arquivos está garantido.
 */
export async function criarAmbienteDeTeste() {
  const pasta = mkdtempSync(path.join(tmpdir(), 'monster-burguer-teste-'));

  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = path.join(pasta, 'teste.db');
  process.env.JWT_SECRET = 'segredo-somente-para-testes';
  process.env.JWT_EXPIRES_IN = '1d';
  // Nos testes não queremos admin automático: cada teste cria o que precisa.
  process.env.ADMIN_CPF = '';
  process.env.ADMIN_SENHA = '';

  const { runMigrations } = await import('../../src/database/migrate.js');
  runMigrations();

  const { criarApp } = await import('../../src/app.js');
  const { db } = await import('../../src/database/connection.js');

  return {
    app: criarApp(),
    encerrar() {
      // Fecha a conexão ANTES de apagar a pasta: no Windows o arquivo .db
      // fica travado enquanto o handle do SQLite estiver aberto, e o rmSync
      // falha com EBUSY — o temp dir vaza e a hook de teardown quebra.
      db.close();
      rmSync(pasta, { recursive: true, force: true });
    },
  };
}

/** CPFs válidos (dígito verificador correto) para usar nos testes. */
export const CPF_CLIENTE = '52998224725';
export const CPF_OUTRO_CLIENTE = '12345678909';
export const CPF_ADMIN = '11144477735';
