import 'dotenv/config';

/**
 * Ponto ÚNICO de leitura das variáveis de ambiente.
 *
 * Por quê? Nenhum outro arquivo do sistema precisa saber que existe `process.env`.
 * Se um dia a configuração mudar (ex.: secrets manager), só este arquivo muda.
 */
function texto(nome, padrao) {
  const valor = process.env[nome];
  return valor === undefined || valor === '' ? padrao : valor;
}

function numero(nome, padrao) {
  const valor = Number(texto(nome, String(padrao)));
  if (Number.isNaN(valor)) {
    throw new Error(`Variável de ambiente ${nome} precisa ser um número (recebi: "${valor}")`);
  }
  return valor;
}

const nodeEnv = texto('NODE_ENV', 'development');
const jwtSecret = texto('JWT_SECRET', 'segredo-inseguro-de-desenvolvimento');

// Falha rápido: em produção NUNCA aceitamos o segredo padrão.
if (nodeEnv === 'production' && jwtSecret === 'segredo-inseguro-de-desenvolvimento') {
  throw new Error('Defina um JWT_SECRET forte antes de rodar em produção (ex.: openssl rand -hex 32)');
}

export const env = {
  nodeEnv,
  ehProducao: nodeEnv === 'production',
  ehTeste: nodeEnv === 'test',
  port: numero('PORT', 3000),
  dbPath: texto('DB_PATH', './data/monster-burguer.db'),
  jwtSecret,
  jwtExpiresIn: texto('JWT_EXPIRES_IN', '1d'),
  adminInicial: {
    nome: texto('ADMIN_NOME', 'Administrador'),
    cpf: texto('ADMIN_CPF', ''),
    senha: texto('ADMIN_SENHA', ''),
  },
};
