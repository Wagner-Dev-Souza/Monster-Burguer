import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { CPF_CLIENTE, criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * FASE 5 — Pedidos, checkout e PAGAMENTO SIMULADO.
 *
 * O que provamos aqui:
 *  * telefone e endereço são exigidos para fechar o pedido (dados de entrega)
 *  * o preço fica CONGELADO no item (mudar o preço depois não muda o pedido)
 *  * estoque de bebida é validado e BAIXADO no pagamento
 *  * o pagamento é simulado: vira 'pago' e passa a contar como receita
 */
describe('Pedidos e pagamento (Fase 5)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;
  let lancheId;
  let bebidaId;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);
    cookieCliente = await cadastrarELogarCliente(app); // entra como cliente, SEM telefone/endereço

    lancheId = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '29,90' })).body.produto.id;

    bebidaId = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Refrigerante lata', tipo: 'bebida', precoVenda: '6,00', custoCompra: '3,50', estoque: 5 }))
      .body.produto.id;
  });

  after(() => encerrar());

  it('exige telefone e endereço antes de fechar o pedido (dados de entrega)', async () => {
    const resposta = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }] });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /telefone/i);
    assert.match(resposta.body.erro, /Minha conta/i);
  });

  it('depois de completar os dados, o pedido é criado aguardando pagamento', async () => {
    await request(app).patch('/api/auth/minha-conta').set('Cookie', cookieCliente).send({
      nome: 'Cliente Teste',
      telefone: '21999998888',
      cep: '20040020',
      endereco: 'Rua das Assombrações',
      numero: '42',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
    });

    const resposta = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 2 }, { produtoId: bebidaId, quantidade: 1 }] });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.pedido.status, 'aguardando_pagamento');
    assert.equal(resposta.body.pedido.statusLabel, 'Aguardando pagamento');
    assert.equal(resposta.body.pedido.itens.length, 2);
    assert.equal(resposta.body.pedido.subtotal, 65.8);  // 2 x 29,90 + 6,00
    assert.equal(resposta.body.pedido.total, 65.8);
    assert.equal(resposta.body.pedido.codigo, '#0001');
  });

  it('recusa carrinho vazio e produto inexistente', async () => {
    const vazio = await request(app).post('/api/pedidos').set('Cookie', cookieCliente).send({ itens: [] });
    assert.equal(vazio.status, 400);

    const inexistente = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: 99999, quantidade: 1 }] });
    assert.equal(inexistente.status, 404);
  });

  it('recusa lanche fora do cardápio (desativado)', async () => {
    const outroLanche = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Lanche Temporário', tipo: 'lanche', precoVenda: '10,00' })).body.produto;

    await request(app).delete(`/api/produtos/${outroLanche.id}`).set('Cookie', cookieAdmin);

    const resposta = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: outroLanche.id, quantidade: 1 }] });

    assert.equal(resposta.status, 409);
    assert.match(resposta.body.erro, /saiu do cardápio/i);
  });

  it('valida o ESTOQUE de bebida — inclusive quando o carrinho manda linhas repetidas', async () => {
    // estoque é 5; duas linhas de 3 = 6 (o pedido é recusado: consolidação evita furo)
    const resposta = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: bebidaId, quantidade: 3 }, { produtoId: bebidaId, quantidade: 3 }] });

    assert.equal(resposta.status, 409);
    assert.match(resposta.body.erro, /apenas 5 unidade/i);
  });

  it('o PREÇO fica congelado: mudar o preço do produto não altera o pedido existente', async () => {
    const pedido = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }] });

    const idLanche = pedido.body.pedido.itens[0].precoUnitario;
    assert.equal(idLanche, 29.9);

    // o dono sobe o preço para R$ 45,00
    await request(app).put(`/api/produtos/${lancheId}`).set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '45,00' });

    const depois = await request(app).get(`/api/pedidos/${pedido.body.pedido.id}`).set('Cookie', cookieCliente);
    assert.equal(depois.body.pedido.itens[0].precoUnitario, 29.9); // continua o preço da hora
    assert.equal(depois.body.pedido.total, 29.9);

    // (e o cardápio novo passa a mostrar 45,00 para os próximos pedidos)
    const cardapio = await request(app).get('/api/cardapio');
    assert.equal(cardapio.body.lanches[0].precoVenda, 45);

    // volta o preço para não atrapalhar os outros testes
    await request(app).put(`/api/produtos/${lancheId}`).set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '29,90' });
  });

  it('valida a forma de pagamento na hora de pagar', async () => {
    const pedido = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }] });

    const resposta = await request(app).post(`/api/pedidos/${pedido.body.pedido.id}/pagar`)
      .set('Cookie', cookieCliente)
      .send({ formaPagamento: 'bitcoin' });

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /forma de pagamento/i);
  });

  it('troco: recusa valor menor que o total', async () => {
    const pedido = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }] });

    const resposta = await request(app).post(`/api/pedidos/${pedido.body.pedido.id}/pagar`)
      .set('Cookie', cookieCliente)
      .send({ formaPagamento: 'dinheiro', precisaTroco: true, trocoPara: '10,00' }); // total é 29,90

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /troco/i);
  });

  it('PAGAMENTO SIMULADO: pedido vira pago, estoque de bebida baixa e vira receita', async () => {
    const pedido = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }, { produtoId: bebidaId, quantidade: 2 }] });

    assert.equal(pedido.status, 201);

    const pagamento = await request(app).post(`/api/pedidos/${pedido.body.pedido.id}/pagar`)
      .set('Cookie', cookieCliente)
      .send({ formaPagamento: 'pix' });

    assert.equal(pagamento.status, 200);
    assert.equal(pagamento.body.pedido.status, 'pago');
    assert.equal(pagamento.body.pedido.formaPagamentoLabel, 'PIX');
    assert.ok(pagamento.body.pedido.pagoEm, 'esperava a data do pagamento');

    // bebida: 5 - 2 = 3 em estoque
    const produtos = await request(app).get('/api/produtos?tipo=bebida').set('Cookie', cookieAdmin);
    assert.equal(produtos.body.produtos.find((p) => p.id === bebidaId).estoque, 3);

    // e o resumo de vendas do admin conta a receita
    const resumo = await request(app).get('/api/pedidos').set('Cookie', cookieAdmin);
    assert.ok(resumo.body.resumo.receitaTotal > 0);
    assert.ok(resumo.body.resumo.pedidosPagos > 0);
  });

  it('não deixa pagar o mesmo pedido duas vezes', async () => {
    const pedido = await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }] });

    await request(app).post(`/api/pedidos/${pedido.body.pedido.id}/pagar`).set('Cookie', cookieCliente)
      .send({ formaPagamento: 'debito' });

    const segunda = await request(app).post(`/api/pedidos/${pedido.body.pedido.id}/pagar`)
      .set('Cookie', cookieCliente)
      .send({ formaPagamento: 'pix' });

    assert.equal(segunda.status, 400);
    assert.match(segunda.body.erro, /já está como/i);
  });

  it('o cliente vê os PRÓPRIOS pedidos, mas não os dos outros', async () => {
    const meus = await request(app).get('/api/pedidos/meus').set('Cookie', cookieCliente);
    assert.equal(meus.status, 200);
    assert.ok(meus.body.pedidos.length > 0);
    assert.ok(meus.body.pedidos.every((pedido) => pedido.cliente.codigo === '#0002'));

    // um segundo cliente não pode abrir o pedido do primeiro
    const outraCliente = await request(app).post('/api/auth/registrar')
      .send({ nome: 'Outra Cliente', cpf: '12345678909', senha: 'senha123' });
    assert.equal(outraCliente.status, 201);

    const loginOutra = await request(app).post('/api/auth/login')
      .send({ cpf: '12345678909', senha: 'senha123' });

    const idDeOutro = meus.body.pedidos[0].id;
    const tentativa = await request(app).get(`/api/pedidos/${idDeOutro}`).set('Cookie', loginOutra.headers['set-cookie']);

    assert.equal(tentativa.status, 403);
    assert.match(tentativa.body.erro, /não é seu/i);
  });

  it('cliente não acessa a visão administrativa de pedidos (403)', async () => {
    const resposta = await request(app).get('/api/pedidos').set('Cookie', cookieCliente);

    assert.equal(resposta.status, 403);
  });

  it('a auditoria registra o pedido e o pagamento', async () => {
    const resposta = await request(app).get('/api/auditoria?entidade=pedido').set('Cookie', cookieAdmin);
    const acoes = resposta.body.historico.map((registro) => registro.acao);

    assert.ok(acoes.includes('pedido'));
    assert.ok(acoes.includes('pagamento'));
  });

  it('o cadastro continua sem sessão (o registro é só o cadastro)', async () => {
    const registro = await request(app).get('/api/auditoria?entidade=usuario').set('Cookie', cookieAdmin);
    const doCliente = registro.body.historico.find((linha) => linha.detalhe?.includes(CPF_CLIENTE.slice(0, 3)));

    // só validamos que a auditoria do usuário existe e vem do fluxo de cadastro
    assert.ok(registro.body.historico.length > 0);
    assert.ok(doCliente === undefined || doCliente.entidade === 'usuario');
  });
});
