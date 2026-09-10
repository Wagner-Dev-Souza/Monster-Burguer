import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * Fase 2 — INGREDIENTES (os componentes dos lanches).
 * Também provamos que a área é fechada para quem não é admin E que o dinheiro
 * é tratado em CENTAVOS no banco (sem erro de arredondamento).
 */
describe('Ingredientes (Fase 2)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);
    cookieCliente = await cadastrarELogarCliente(app);
  });

  after(() => encerrar());

  it('visitante não acessa (401)', async () => {
    const resposta = await request(app).get('/api/ingredientes');

    assert.equal(resposta.status, 401);
  });

  it('cliente não acessa custos (403) — informação estratégica da loja', async () => {
    const resposta = await request(app).get('/api/ingredientes').set('Cookie', cookieCliente);

    assert.equal(resposta.status, 403);
    assert.equal(resposta.body.codigo, 'ACESSO_NEGADO');
  });

  it('a lista já vem com as unidades permitidas (para montar o select)', async () => {
    const resposta = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);

    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body.unidades, ['un', 'g', 'kg', 'ml', 'l', 'fatia', 'porcao']);
  });

  it('cadastra ingrediente e converte reais em centavos', async () => {
    const resposta = await request(app)
      .post('/api/ingredientes')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Pão brioche', unidade: 'un', custoUnitario: '1,50' });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.ingrediente.nome, 'Pão brioche');
    assert.equal(resposta.body.ingrediente.custoUnitario, 1.5); // R$ 1,50 (banco: 150 centavos)
  });

  it('recusa nome muito curto', async () => {
    const resposta = await request(app)
      .post('/api/ingredientes')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'X', unidade: 'un', custoUnitario: 1 });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /mínimo 2/i);
  });

  it('recusa unidade fora da lista permitida', async () => {
    const resposta = await request(app)
      .post('/api/ingredientes')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Bacon', unidade: 'saco', custoUnitario: 20 });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /Unidade inválida/i);
  });

  it('recusa custo inválido', async () => {
    const resposta = await request(app)
      .post('/api/ingredientes')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Alface', unidade: 'kg', custoUnitario: 'abc' });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /Custo unitário inválido/i);
  });

  it('recusa dois ingredientes ativos com o mesmo nome', async () => {
    const resposta = await request(app)
      .post('/api/ingredientes')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Pão brioche', unidade: 'un', custoUnitario: 2 });

    assert.equal(resposta.status, 409);
  });

  it('atualiza um ingrediente (PUT)', async () => {
    const lista = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    const pao = lista.body.ingredientes.find((i) => i.nome === 'Pão brioche');

    const resposta = await request(app)
      .put(`/api/ingredientes/${pao.id}`)
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Pão brioche', unidade: 'un', custoUnitario: '1,75' });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.ingrediente.custoUnitario, 1.75);
  });

  it('desativa ingrediente e o nome volta a ficar disponível', async () => {
    const lista = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    const alvo = lista.body.ingredientes.find((i) => i.nome === 'Pão brioche');

    const desativar = await request(app).delete(`/api/ingredientes/${alvo.id}`).set('Cookie', cookieAdmin);
    assert.equal(desativar.status, 200);
    assert.equal(desativar.body.ingrediente.ativo, false);

    // sai da lista padrão...
    const ativos = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    assert.ok(!ativos.body.ingredientes.some((i) => i.id === alvo.id));

    // ...mas continua visível com ?todos=1
    const todos = await request(app).get('/api/ingredientes?todos=1').set('Cookie', cookieAdmin);
    assert.ok(todos.body.ingredientes.some((i) => i.id === alvo.id));

    // e o nome pode ser reutilizado (índice único é PARCIAL: só entre ativos)
    const recriar = await request(app)
      .post('/api/ingredientes')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Pão brioche', unidade: 'un', custoUnitario: 2 });

    assert.equal(recriar.status, 201);
  });

  it('não deixa desativar duas vezes', async () => {
    const lista = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    const alvo = lista.body.ingredientes[0];

    await request(app).delete(`/api/ingredientes/${alvo.id}`).set('Cookie', cookieAdmin);
    const segunda = await request(app).delete(`/api/ingredientes/${alvo.id}`).set('Cookie', cookieAdmin);

    assert.equal(segunda.status, 400);
    assert.match(segunda.body.erro, /já está desativado/i);
  });
});
