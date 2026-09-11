import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * Fase 2 — INGREDIENTES: CRUD com EXCLUSÃO DE VERDADE (pedido do cliente).
 *
 * Regras provadas aqui:
 *  * a área é fechada para quem não é admin
 *  * dinheiro vai e volta em reais, mas é gravado em centavos
 *  * DELETE apaga de verdade — e é bloqueado se alguma ficha técnica usa o item
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

  it('recusa dois ingredientes com o mesmo nome', async () => {
    const resposta = await request(app)
      .post('/api/ingredientes')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Pão brioche', unidade: 'un', custoUnitario: 2 });

    assert.equal(resposta.status, 409);
  });

  it('EDITA um ingrediente (PUT) — o botão Editar da tabela', async () => {
    const lista = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    const pao = lista.body.ingredientes.find((i) => i.nome === 'Pão brioche');

    const resposta = await request(app)
      .put(`/api/ingredientes/${pao.id}`)
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Pão brioche', unidade: 'un', custoUnitario: '1,75' });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.ingrediente.custoUnitario, 1.75);
  });

  it('EXCLUI de verdade (DELETE) e o nome volta a ficar disponível', async () => {
    const lista = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    const pao = lista.body.ingredientes.find((i) => i.nome === 'Pão brioche');

    const excluir = await request(app).delete(`/api/ingredientes/${pao.id}`).set('Cookie', cookieAdmin);
    assert.equal(excluir.status, 200);
    assert.match(excluir.body.mensagem, /excluído/i);

    // sumiu da lista
    const depois = await request(app).get('/api/ingredientes?todos=1').set('Cookie', cookieAdmin);
    assert.ok(!depois.body.ingredientes.some((i) => i.id === pao.id));

    // o nome está livre de novo (não é exclusão lógica: a linha foi apagada)
    const recriar = await request(app)
      .post('/api/ingredientes')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Pão brioche', unidade: 'un', custoUnitario: 2 });

    assert.equal(recriar.status, 201);
  });

  it('excluir duas vezes dá 404 (o registro não existe mais)', async () => {
    const lista = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    const alvo = lista.body.ingredientes[0];

    await request(app).delete(`/api/ingredientes/${alvo.id}`).set('Cookie', cookieAdmin);
    const segunda = await request(app).delete(`/api/ingredientes/${alvo.id}`).set('Cookie', cookieAdmin);

    assert.equal(segunda.status, 404);
    assert.match(segunda.body.erro, /não encontrado/i);
  });

  it('NÃO exclui ingrediente que está em ficha técnica (409 com os nomes dos lanches)', async () => {
    // cria ingrediente + produto + ficha técnica usando esse ingrediente
    const ingrediente = (await request(app).post('/api/ingredientes').set('Cookie', cookieAdmin)
      .send({ nome: 'Cheddar cremoso', unidade: 'kg', custoUnitario: '38,00' })).body.ingrediente;

    const produto = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Monster Cheddar', tipo: 'lanche', precoVenda: '24,90' })).body.produto;

    await request(app).put(`/api/produtos/${produto.id}/composicao`).set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId: ingrediente.id, quantidade: 0.05 }] });

    const resposta = await request(app).delete(`/api/ingredientes/${ingrediente.id}`).set('Cookie', cookieAdmin);

    assert.equal(resposta.status, 409);
    assert.match(resposta.body.erro, /está na ficha técnica/i);
    assert.match(resposta.body.erro, /Monster Cheddar/i);

    // continua existindo (a exclusão foi barrada)
    const lista = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    assert.ok(lista.body.ingredientes.some((i) => i.id === ingrediente.id));
  });

  it('DESATIVAR continua disponível como alternativa (item sai da lista, sem apagar)', async () => {
    const lista = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    const alvo = lista.body.ingredientes[0];

    const resposta = await request(app)
      .patch(`/api/ingredientes/${alvo.id}/desativar`)
      .set('Cookie', cookieAdmin)
      .send({});

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.ingrediente.ativo, false);

    const ativos = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    assert.ok(!ativos.body.ingredientes.some((i) => i.id === alvo.id));

    const todos = await request(app).get('/api/ingredientes?todos=1').set('Cookie', cookieAdmin);
    assert.ok(todos.body.ingredientes.some((i) => i.id === alvo.id));
  });
});
