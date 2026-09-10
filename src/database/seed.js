import { env } from '../config/env.js';
import { db } from './connection.js';
import { runMigrations } from './migrate.js';
import { normalizarCPF, validarCPF } from '../utils/cpf.js';
import { hashSenha } from '../utils/senha.js';
import * as usuariosRepo from '../repositories/usuarios.repository.js';

/**
 * Seed = dado inicial necessário para o sistema funcionar.
 *
 * Aqui: cria o DONO da loja (papel admin) a partir das variáveis do .env.
 * É idempotente (pode rodar mil vezes): se o CPF já existir, não faz nada.
 */
export async function seedAdminInicial() {
  const { nome, cpf, senha } = env.adminInicial;

  if (!cpf || !senha) {
    return { criado: false, motivo: 'ADMIN_CPF/ADMIN_SENHA não configurados no .env' };
  }

  const cpfNormalizado = normalizarCPF(cpf);

  if (!validarCPF(cpfNormalizado)) {
    throw new Error(`ADMIN_CPF inválido no .env: "${cpf}"`);
  }

  const existente = usuariosRepo.buscarPorCpf(cpfNormalizado);

  if (existente) {
    if (existente.papel !== 'admin') {
      usuariosRepo.atualizarPapel(existente.id, 'admin');
      return { criado: false, motivo: 'usuário já existia e foi promovido a admin' };
    }
    return { criado: false, motivo: 'admin já existia (nada a fazer)' };
  }

  usuariosRepo.criar({
    nome,
    cpf: cpfNormalizado,
    senhaHash: await hashSenha(senha),
    papel: 'admin',
  });

  return { criado: true, motivo: `admin "${nome}" criado com o CPF ${cpfNormalizado}` };
}

// Permite rodar direto pelo terminal: `npm run seed`
const executadoDireto = process.argv[1]?.endsWith('seed.js');

if (executadoDireto) {
  runMigrations();
  const resultado = await seedAdminInicial();
  console.log(`🌱 Seed: ${resultado.motivo}`);
  db.close();
}
