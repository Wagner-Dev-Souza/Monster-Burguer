import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * FASE 3 — Compras (despesas) e CUSTO MÉDIO PONDERADO.
 *
 * O teste central desta fase: comprar caro faz o custo do lanche subir sozinho.
 * É o que liga a despesa da loja ao custo do produto e, no fim, à margem.
 */
describe('Compras e despesas (Fase 3)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;
  let ingredienteId;
  let bebidaId;
  let lancheId;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);
    cookieCliente = await cadastrarELogarCliente(app);

    ingredienteId = (await request(app).post('/api/ingredientes').set('Cookie', cookieAdmin)
      .send({ nome: 'Carne bovina', unidade: 'kg', custoUnitario: '10,00' })).body.ingrediente.id;

    lancheId = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '30,00' })).body.produto.id;

    await request(app).put(`/api/produtos/${lancheId}/composicao`).set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId, quantidade: 0.5 }] }); // 0,5 kg por lanche

    bebidaId = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Refrigerante lata', tipo: 'bebida', precoVenda: '6,00', custoCompra: '3,00', estoque: 0 }))
      .body.produto.id;
  });

  after(() => encerrar());

  it('cliente não acessa despesas (403)', async () => {
    const resposta = await request(app).get('/api/compras').set('Cookie', cookieCliente);

    assert.equal(resposta.status, 403);
  });

  it('compra de ingrediente vira CUSTO MÉDIO PONDERADO', async () => {
    // 10 kg por R$ 400,00 -> R$ 40,00/kg
    const primeira = await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'ingrediente', ingredienteId, quantidade: 10, valorTotal: '400,00', fornecedor: 'Frigorífico do Zé' });

    assert.equal(primeira.status, 201);
    assert.equal(primeira.body.custoUnitarioAtualizado, 40); // R$ 40,00
    assert.equal(primeira.body.compra.valorUnitario, 40);
    assert.equal(primeira.body.compra.fornecedor, 'Frigorífico do Zé');

    // segunda compra: 10 kg por R$ 500,00 -> média (400+500)/20 = R$ 45,00/kg
    const segunda = await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'ingrediente', ingredienteId, quantidade: 10, valorTotal: '500,00' });

    assert.equal(segunda.body.custoUnitarioAtualizado, 45);

    // e o custo do ingrediente está realmente atualizado
    const ingredientes = await request(app).get('/api/ingredientes').set('Cookie', cookieAdmin);
    const carne = ingredientes.body.ingredientes.find((i) => i.id === ingredienteId);
    assert.equal(carne.custoUnitario, 45);
  });

  it('o custo novo do ingrediente recalcula a margem do lanche (ficha técnica)', async () => {
    // 0,5 kg x R$ 45,00 = R$ 22,50 de custo; preço R$ 30,00 -> margem R$ 7,50
    const produtos = await request(app).get('/api/produtos').set('Cookie', cookieAdmin);
    const lanche = produtos.body.produtos.find((p) => p.id === lancheId);

    assert.equal(lanche.custo, 22.5);
    assert.equal(lanche.margemValor, 7.5);
    assert.equal(lanche.margemPercentual, 25);
  });

  it('compra de BEBIDA aumenta o estoque e atualiza o custo de compra', async () => {
    // 24 latas por R$ 84,00 -> R$ 3,50 cada
    const resposta = await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'produto', produtoId: bebidaId, quantidade: 24, valorTotal: '84,00' });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.custoUnitarioAtualizado, 3.5);
    assert.equal(resposta.body.estoqueAtualizado, 24);

    const produtos = await request(app).get('/api/produtos?tipo=bebida').set('Cookie', cookieAdmin);
    const bebida = produtos.body.produtos.find((p) => p.id === bebidaId);
    assert.equal(bebida.estoque, 24);
    assert.equal(bebida.custoCompra, 3.5);
  });

  it('valida os dados da compra', async () => {
    const semQuantidade = await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'ingrediente', ingredienteId, valorTotal: '100,00' });
    assert.equal(semQuantidade.status, 400);

    const valorZero = await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'ingrediente', ingredienteId, quantidade: 1, valorTotal: 0 });
    assert.equal(valorZero.status, 400);

    const tipoRuim = await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'sobremesa', quantidade: 1, valorTotal: 10 });
    assert.equal(tipoRuim.status, 400);

    const inexistente = await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'ingrediente', ingredienteId: 99999, quantidade: 1, valorTotal: 10 });
    assert.equal(inexistente.status, 404);
  });

  it('não aceita compra de LANCHE como produto (lanche se produz, não se revende)', async () => {
    const resposta = await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'produto', produtoId: lancheId, quantidade: 1, valorTotal: '20,00' });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /BEBIDAS/i);
  });

  it('excluir uma compra recalcula o custo médio e devolve o estoque', async () => {
    const lista = await request(app).get('/api/compras').set('Cookie', cookieAdmin);
    const compraDaBebida = lista.body.compras.find((c) => c.tipo === 'produto');

    const excluir = await request(app).delete(`/api/compras/${compraDaBebida.id}`).set('Cookie', cookieAdmin);
    assert.equal(excluir.status, 200);

    // a bebida volta a ficar sem estoque de compras (mas mantém o custo anterior)
    const produtos = await request(app).get('/api/produtos?tipo=bebida').set('Cookie', cookieAdmin);
    const bebida = produtos.body.produtos.find((p) => p.id === bebidaId);
    assert.equal(bebida.estoque, 0);
  });

  it('o resumo mostra o total de despesas', async () => {
    const resposta = await request(app).get('/api/compras').set('Cookie', cookieAdmin);

    // sobraram as duas compras de carne: R$ 400,00 + R$ 500,00
    assert.equal(resposta.body.resumo.totalDespesas, 900);
    assert.equal(resposta.body.resumo.quantidadeCompras, 2);
    assert.ok(resposta.body.resumo.despesasDoMes > 0);
  });

  it('filtro por tipo', async () => {
    const resposta = await request(app).get('/api/compras?tipo=produto').set('Cookie', cookieAdmin);

    assert.ok(resposta.body.compras.every((compra) => compra.tipo === 'produto'));
  });
});
