import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * FASE 7 — PROMOÇÕES por produto e CUPONS de desconto.
 *
 * O ponto mais importante testado aqui: o preço que o cliente VÊ no cardápio é o
 * mesmo que ele PAGA no pedido — promoção e cupom não podem divergir.
 */
describe('Promoções e cupons (Fase 7)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;
  let lancheId;

  const criarLanche = async (nome, preco) => (await request(app).post('/api/produtos')
    .set('Cookie', cookieAdmin)
    .send({ nome, tipo: 'lanche', precoVenda: preco })).body.produto.id;

  const completarCadastroDoCliente = () => request(app).patch('/api/auth/minha-conta')
    .set('Cookie', cookieCliente)
    .send({
      nome: 'Cliente Promo',
      telefone: '21988887777',
      cep: '20040020',
      endereco: 'Rua das Assombrações',
      numero: '1',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
    });

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);
    cookieCliente = await cadastrarELogarCliente(app);
    lancheId = await criarLanche('Monster do Frank', '30,00');
  });

  after(() => encerrar());

  it('só admin mexe em promoções e cupons (cliente toma 403)', async () => {
    const lista = await request(app).get('/api/promocoes').set('Cookie', cookieCliente);
    assert.equal(lista.status, 403);

    const criar = await request(app).post('/api/cupons').set('Cookie', cookieCliente)
      .send({ codigo: 'PIRATA10', percentual: 10 });
    assert.equal(criar.status, 403);
  });

  it('promoção de 20% muda o preço do cardápio e mostra o "de/por"', async () => {
    const resposta = await request(app).post('/api/promocoes').set('Cookie', cookieAdmin)
      .send({ produtoId: lancheId, percentual: 20 });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.promocao.percentual, 20);
    assert.equal(resposta.body.promocao.vigente, true);

    const cardapio = await request(app).get('/api/cardapio');
    const lanche = cardapio.body.lanches[0];

    assert.equal(lanche.precoVenda, 24);          // 30,00 - 20%
    assert.equal(lanche.precoOriginal, 30);
    assert.equal(lanche.percentualDesconto, 20);
  });

  it('o pedido usa o preço COM promoção (congelado no item)', async () => {
    await completarCadastroDoCliente();

    const resposta = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 2 }] });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.pedido.itens[0].precoUnitario, 24);
    assert.equal(resposta.body.pedido.itens[0].precoOriginal, 30); // quanto valia sem a promoção
    assert.equal(resposta.body.pedido.total, 48);
  });

  it('promoção fora do período NÃO aplica desconto', async () => {
    const outroLanche = await criarLanche('Monster Vencido', '40,00');

    // promoção que já terminou ontem
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const antesDeOntem = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    await request(app).post('/api/promocoes').set('Cookie', cookieAdmin)
      .send({ produtoId: outroLanche, percentual: 50, inicio: antesDeOntem, fim: ontem });

    const cardapio = await request(app).get('/api/cardapio');
    const lanche = cardapio.body.lanches.find((item) => item.id === outroLanche);

    assert.equal(lanche.precoVenda, 40);          // preço cheio
    assert.equal(lanche.percentualDesconto, null);
  });

  it('só UMA promoção fica ativa por produto (a nova desbanca a anterior)', async () => {
    await request(app).post('/api/promocoes').set('Cookie', cookieAdmin)
      .send({ produtoId: lancheId, percentual: 10 });

    const lista = await request(app).get('/api/promocoes?ativas=1').set('Cookie', cookieAdmin);
    const ativasDoLanche = lista.body.promocoes.filter((promocao) => promocao.produtoId === lancheId);

    assert.equal(ativasDoLanche.length, 1);
    assert.equal(ativasDoLanche[0].percentual, 10);

    // e o cardápio segue o novo desconto
    const cardapio = await request(app).get('/api/cardapio');
    assert.equal(cardapio.body.lanches.find((item) => item.id === lancheId).precoVenda, 27);
  });

  it('valida os dados da promoção', async () => {
    const semProduto = await request(app).post('/api/promocoes').set('Cookie', cookieAdmin)
      .send({ percentual: 10 });
    assert.equal(semProduto.status, 400);

    const percentualAlto = await request(app).post('/api/promocoes').set('Cookie', cookieAdmin)
      .send({ produtoId: lancheId, percentual: 95 });
    assert.equal(percentualAlto.status, 400);

    const dataInvertida = await request(app).post('/api/promocoes').set('Cookie', cookieAdmin)
      .send({ produtoId: lancheId, percentual: 10, inicio: '2026-12-31', fim: '2026-01-01' });
    assert.equal(dataInvertida.status, 400);
  });

  it('cria cupom e o cliente consegue VALIDAR antes de fechar o pedido', async () => {
    const criar = await request(app).post('/api/cupons').set('Cookie', cookieAdmin)
      .send({ codigo: 'monster10', percentual: 10, valorMinimo: '20,00', usosMaximos: 3 });

    assert.equal(criar.status, 201);
    assert.equal(criar.body.cupom.codigo, 'MONSTER10'); // normalizado em maiúsculas
    assert.equal(criar.body.cupom.valorMinimo, 20);

    // o cliente valida (inclusive digitando minúsculo)
    const validar = await request(app).post('/api/cupons/validar').set('Cookie', cookieCliente)
      .send({ codigo: 'monster10', subtotal: '48,00' });

    assert.equal(validar.status, 200);
    assert.equal(validar.body.percentual, 10);
    assert.equal(validar.body.desconto, 4.8);
    assert.equal(validar.body.novoTotal, 43.2);
  });

  it('cupom com pedido abaixo do mínimo é recusado com explicação', async () => {
    const resposta = await request(app).post('/api/cupons/validar').set('Cookie', cookieCliente)
      .send({ codigo: 'MONSTER10', subtotal: '10,00' });

    assert.equal(resposta.status, 409);
    assert.match(resposta.body.erro, /a partir de R\$ 20,00/i);
  });

  it('cupom inexistente dá 404', async () => {
    const resposta = await request(app).post('/api/cupons/validar').set('Cookie', cookieCliente)
      .send({ codigo: 'NAOEXISTE', subtotal: '50,00' });

    assert.equal(resposta.status, 404);
  });

  it('o cupom aplicado entra no pedido como desconto e o total cai', async () => {
    const resposta = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 2 }], cupom: 'MONSTER10' });

    assert.equal(resposta.status, 201);

    // 2 x 27,00 (promoção de 10%) = 54,00 - 10% de cupom = 48,60
    assert.equal(resposta.body.pedido.subtotal, 54);
    assert.equal(resposta.body.pedido.desconto, 5.4);
    assert.equal(resposta.body.pedido.cupomCodigo, 'MONSTER10');
    assert.equal(resposta.body.pedido.total, 48.6);
  });

  it('o cupom só conta uso quando o pedido é PAGO', async () => {
    const antes = await request(app).get('/api/cupons').set('Cookie', cookieAdmin);
    const usosAntes = antes.body.cupons.find((cupom) => cupom.codigo === 'MONSTER10').usos;

    // cria um pedido e NÃO paga: não deve consumir uso
    await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 2 }], cupom: 'MONSTER10' });

    const depoisDeCriar = await request(app).get('/api/cupons').set('Cookie', cookieAdmin);
    assert.equal(depoisDeCriar.body.cupons.find((cupom) => cupom.codigo === 'MONSTER10').usos, usosAntes);

    // agora paga: consome um uso
    const pedido = (await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 2 }], cupom: 'MONSTER10' })).body.pedido;

    await request(app).post(`/api/pedidos/${pedido.id}/pagar`).set('Cookie', cookieCliente)
      .send({ formaPagamento: 'pix' });

    const depoisDePagar = await request(app).get('/api/cupons').set('Cookie', cookieAdmin);
    assert.equal(depoisDePagar.body.cupons.find((cupom) => cupom.codigo === 'MONSTER10').usos, usosAntes + 1);
  });

  it('cupom esgotado é recusado', async () => {
    await request(app).post('/api/cupons').set('Cookie', cookieAdmin)
      .send({ codigo: 'ESGOTADO', percentual: 5, usosMaximos: 1 });

    // gasta o único uso
    const pedido = (await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }], cupom: 'ESGOTADO' })).body.pedido;

    await request(app).post(`/api/pedidos/${pedido.id}/pagar`).set('Cookie', cookieCliente)
      .send({ formaPagamento: 'pix' });

    const resposta = await request(app).post('/api/cupons/validar').set('Cookie', cookieCliente)
      .send({ codigo: 'ESGOTADO', subtotal: '50,00' });

    assert.equal(resposta.status, 409);
    assert.match(resposta.body.erro, /limite de usos/i);
  });

  it('cupom vencido e cupom desativado são recusados', async () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await request(app).post('/api/cupons').set('Cookie', cookieAdmin)
      .send({ codigo: 'VENCIDO', percentual: 5, validoAte: ontem });

    const vencido = await request(app).post('/api/cupons/validar').set('Cookie', cookieCliente)
      .send({ codigo: 'VENCIDO', subtotal: '50,00' });
    assert.equal(vencido.status, 409);
    assert.match(vencido.body.erro, /venceu/i);

    const cupom = (await request(app).post('/api/cupons').set('Cookie', cookieAdmin)
      .send({ codigo: 'DESLIGADO', percentual: 5 })).body.cupom;

    await request(app).put(`/api/cupons/${cupom.id}`).set('Cookie', cookieAdmin)
      .send({ percentual: 5, ativo: false });

    const desativado = await request(app).post('/api/cupons/validar').set('Cookie', cookieCliente)
      .send({ codigo: 'DESLIGADO', subtotal: '50,00' });
    assert.equal(desativado.status, 409);
    assert.match(desativado.body.erro, /desativado/i);
  });

  it('o cupom é revalidado na hora de CRIAR o pedido (não confia na tela)', async () => {
    // O cliente "aplica" na tela e o cupom é desativado antes do pedido sair:
    const resposta = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }], cupom: 'DESLIGADO' });

    assert.equal(resposta.status, 409);
    assert.match(resposta.body.erro, /desativado/i);
  });

  it('não aceita dois cupons com o mesmo código', async () => {
    const resposta = await request(app).post('/api/cupons').set('Cookie', cookieAdmin)
      .send({ codigo: 'MONSTER10', percentual: 30 });

    assert.equal(resposta.status, 409);
    assert.match(resposta.body.erro, /já existe um cupom/i);
  });

  it('valida o formato do código do cupom', async () => {
    const resposta = await request(app).post('/api/cupons').set('Cookie', cookieAdmin)
      .send({ codigo: 'com espaço', percentual: 10 });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /3 a 20 caracteres/i);
  });

  it('a auditoria registra promoção e cupom', async () => {
    const resposta = await request(app).get('/api/auditoria').set('Cookie', cookieAdmin);
    const acoes = resposta.body.historico.map((registro) => registro.acao);

    assert.ok(acoes.includes('promocao'));
    assert.ok(acoes.includes('cupom'));
  });
});
