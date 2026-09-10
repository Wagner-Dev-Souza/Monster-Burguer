import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env } from '../config/env.js';

/**
 * Conexão única com o banco (padrão Singleton).
 *
 * Por quê? O better-sqlite3 é síncrono e mantém um único arquivo aberto.
 * Abrir uma conexão por requisição seria desperdício e poderia gerar locks.
 */
const emMemoria = env.dbPath === ':memory:';

if (!emMemoria) {
  // Garante que a pasta do banco exista antes de abrir o arquivo.
  fs.mkdirSync(path.dirname(path.resolve(env.dbPath)), { recursive: true });
}

export const db = new Database(env.dbPath);

// WAL: permite ler e escrever ao mesmo tempo com boa performance.
db.pragma('journal_mode = WAL');
// Chaves estrangeiras ligadas: a integridade é garantida pelo próprio banco.
db.pragma('foreign_keys = ON');
