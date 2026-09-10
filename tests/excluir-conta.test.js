import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { CPF_ADMIN, CPF_CLIENTE, CPF_OUTRO_CLIENTE, criarAmbienteDeTeste } from './helpers/ambiente.js';

/**
 * Testes da EXCLUSÃO DO PRÓPRIO CADASTRO (a "zona de perigo" da loja).
 *
 * Regras que provamos aqui:
 *  1. cliente exclui a própria conta -> não entra mais e a sessão morre
 *  2. visitante não exclui nada (401)
 *  3. o ÚLTIMO admin não pode excluir a própria conta (a loja ficaria sem ninguém)
 *  4. havendo outro admin, o dono PODE excluir a própria conta
 */
describe('Exclusão do próprio cadastro', () => {
  let app;
  let encerrar;
  let repo;
  let hashSenha;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    repo = await import('../src/repositories/usuarios.repository.js');
    ({ hashSenha } = await import('../src/utils/senha.js'));
  });

  after(() => encerrar());

  it('visitante (sem login) recebe 401', async () => {
    const resposta = await request(app).delete('/api/auth/minha-conta');

    assert.equal(resposta.status, 401);
    assert.equal(resposta.body.codigo, 'NAO_AUTENTICADO');
  });

  it('o ÚLTIMO admin não consegue excluir a própria conta', async () => {
    await repo.criar({
      nome: 'Dono Único',
      cpf: CPF_ADMIN,
      senhaHash: await hashSenha('monster123'),
      papel: 'admin',
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ cpf: CPF_ADMIN, senha: 'monster123' });

    const resposta = await request(app)
      .delete('/api/auth/minha-conta')
      .set('Cookie', login.headers['set-cookie']);

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /último administrador/i);
  });

  it('cliente exclui a própria conta: sessão encerrada e login bloqueado', async () => {
    // cadastra (sem sessão) e faz login
    await request(app)
      .post('/api/auth/registrar')
      .send({ nome: 'Cliente Arrependido', cpf: CPF_CLIENTE, senha: 'senha123' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ cpf: CPF_CLIENTE, senha: 'senha123' });

    const cookie = login.headers['set-cookie'];
    assert.ok(cookie, 'esperava cookie de sessão após o login');

    // exclui a conta
    const exclusao = await request(app).delete('/api/auth/minha-conta').set('Cookie', cookie);
    assert.equal(exclusao.status, 200);
    assert.match(exclusao.body.mensagem, /excluído/i);
    // o servidor limpa o cookie na mesma resposta
    assert.match(exclusao.headers['set-cookie'].join(';'), /token=;/);

    // o cookie antigo não serve mais (usuário desativado)
    const tentativaDeAcesso = await request(app).get('/api/auth/eu').set('Cookie', cookie);
    assert.equal(tentativaDeAcesso.status, 401);

    // e um novo login é recusado
    const novoLogin = await request(app)
      .post('/api/auth/login')
      .send({ cpf: CPF_CLIENTE, senha: 'senha123' });
    assert.equal(novoLogin.status, 403);
    assert.match(novoLogin.body.erro, /desativado/i);
  });

  it('o cadastro excluído continua ocupando o CPF (exclusão lógica preserva o histórico)', async () => {
    const tentativaDeRecadastro = await request(app)
      .post('/api/auth/registrar')
      .send({ nome: 'Outra Pessoa', cpf: CPF_CLIENTE, senha: 'senha123' });

    assert.equal(tentativaDeRecadastro.status, 409);
  });

  it('havendo outro admin, o dono pode excluir a própria conta', async () => {
    // promove outro usuário a admin, feito direto no banco (atalho de teste)
    await repo.criar({
      nome: 'Segundo Admin',
      cpf: CPF_OUTRO_CLIENTE,
      senhaHash: await hashSenha('senha123'),
      papel: 'admin',
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ cpf: CPF_ADMIN, senha: 'monster123' });

    const resposta = await request(app)
      .delete('/api/auth/minha-conta')
      .set('Cookie', login.headers['set-cookie']);

    assert.equal(resposta.status, 200);
    assert.equal(repo.buscarPorCpf(CPF_ADMIN).ativo, false);
    assert.equal(repo.contarAdminsAtivos(), 1);
  });
});
