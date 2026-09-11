import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * FASE 6 — ACOMPANHAMENTO DO PEDIDO (fluxo de status).
 *
 * Regras provadas aqui:
 *  * o pedido só anda para frente, um passo de cada vez (sem pular etapas)
 *  * só a loja (admin) avança o status — o cliente NÃO mexe nisso
 *  * cancelar um pedido pago devolve o estoque das bebidas
 */
describe('Acompanhamento do pedido (Fase 6)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;
  let lancheId;
  let bebidaId;

  /** Cria um pedido já pago e devolve o pedido. */
  const criarPedidoPago = async (itens = null) => {
    const corpo = { itens: itens ?? [{ produtoId: lancheId, quantidade: 1 }, { produtoId: bebidaId, quantidade: 2 }] };
    const pedido = (await request(app).post('/api/pedidos').set('Cookie', cookieCliente).send(corpo)).body.pedido;

    const pago = await request(app).post(`/api/pedidos/${pedido.id}/pagar`).set('Cookie', cookieCliente)
      .send({ formaPagamento: 'pix' });

    return pago.body.pedido;
  };

  const avancar = (id, status) => request(app).patch(`/api/pedidos/${id}/status`)
    .set('Cookie', cookieAdmin)
    .send({ status });

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);
    cookieCliente = await cadastrarELogarCliente(app);

    lancheId = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '29,90' })).body.produto.id;

    bebidaId = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Refrigerante lata', tipo: 'bebida', precoVenda: '6,00', custoCompra: '3,50', estoque: 20 }))
      .body.produto.id;

    await request(app).patch('/api/auth/minha-conta').set('Cookie', cookieCliente).send({
      nome: 'Cliente Entrega',
      telefone: '21977776666',
      cep: '20040020',
      endereco: 'Rua das Assombrações',
      numero: '7',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
    });
  });

  after(() => encerrar());

  it('o pedido pago informa quais são os próximos passos possíveis', async () => {
    const pedido = await criarPedidoPago();

    assert.equal(pedido.status, 'pago');
    assert.deepEqual(pedido.proximos, ['em_preparo', 'cancelado']);
    // e as etapas que o cliente acompanha na tela
    assert.deepEqual(pedido.etapas, ['pago', 'em_preparo', 'pronto', 'saiu_entrega', 'entregue']);
  });

  it('a loja percorre o caminho completo até a entrega', async () => {
    const pedido = await criarPedidoPago();

    const preparo = await avancar(pedido.id, 'em_preparo');
    assert.equal(preparo.status, 200);
    assert.equal(preparo.body.pedido.statusLabel, 'Em preparo');

    assert.equal((await avancar(pedido.id, 'pronto')).body.pedido.statusLabel, 'Pronto');
    assert.equal((await avancar(pedido.id, 'saiu_entrega')).body.pedido.statusLabel, 'Saiu para entrega');

    const entregue = await avancar(pedido.id, 'entregue');
    assert.equal(entregue.body.pedido.statusLabel, 'Entregue');
    assert.deepEqual(entregue.body.pedido.proximos, []); // acabou o fluxo
  });

  it('NÃO pula etapa: de "pago" direto para "entregue" é recusado', async () => {
    const pedido = await criarPedidoPago();

    const resposta = await avancar(pedido.id, 'entregue');

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /Não dá para ir de "Pago" para "Entregue"/);
    assert.match(resposta.body.erro, /Em preparo/i);
  });

  it('não avança um pedido já entregue', async () => {
    const pedido = await criarPedidoPago();

    await avancar(pedido.id, 'em_preparo');
    await avancar(pedido.id, 'pronto');
    await avancar(pedido.id, 'saiu_entrega');
    await avancar(pedido.id, 'entregue');

    const resposta = await avancar(pedido.id, 'entregue');
    assert.equal(resposta.status, 400);
  });

  it('o CLIENTE não avança o status (só a loja)', async () => {
    const pedido = await criarPedidoPago();

    const resposta = await request(app).patch(`/api/pedidos/${pedido.id}/status`)
      .set('Cookie', cookieCliente)
      .send({ status: 'entregue' });

    assert.equal(resposta.status, 403);

    // e o pedido continua onde estava (a tentativa não mudou nada)
    const depois = await request(app).get(`/api/pedidos/${pedido.id}`).set('Cookie', cookieCliente);
    assert.equal(depois.body.pedido.status, 'pago');
  });

  it('cancelar um pedido PAGO devolve o estoque das bebidas', async () => {
    const produtosAntes = await request(app).get('/api/produtos?tipo=bebida').set('Cookie', cookieAdmin);
    const estoqueAntes = produtosAntes.body.produtos.find((produto) => produto.id === bebidaId).estoque;

    // pedido com 2 bebidas: no pagamento o estoque cai 2
    const pedido = await criarPedidoPago();

    const produtosDepoisDePagar = await request(app).get('/api/produtos?tipo=bebida').set('Cookie', cookieAdmin);
    assert.equal(produtosDepoisDePagar.body.produtos.find((produto) => produto.id === bebidaId).estoque, estoqueAntes - 2);

    const cancelado = await avancar(pedido.id, 'cancelado');
    assert.equal(cancelado.body.pedido.statusLabel, 'Cancelado');

    // e agora o estoque volta (o lanche não entrou na conta: não tem estoque)
    const produtosDepoisDeCancelar = await request(app).get('/api/produtos?tipo=bebida').set('Cookie', cookieAdmin);
    assert.equal(produtosDepoisDeCancelar.body.produtos.find((produto) => produto.id === bebidaId).estoque, estoqueAntes);
  });

  it('pedido cancelado não conta como receita no resumo', async () => {
    const pedido = await criarPedidoPago();
    const antes = await request(app).get('/api/pedidos').set('Cookie', cookieAdmin);
    const receitaAntes = antes.body.resumo.receitaTotal;

    await avancar(pedido.id, 'cancelado');

    const depois = await request(app).get('/api/pedidos').set('Cookie', cookieAdmin);
    assert.equal(depois.body.resumo.receitaTotal, receitaAntes - pedido.total);
  });

  it('a auditoria registra cada mudança de status', async () => {
    const pedido = await criarPedidoPago();
    await avancar(pedido.id, 'em_preparo');

    const resposta = await request(app).get('/api/auditoria?entidade=pedido').set('Cookie', cookieAdmin);
    const mudanca = resposta.body.historico.find((registro) => registro.acao === 'status');

    assert.ok(mudanca, 'esperava um registro de mudança de status');
    assert.match(mudanca.detalhe, /Em preparo/);
    assert.equal(mudanca.usuarioCodigo, '#0001');
  });

  it('o cliente acompanha o próprio pedido pela API', async () => {
    const pedido = await criarPedidoPago();
    await avancar(pedido.id, 'em_preparo');

    const resposta = await request(app).get(`/api/pedidos/${pedido.id}`).set('Cookie', cookieCliente);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.pedido.status, 'em_preparo');
    assert.equal(resposta.body.pedido.statusLabel, 'Em preparo');
  });
});
