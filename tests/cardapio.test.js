import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { criarAdminELogar } from './helpers/sessao.js';

/**
 * Fase 4 — CARDÁPIO PÚBLICO.
 *
 * O ponto crítico deste arquivo: garantir que CUSTO e MARGEM não vazem para o
 * cliente final. É o teste que protege o segredo comercial da loja.
 */
describe('Cardápio público (Fase 4)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let lancheId;
  let bebidaId;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);

    const ingrediente = (await request(app).post('/api/ingredientes').set('Cookie', cookieAdmin)
      .send({ nome: 'Pão brioche', unidade: 'un', custoUnitario: '1,50' })).body.ingrediente;

    const lanche = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '29,90', descricao: 'Duplo com cheddar' }))
      .body.produto;
    lancheId = lanche.id;

    await request(app).put(`/api/produtos/${lancheId}/composicao`).set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId: ingrediente.id, quantidade: 2 }] });

    const bebida = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Refrigerante lata', tipo: 'bebida', precoVenda: '6,00', custoCompra: '3,50', estoque: 10 }))
      .body.produto;
    bebidaId = bebida.id;
  });

  after(() => encerrar());

  it('o cardápio é PÚBLICO (não exige login)', async () => {
    const resposta = await request(app).get('/api/cardapio');

    assert.equal(resposta.status, 200);
  });

  it('agrupa em lanches e bebidas, com nome, descrição e preço', async () => {
    const resposta = await request(app).get('/api/cardapio');

    assert.equal(resposta.body.lanches.length, 1);
    assert.equal(resposta.body.bebidas.length, 1);
    assert.equal(resposta.body.lanches[0].nome, 'Monster do Frank');
    assert.equal(resposta.body.lanches[0].descricao, 'Duplo com cheddar');
    assert.equal(resposta.body.lanches[0].precoVenda, 29.9);
    assert.equal(resposta.body.bebidas[0].precoVenda, 6);
  });

  it('🔒 NÃO vaza custo, margem, ficha técnica nem estoque', async () => {
    const resposta = await request(app).get('/api/cardapio');
    const itemDoCliente = resposta.body.lanches[0];

    // a ficha técnica e o custo existem internamente, mas não podem sair daqui
    assert.equal(itemDoCliente.custo, undefined);
    assert.equal(itemDoCliente.margemValor, undefined);
    assert.equal(itemDoCliente.margemPercentual, undefined);
    assert.equal(itemDoCliente.custoConfiavel, undefined);
    assert.equal(itemDoCliente.composicao, undefined);
    assert.equal(itemDoCliente.itensFicha, undefined);
    assert.equal(itemDoCliente.estoque, undefined);
    assert.equal(itemDoCliente.custoCompra, undefined);

    // só o que o cliente precisa saber:
    // id, nome, descrição, tipo, arte do mascote, preço com promoção aplicada
    // e os campos que permitem mostrar "de/por" na tela.
    assert.deepEqual(
      Object.keys(itemDoCliente).sort(),
      ['descricao', 'id', 'mascote', 'nome', 'percentualDesconto', 'precoOriginal', 'precoVenda', 'tipo'],
    );
  });

  it('bebida sem estoque sai do cardápio (não tem como vender)', async () => {
    // zera o estoque da bebida
    await request(app).put(`/api/produtos/${bebidaId}`).set('Cookie', cookieAdmin)
      .send({ nome: 'Refrigerante lata', tipo: 'bebida', precoVenda: '6,00', custoCompra: '3,50', estoque: 0 });

    const resposta = await request(app).get('/api/cardapio');
    assert.equal(resposta.body.bebidas.length, 0);
  });

  it('produto desativado sai do cardápio na hora', async () => {
    await request(app).delete(`/api/produtos/${lancheId}`).set('Cookie', cookieAdmin);

    const resposta = await request(app).get('/api/cardapio');
    assert.equal(resposta.body.lanches.length, 0);
  });
});
