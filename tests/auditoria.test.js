import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { CPF_CLIENTE } from './helpers/ambiente.js';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * AUDITORIA — quem fez o quê no sistema.
 *
 * O pedido do cliente: "atribuir um id simples por cliente/admin para que fique
 * registrado quem fez cada solicitação ou alteração". Aqui provamos que o
 * registro existe, identifica a pessoa (com o código #0001...) e é visível
 * apenas para admin.
 */
describe('Auditoria (quem fez o quê)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);
    cookieCliente = await cadastrarELogarCliente(app); // gera registros de cadastro e entrada
  });

  after(() => encerrar());

  it('visitante não vê o histórico (401)', async () => {
    const resposta = await request(app).get('/api/auditoria');

    assert.equal(resposta.status, 401);
  });

  it('cliente não vê o histórico (403)', async () => {
    const resposta = await request(app).get('/api/auditoria').set('Cookie', cookieCliente);

    assert.equal(resposta.status, 403);
    assert.equal(resposta.body.codigo, 'ACESSO_NEGADO');
  });

  it('registra o cadastro e a entrada no sistema', async () => {
    const resposta = await request(app).get('/api/auditoria').set('Cookie', cookieAdmin);

    const acoes = resposta.body.historico.map((registro) => registro.acao);
    assert.ok(acoes.includes('cadastro'), 'esperava o registro do cadastro');
    assert.ok(acoes.includes('entrar'), 'esperava o registro da entrada');
  });

  it('cada registro identifica QUEM fez, com nome e código simples (#0001)', async () => {
    const resposta = await request(app).get('/api/auditoria').set('Cookie', cookieAdmin);
    const registro = resposta.body.historico.find((linha) => linha.acao === 'cadastro');

    assert.ok(registro, 'esperava um registro de cadastro');
    assert.match(registro.usuarioCodigo, /^#\d{4}$/);
    assert.ok(registro.usuarioNome.length > 0);
    assert.equal(registro.usuarioPapel, 'cliente');
    assert.equal(registro.entidade, 'usuario');
    assert.ok(registro.criadoEm);
    assert.match(registro.detalhe, /Novo cadastro/);
  });

  it('registra as alterações feitas pelo admin (ingrediente, produto e ficha técnica)', async () => {
    const ingrediente = (await request(app).post('/api/ingredientes').set('Cookie', cookieAdmin)
      .send({ nome: 'Queijo mussarela', unidade: 'kg', custoUnitario: '50,00' })).body.ingrediente;

    const produto = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '29,90' })).body.produto;

    await request(app).put(`/api/produtos/${produto.id}/composicao`).set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId: ingrediente.id, quantidade: 0.04 }] });

    const resposta = await request(app).get('/api/auditoria?entidade=produto').set('Cookie', cookieAdmin);
    const acoes = resposta.body.historico.map((registro) => registro.acao);

    assert.ok(acoes.includes('criar'));
    assert.ok(acoes.includes('ficha-tecnica'));

    // e o registro diz quem foi (o admin #0001) e o que mudou
    const ficha = resposta.body.historico.find((registro) => registro.acao === 'ficha-tecnica');
    assert.equal(ficha.usuarioCodigo, '#0001');
    assert.equal(ficha.usuarioPapel, 'admin');
    assert.match(ficha.detalhe, /Monster do Frank/);
    assert.match(ficha.detalhe, /margem/);
  });

  it('registra também a promoção/rebaixamento de usuário', async () => {
    const usuarios = await request(app).get('/api/usuarios').set('Cookie', cookieAdmin);
    const cliente = usuarios.body.usuarios.find((usuario) => usuario.cpf === CPF_CLIENTE);

    await request(app).patch(`/api/usuarios/${cliente.id}/papel`).set('Cookie', cookieAdmin)
      .send({ papel: 'admin' });

    const resposta = await request(app).get('/api/auditoria?entidade=usuario').set('Cookie', cookieAdmin);
    const promocao = resposta.body.historico.find((registro) => registro.acao === 'promover');

    assert.ok(promocao, 'esperava o registro da promoção');
    assert.match(promocao.detalhe, /agora é admin/);
  });

  it('a fotografia do papel não muda depois (auditoria é registro histórico)', async () => {
    // O usuário que se cadastrou como cliente e depois foi promovido: o registro
    // do CADASTRO continua dizendo "cliente", porque foi assim naquele momento.
    const resposta = await request(app).get('/api/auditoria?entidade=usuario').set('Cookie', cookieAdmin);
    const cadastro = resposta.body.historico.find((registro) => registro.acao === 'cadastro');

    assert.equal(cadastro.usuarioPapel, 'cliente');
  });

  it('respeita o limite e recusa valor inválido', async () => {
    const comLimite = await request(app).get('/api/auditoria?limite=2').set('Cookie', cookieAdmin);
    assert.equal(comLimite.body.historico.length, 2);

    const invalido = await request(app).get('/api/auditoria?limite=999').set('Cookie', cookieAdmin);
    assert.equal(invalido.status, 400);
  });
});
