import request from 'supertest';
import { CPF_ADMIN, CPF_CLIENTE } from './ambiente.js';

/**
 * Helpers de teste com sessão pronta.
 * Os imports são DINÂMICOS de propósito: o banco só existe depois que
 * `criarAmbienteDeTeste()` roda (a conexão é criada no primeiro import).
 */

export async function criarAdminELogar(app) {
  const repo = await import('../../src/repositories/usuarios.repository.js');
  const { hashSenha } = await import('../../src/utils/senha.js');

  await repo.criar({
    nome: 'Dono Teste',
    cpf: CPF_ADMIN,
    senhaHash: await hashSenha('monster123'),
    papel: 'admin',
  });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ cpf: CPF_ADMIN, senha: 'monster123' });

  return login.headers['set-cookie'];
}

export async function cadastrarELogarCliente(app) {
  await request(app)
    .post('/api/auth/registrar')
    .send({ nome: 'Cliente Teste', cpf: CPF_CLIENTE, senha: 'senha123' });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ cpf: CPF_CLIENTE, senha: 'senha123' });

  return login.headers['set-cookie'];
}
