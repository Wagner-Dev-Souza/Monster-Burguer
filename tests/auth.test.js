import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { CPF_CLIENTE, CPF_OUTRO_CLIENTE, criarAmbienteDeTeste } from './helpers/ambiente.js';

/**
 * Fase 1 — Cadastro, login e sessão.
 *
 * ⚠️ LIÇÃO DE TESTE: a conexão com o banco é um "singleton" — ela é aberta
 * UMA vez, quando o módulo é importado. Logo, não dá para criar um banco novo
 * a cada `describe` dentro do mesmo arquivo (o segundo describe continuaria
 * usando o banco do primeiro).
 *
 * Solução adotada: UM ambiente por ARQUIVO de teste. Como o `node --test` roda
 * cada arquivo em um processo separado, o isolamento entre arquivos é garantido.
 */
describe('Fase 1 — Cadastro e login', () => {
  let app;
  let encerrar;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
  });

  after(() => encerrar());

  describe('Cadastro de cliente', () => {
    it('cadastra cliente com sucesso, como CLIENTE e já com sessão', async () => {
      const resposta = await request(app)
        .post('/api/auth/registrar')
        .send({ nome: 'Maria Teste', cpf: CPF_CLIENTE, senha: 'senha123' });

      assert.equal(resposta.status, 201);
      assert.equal(resposta.body.usuario.nome, 'Maria Teste');
      // REGRA DE OURO: ninguém nasce admin pelo cadastro público.
      assert.equal(resposta.body.usuario.papel, 'cliente');
      // A senha (nem o hash) nunca sai na resposta.
      assert.equal(resposta.body.usuario.senhaHash, undefined);
      // Já sai logado: cookie HttpOnly com o token.
      assert.match(resposta.headers['set-cookie'][0], /token=/);
    });

    it('recusa CPF com dígito verificador inválido', async () => {
      const resposta = await request(app)
        .post('/api/auth/registrar')
        .send({ nome: 'Fulano', cpf: '11111111111', senha: 'senha123' });

      assert.equal(resposta.status, 400);
      assert.match(resposta.body.erro, /CPF inválido/i);
    });

    it('recusa CPF já cadastrado', async () => {
      const resposta = await request(app)
        .post('/api/auth/registrar')
        .send({ nome: 'Outra Pessoa', cpf: CPF_CLIENTE, senha: 'senha123' });

      assert.equal(resposta.status, 409);
      assert.match(resposta.body.erro, /já existe/i);
    });

    it('recusa senha com menos de 6 caracteres', async () => {
      const resposta = await request(app)
        .post('/api/auth/registrar')
        .send({ nome: 'Senha Curta', cpf: CPF_OUTRO_CLIENTE, senha: '123' });

      assert.equal(resposta.status, 400);
      assert.match(resposta.body.erro, /pelo menos 6/i);
    });
  });

  describe('Login e sessão', () => {
    it('autentica com CPF e senha corretos e devolve o usuário', async () => {
      const resposta = await request(app)
        .post('/api/auth/login')
        .send({ cpf: CPF_CLIENTE, senha: 'senha123' });

      assert.equal(resposta.status, 200);
      assert.equal(resposta.body.usuario.nome, 'Maria Teste');
      assert.equal(resposta.body.usuario.papel, 'cliente');
      assert.match(resposta.headers['set-cookie'][0], /token=/);
    });

    it('aceita CPF com máscara (pontos e traço)', async () => {
      const resposta = await request(app)
        .post('/api/auth/login')
        .send({ cpf: '529.982.247-25', senha: 'senha123' });

      assert.equal(resposta.status, 200);
    });

    it('recusa senha errada com 401', async () => {
      const resposta = await request(app)
        .post('/api/auth/login')
        .send({ cpf: CPF_CLIENTE, senha: 'senha-errada' });

      assert.equal(resposta.status, 401);
    });

    it('recusa CPF não cadastrado com a MESMA mensagem (não entrega pistas)', async () => {
      const resposta = await request(app)
        .post('/api/auth/login')
        .send({ cpf: CPF_OUTRO_CLIENTE, senha: 'senha123' });

      assert.equal(resposta.status, 401);
      assert.match(resposta.body.erro, /CPF ou senha inválidos/i);
    });

    it('GET /api/auth/eu devolve o usuário logado quando há cookie', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ cpf: CPF_CLIENTE, senha: 'senha123' });

      const resposta = await request(app)
        .get('/api/auth/eu')
        .set('Cookie', login.headers['set-cookie']);

      assert.equal(resposta.status, 200);
      assert.equal(resposta.body.usuario.cpf, CPF_CLIENTE);
    });

    it('GET /api/auth/eu responde 401 sem cookie', async () => {
      const resposta = await request(app).get('/api/auth/eu');

      assert.equal(resposta.status, 401);
      assert.equal(resposta.body.codigo, 'NAO_AUTENTICADO');
    });

    it('logout limpa o cookie de sessão', async () => {
      const resposta = await request(app).post('/api/auth/logout');

      assert.equal(resposta.status, 204);
      assert.match(resposta.headers['set-cookie'][0], /token=;/);
    });
  });
});
