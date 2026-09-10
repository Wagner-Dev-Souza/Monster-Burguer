import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';

/**
 * Sistema de MIGRATIONS.
 *
 * Por quê? O banco precisa evoluir junto com o código, sem perder dados e sem
 * "apagar tudo e criar de novo". Cada arquivo .sql em `migrations/` é aplicado
 * UMA única vez, em ordem alfabética, e fica registrado na tabela `migrations`.
 *
 * Formato do nome: 001_usuarios.sql, 002_produtos.sql, ...
 */
const DIR_MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT NOT NULL UNIQUE,
      aplicada_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const jaAplicadas = new Set(db.prepare('SELECT nome FROM migrations').all().map((linha) => linha.nome));

  const arquivos = fs
    .readdirSync(DIR_MIGRATIONS)
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort(); // 001_..., 002_... => ordem determinística

  const registrar = db.prepare('INSERT INTO migrations (nome) VALUES (?)');
  const aplicadasAgora = [];

  for (const arquivo of arquivos) {
    if (jaAplicadas.has(arquivo)) continue;

    const sql = fs.readFileSync(path.join(DIR_MIGRATIONS, arquivo), 'utf8');

    // Transação: ou a migration inteira é aplicada, ou nada dela é aplicado.
    const aplicar = db.transaction(() => {
      db.exec(sql);
      registrar.run(arquivo);
    });

    aplicar();
    aplicadasAgora.push(arquivo);
  }

  return aplicadasAgora;
}

// Permite rodar direto pelo terminal: `npm run migrate`
const executadoDireto =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDireto) {
  const aplicadas = runMigrations();
  if (aplicadas.length === 0) {
    console.log('✅ Nenhuma migration pendente. Banco já está atualizado.');
  } else {
    console.log(`✅ ${aplicadas.length} migration(s) aplicada(s): ${aplicadas.join(', ')}`);
  }
}
