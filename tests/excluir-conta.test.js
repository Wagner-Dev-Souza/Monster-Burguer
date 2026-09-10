import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { CPF_ADMIN, CPF_CLIENTE, criarAmbienteDeTeste } from './helpers/ambiente.js';

/**
 * Testes da EXCLUSÃO DO PRÓPRIO CADASTRO (a "zona de perigo" da loja).
 *
 * Regras que provamos aqui:
 *  1. visitante não exclui nada (401)
 *  2. ADMIN não exclui a própria conta — precisa ser rebaixado a cliente antes
 *  3. cliente exclui a própria conta -> não entra mais e a sessão morre
 *  4. o CPF continua reservado (exclusão lógica preserva o histórico)
 *  5. rebaixado a cliente, o ex-admin consegue excluir
 */
describe('Exclusão do próprio cadastro', () => {
  let app;
  let encerrar;
  let repo;
  let hashSenha;
  let idAdmin;

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

  it('ADMIN não consegue excluir a própria conta (precisa ser rebaixado antes)', async () => {
    const admin = await repo.criar({
      nome: 'Dono da Loja',
      cpf: CPF_ADMIN,
      senhaHash: await hashSenha('monster123'),
      papel: 'admin',
    });
    idAdmin = admin.id;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ cpf: CPF_ADMIN, senha: 'monster123' });

    const resposta = await request(app)
      .delete('/api/auth/minha-conta')
      .set('Cookie', login.headers['set-cookie']);

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /Administradores não podem excluir/i);
    assert.match(resposta.body.erro, /rebaixar você a cliente/i);

    // A conta continua ativa: a exclusão foi de fato barrada.
    assert.equal(repo.buscarPorCpf(CPF_ADMIN).ativo, true);
  });

  it('cliente exclui a própria conta: sessão encerrada e login bloqueado', async () => {
    await request(app)
      .post('/api/auth/registrar')
      .send({ nome: 'Cliente Arrependido', cpf: CPF_CLIENTE, senha: 'senha123' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ cpf: CPF_CLIENTE, senha: 'senha123' });

    const cookie = login.headers['set-cookie'];
    assert.ok(cookie, 'esperava cookie de sessão após o login');

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

  it('rebaixado a cliente, o ex-admin consegue excluir a própria conta', async () => {
    // um admin rebaixa o outro (aqui direto no banco, como atalho de teste)
    repo.atualizarPapel(idAdmin, 'cliente');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ cpf: CPF_ADMIN, senha: 'monster123' });

    const resposta = await request(app)
      .delete('/api/auth/minha-conta')
      .set('Cookie', login.headers['set-cookie']);

    assert.equal(resposta.status, 200);
    assert.equal(repo.buscarPorCpf(CPF_ADMIN).ativo, false);
  });
});
