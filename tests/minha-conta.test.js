import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { CPF_CLIENTE, criarAmbienteDeTeste } from './helpers/ambiente.js';

/**
 * Testes de "Minha conta": o usuário edita os PRÓPRIOS dados.
 * Telefone e endereço serão usados no fechamento do pedido (Fase 5).
 */
describe('Minha conta — edição dos próprios dados', () => {
  let app;
  let encerrar;
  let cookie;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());

    await request(app)
      .post('/api/auth/registrar')
      .send({ nome: 'Cliente Editavel', cpf: CPF_CLIENTE, senha: 'senha123' });

    cookie = (
      await request(app).post('/api/auth/login').send({ cpf: CPF_CLIENTE, senha: 'senha123' })
    ).headers['set-cookie'];
  });

  after(() => encerrar());

  it('visitante não edita nada (401)', async () => {
    const resposta = await request(app).patch('/api/auth/minha-conta').send({ nome: 'Invasor' });

    assert.equal(resposta.status, 401);
  });

  it('atualiza nome, telefone e endereço', async () => {
    const resposta = await request(app)
      .patch('/api/auth/minha-conta')
      .set('Cookie', cookie)
      .send({
        nome: 'Cliente Editavel da Silva',
        telefone: '(21) 99999-8888',
        cep: '20040-020',
        endereco: 'Rua das Assombrações',
        numero: '123',
        complemento: 'apto 42',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
      });

    assert.equal(resposta.status, 200);
    assert.match(resposta.body.mensagem, /atualizados/i);
    assert.equal(resposta.body.usuario.nome, 'Cliente Editavel da Silva');
    // máscaras são removidas: guardamos só os dígitos
    assert.equal(resposta.body.usuario.telefone, '21999998888');
    assert.equal(resposta.body.usuario.cep, '20040020');
    assert.equal(resposta.body.usuario.endereco, 'Rua das Assombrações');
    assert.equal(resposta.body.usuario.numero, '123');
    assert.equal(resposta.body.usuario.complemento, 'apto 42');
    assert.equal(resposta.body.usuario.bairro, 'Centro');
    assert.equal(resposta.body.usuario.cidade, 'Rio de Janeiro');
    // e nunca devolvemos o hash da senha
    assert.equal(resposta.body.usuario.senhaHash, undefined);
  });

  it('os dados ficam salvos de verdade (GET /api/auth/eu confirma)', async () => {
    const resposta = await request(app).get('/api/auth/eu').set('Cookie', cookie);

    assert.equal(resposta.body.usuario.telefone, '21999998888');
    assert.equal(resposta.body.usuario.cidade, 'Rio de Janeiro');
  });

  it('recusa nome com menos de 3 caracteres', async () => {
    const resposta = await request(app)
      .patch('/api/auth/minha-conta')
      .set('Cookie', cookie)
      .send({ nome: 'Jo' });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /mínimo 3/i);
  });

  it('recusa telefone com quantidade de dígitos inválida', async () => {
    const resposta = await request(app)
      .patch('/api/auth/minha-conta')
      .set('Cookie', cookie)
      .send({ nome: 'Cliente Editavel', telefone: '1234' });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /Telefone inválido/i);
  });

  it('recusa CEP que não tenha 8 dígitos', async () => {
    const resposta = await request(app)
      .patch('/api/auth/minha-conta')
      .set('Cookie', cookie)
      .send({ nome: 'Cliente Editavel', cep: '123' });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /CEP inválido/i);
  });

  it('campos de contato vazios são aceitos (viram nulo)', async () => {
    const resposta = await request(app)
      .patch('/api/auth/minha-conta')
      .set('Cookie', cookie)
      .send({ nome: 'Cliente Sem Endereco', telefone: '', cep: '' });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.usuario.telefone, null);
    assert.equal(resposta.body.usuario.cep, null);
  });
});
