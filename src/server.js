import { criarApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './database/migrate.js';
import { seedAdminInicial } from './database/seed.js';

/**
 * Ponto de entrada: prepara o banco e sobe o servidor.
 *
 * Decisão: as migrations e o seed rodam AUTOMATICAMENTE no boot.
 * Por quê? Quem clonar o projeto só precisa de `npm install && npm run dev` —
 * sem passos manuais esquecidos. Ambos são idempotentes (podem rodar sempre).
 */
async function iniciar() {
  console.log('🍔 Monster Burguer — iniciando...');

  const migrationsAplicadas = runMigrations();
  if (migrationsAplicadas.length > 0) {
    console.log(`📦 Migrations aplicadas: ${migrationsAplicadas.join(', ')}`);
  }

  const seed = await seedAdminInicial();
  console.log(`🌱 Admin inicial: ${seed.motivo}`);

  const app = criarApp();
  const servidor = app.listen(env.port, () => {
    console.log(`🚀 Servidor no ar em http://localhost:${env.port} (${env.nodeEnv})`);
  });

  // Erro clássico de quem roda mais de um projeto: a porta já está ocupada.
  // Em vez de um stack trace assustador, damos uma instrução clara.
  servidor.on('error', (erro) => {
    if (erro.code === 'EADDRINUSE') {
      console.error(`❌ A porta ${env.port} já está em uso. Troque o valor de PORT no arquivo .env.`);
    } else {
      console.error('❌ Erro no servidor:', erro);
    }
    process.exit(1);
  });
}

iniciar().catch((erro) => {
  console.error('❌ Falha ao iniciar o servidor:', erro);
  process.exit(1);
});
