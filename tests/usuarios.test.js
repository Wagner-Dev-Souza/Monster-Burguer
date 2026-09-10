import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { CPF_ADMIN, CPF_CLIENTE, criarAmbienteDeTeste } from './helpers/ambiente.js';

/**
 * Testes da barreira administrativa (o coração das permissões).
 *
 * Aqui provamos a REGRA DE OURO: quem não é admin não acessa nada de
 * administrativo — nem lista de usuários, nem promoção de papéis.
 */
describe('Permissões (RBAC)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;
  let idCliente;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());

    // Admin inicial (equivalente ao seed do dono, feito direto no banco).
    const usuariosRepo = await import('../src/repositories/usuarios.repository.js');
    const { hashSenha } = await import('../src/utils/senha.js');
    await usuariosRepo.criar({
      nome: 'Dono da Loja',
      cpf: CPF_ADMIN,
      senhaHash: await hashSenha('monster123'),
      papel: 'admin',
    });

    // Um cliente comum, cadastrado pelo fluxo público.
    const cadastro = await request(app)
      .post('/api/auth/registrar')
      .send({ nome: 'Funcionario Cliente', cpf: CPF_CLIENTE, senha: 'senha123' });
    idCliente = cadastro.body.usuario.id;

    cookieAdmin = (
      await request(app).post('/api/auth/login').send({ cpf: CPF_ADMIN, senha: 'monster123' })
    ).headers['set-cookie'];

    cookieCliente = (
      await request(app).post('/api/auth/login').send({ cpf: CPF_CLIENTE, senha: 'senha123' })
    ).headers['set-cookie'];
  });

  after(() => encerrar());

  it('visitante (sem login) recebe 401 na área administrativa', async () => {
    const resposta = await request(app).get('/api/usuarios');

    assert.equal(resposta.status, 401);
    assert.equal(resposta.body.codigo, 'NAO_AUTENTICADO');
  });

  it('cliente logado recebe 403 (está autenticado, mas não é autorizado)', async () => {
    const resposta = await request(app).get('/api/usuarios').set('Cookie', cookieCliente);

    assert.equal(resposta.status, 403);
    assert.equal(resposta.body.codigo, 'ACESSO_NEGADO');
  });

  it('cliente NÃO consegue promover a si mesmo a admin', async () => {
    const resposta = await request(app)
      .patch(`/api/usuarios/${idCliente}/papel`)
      .set('Cookie', cookieCliente)
      .send({ papel: 'admin' });

    assert.equal(resposta.status, 403);
  });

  it('admin lista os usuários sem expor hash de senha', async () => {
    const resposta = await request(app).get('/api/usuarios').set('Cookie', cookieAdmin);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.usuarios.length, 2);
    assert.ok(resposta.body.usuarios.every((usuario) => usuario.senhaHash === undefined));
  });

  it('admin promove um cliente a admin', async () => {
    const resposta = await request(app)
      .patch(`/api/usuarios/${idCliente}/papel`)
      .set('Cookie', cookieAdmin)
      .send({ papel: 'admin' });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.usuario.papel, 'admin');
  });

  it('o usuário promovido passa a acessar a área administrativa', async () => {
    // Token novo: o papel está dentro do JWT, então precisa logar de novo.
    const novoLogin = await request(app)
      .post('/api/auth/login')
      .send({ cpf: CPF_CLIENTE, senha: 'senha123' });

    const resposta = await request(app).get('/api/usuarios').set('Cookie', novoLogin.headers['set-cookie']);

    assert.equal(resposta.status, 200);
  });

  it('recusa papel inválido', async () => {
    const resposta = await request(app)
      .patch(`/api/usuarios/${idCliente}/papel`)
      .set('Cookie', cookieAdmin)
      .send({ papel: 'superusuario' });

    assert.equal(resposta.status, 400);
  });

  it('impede rebaixar o ÚLTIMO administrador ativo', async () => {
    // Rebaixa o funcionário (ainda restam 1 admin: o dono)...
    const rebaixarFuncionario = await request(app)
      .patch(`/api/usuarios/${idCliente}/papel`)
      .set('Cookie', cookieAdmin)
      .send({ papel: 'cliente' });
    assert.equal(rebaixarFuncionario.status, 200);

    // ...mas agora o dono é o último admin e não pode se rebaixar.
    const donoLogado = await request(app)
      .get('/api/auth/eu')
      .set('Cookie', cookieAdmin);

    const resposta = await request(app)
      .patch(`/api/usuarios/${donoLogado.body.usuario.id}/papel`)
      .set('Cookie', cookieAdmin)
      .send({ papel: 'cliente' });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /último administrador/i);
  });
});
