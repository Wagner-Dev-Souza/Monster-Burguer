import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * Fase 2 — PRODUTOS + FICHA TÉCNICA + MARGEM.
 *
 * Este é o teste mais importante da fase: provamos a conta que o dono vai usar
 * para decidir preço — custo de produção e margem de cada sanduíche.
 */
describe('Produtos e ficha técnica (Fase 2)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;
  let ingredientes;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);
    cookieCliente = await cadastrarELogarCliente(app);

    // Três ingredientes: pão (por unidade), carne e queijo (por kg)
    const criar = async (nome, unidade, custoUnitario) =>
      (await request(app).post('/api/ingredientes').set('Cookie', cookieAdmin)
        .send({ nome, unidade, custoUnitario })).body.ingrediente;

    ingredientes = {
      pao: await criar('Pão brioche', 'un', '1,50'),
      carne: await criar('Carne bovina', 'kg', '40,00'),
      queijo: await criar('Queijo mussarela', 'kg', '50,00'),
    };
  });

  after(() => encerrar());

  it('cliente não vê produtos pelo endpoint administrativo (403)', async () => {
    const resposta = await request(app).get('/api/produtos').set('Cookie', cookieCliente);

    assert.equal(resposta.status, 403);
  });

  it('cadastra um LANCHE (custo começa zerado e sem ficha técnica)', async () => {
    const resposta = await request(app)
      .post('/api/produtos')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '29,90', descricao: 'Duplo com cheddar' });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.produto.precoVenda, 29.9);
    assert.equal(resposta.body.produto.custo, 0);
    assert.equal(resposta.body.produto.temFichaTecnica, false);
    // Margem de lanche sem ficha técnica NÃO é confiável — o front é avisado:
    assert.equal(resposta.body.produto.custoConfiavel, false);
  });

  it('valida tipo, preço e estoque', async () => {
    const tipoRuim = await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Produto Estranho', tipo: 'sobremesa', precoVenda: 10 });
    assert.equal(tipoRuim.status, 400);

    const precoRuim = await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Produto Sem Preço', tipo: 'lanche', precoVenda: 0 });
    assert.equal(precoRuim.status, 400);

    const estoqueRuim = await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Bebida Estranha', tipo: 'bebida', precoVenda: 5, estoque: -3 });
    assert.equal(estoqueRuim.status, 400);
  });

  it('cadastra uma BEBIDA: custo vem da compra (revenda) e a margem já sai pronta', async () => {
    const resposta = await request(app)
      .post('/api/produtos')
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Refrigerante lata', tipo: 'bebida', precoVenda: '6,00', custoCompra: '3,50', estoque: 24 });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.produto.custo, 3.5);
    assert.equal(resposta.body.produto.custoOrigem, 'compra');
    assert.equal(resposta.body.produto.margemValor, 2.5);
    assert.equal(resposta.body.produto.margemPercentual, 41.67); // 2,50 / 6,00
    assert.equal(resposta.body.produto.estoque, 24);
    assert.equal(resposta.body.produto.custoConfiavel, true);
  });

  it('recusa dois produtos ativos com o mesmo nome', async () => {
    const resposta = await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: 20 });

    assert.equal(resposta.status, 409);
  });

  it('salva a FICHA TÉCNICA e calcula custo e margem exatos', async () => {
    const lista = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    const lanche = lista.body.produtos.find((p) => p.nome === 'Monster do Frank');

    const resposta = await request(app)
      .put(`/api/produtos/${lanche.id}/composicao`)
      .set('Cookie', cookieAdmin)
      .send({
        itens: [
          { ingredienteId: ingredientes.pao.id, quantidade: 1 },      // 1 x 1,50   = 1,50
          { ingredienteId: ingredientes.carne.id, quantidade: 0.15 }, // 0,15 x 40  = 6,00
          { ingredienteId: ingredientes.queijo.id, quantidade: 0.04 } // 0,04 x 50  = 2,00
        ],
      });

    assert.equal(resposta.status, 200);

    const produto = resposta.body.produto;
    assert.equal(produto.custo, 9.5);              // R$ 9,50 de custo de produção
    assert.equal(produto.margemValor, 20.4);       // 29,90 - 9,50
    assert.equal(produto.margemPercentual, 68.23); // 20,40 / 29,90
    assert.equal(produto.temFichaTecnica, true);
    assert.equal(produto.custoConfiavel, true);
    assert.equal(produto.composicao.itens.length, 3);

    // O custo de cada item da ficha também é calculado:
    const carne = produto.composicao.itens.find((i) => i.nome === 'Carne bovina');
    assert.equal(carne.custoTotal, 6);
  });

  it('a ficha técnica é SUBSTITUÍDA por inteiro (não acumula itens)', async () => {
    const lista = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    const lanche = lista.body.produtos.find((p) => p.nome === 'Monster do Frank');

    const resposta = await request(app)
      .put(`/api/produtos/${lanche.id}/composicao`)
      .set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId: ingredientes.pao.id, quantidade: 2 }] }); // só pão agora

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.produto.composicao.itens.length, 1);
    assert.equal(resposta.body.produto.custo, 3); // 2 x 1,50
  });

  it('recusa ficha técnica com quantidade inválida', async () => {
    const lista = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    const lanche = lista.body.produtos.find((p) => p.nome === 'Monster do Frank');

    const resposta = await request(app)
      .put(`/api/produtos/${lanche.id}/composicao`)
      .set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId: ingredientes.pao.id, quantidade: 0 }] });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /maior que zero/i);
  });

  it('recusa o mesmo ingrediente duas vezes na ficha', async () => {
    const lista = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    const lanche = lista.body.produtos.find((p) => p.nome === 'Monster do Frank');

    const resposta = await request(app)
      .put(`/api/produtos/${lanche.id}/composicao`)
      .set('Cookie', cookieAdmin)
      .send({
        itens: [
          { ingredienteId: ingredientes.pao.id, quantidade: 1 },
          { ingredienteId: ingredientes.pao.id, quantidade: 2 },
        ],
      });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /mesmo ingrediente/i);
  });

  it('recusa ingrediente inexistente (404)', async () => {
    const lista = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    const lanche = lista.body.produtos.find((p) => p.nome === 'Monster do Frank');

    const resposta = await request(app)
      .put(`/api/produtos/${lanche.id}/composicao`)
      .set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId: 99999, quantidade: 1 }] });

    assert.equal(resposta.status, 404);
  });

  it('BEBIDA não aceita ficha técnica (o custo dela é a compra)', async () => {
    const lista = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    const bebida = lista.body.produtos.find((p) => p.tipo === 'bebida');

    const resposta = await request(app)
      .put(`/api/produtos/${bebida.id}/composicao`)
      .set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId: ingredientes.pao.id, quantidade: 1 }] });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /Só lanches têm ficha técnica/i);
  });

  it('mudar o preço de venda recalcula a margem (sem tocar na ficha)', async () => {
    const lista = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    const lanche = lista.body.produtos.find((p) => p.nome === 'Monster do Frank');

    const resposta = await request(app)
      .put(`/api/produtos/${lanche.id}`)
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '19,90', descricao: 'Promoção' });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.produto.custo, 3);       // ficha continua igual (2 pães)
    assert.equal(resposta.body.produto.margemValor, 16.9);
  });

  it('filtra por tipo e desativa produto (soft delete)', async () => {
    const bebidas = await request(app).get('/api/produtos?tipo=bebida').set('Cookie', cookieAdmin);
    assert.ok(bebidas.body.produtos.every((p) => p.tipo === 'bebida'));

    const alvo = bebidas.body.produtos[0];
    const desativar = await request(app).delete(`/api/produtos/${alvo.id}`).set('Cookie', cookieAdmin);
    assert.equal(desativar.status, 200);
    assert.equal(desativar.body.produto.ativo, false);

    const ativos = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    assert.ok(!ativos.body.produtos.some((p) => p.id === alvo.id));

    // o nome fica livre para um novo produto
    const recriar = await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: alvo.nome, tipo: 'bebida', precoVenda: 7, custoCompra: 4, estoque: 10 });
    assert.equal(recriar.status, 201);
  });

  it('tipo inválido no filtro da lista dá 400', async () => {
    const resposta = await request(app).get('/api/produtos?tipo=sobremesa').set('Cookie', cookieAdmin);

    assert.equal(resposta.status, 400);
  });
});
