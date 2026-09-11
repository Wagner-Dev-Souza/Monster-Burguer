import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';
import { cadastrarELogarCliente, criarAdminELogar } from './helpers/sessao.js';

/**
 * FASE 8 — RELATÓRIOS FINANCEIROS (fluxo de caixa).
 *
 * A conta que o dono precisa: receita (pedidos pagos) − despesas (compras) = saldo.
 * E, por produto: quanto sobrou depois do custo.
 */
describe('Fluxo de caixa e margem (Fase 8)', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;
  let lancheId;
  let ingredienteId;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
    cookieAdmin = await criarAdminELogar(app);
    cookieCliente = await cadastrarELogarCliente(app);

    // ingrediente de R$ 40,00/kg e lanche que usa 0,5 kg (custo R$ 20,00)
    ingredienteId = (await request(app).post('/api/ingredientes').set('Cookie', cookieAdmin)
      .send({ nome: 'Carne bovina', unidade: 'kg', custoUnitario: '40,00' })).body.ingrediente.id;

    lancheId = (await request(app).post('/api/produtos').set('Cookie', cookieAdmin)
      .send({ nome: 'Monster do Frank', tipo: 'lanche', precoVenda: '50,00' })).body.produto.id;

    await request(app).put(`/api/produtos/${lancheId}/composicao`).set('Cookie', cookieAdmin)
      .send({ itens: [{ ingredienteId, quantidade: 0.5 }] });

    await request(app).patch('/api/auth/minha-conta').set('Cookie', cookieCliente).send({
      nome: 'Cliente Caixa',
      telefone: '21966665555',
      cep: '20040020',
      endereco: 'Rua do Caixa',
      numero: '10',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
    });

    // venda paga: 2 lanches = R$ 100,00
    const pedido = (await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 2 }] })).body.pedido;

    await request(app).post(`/api/pedidos/${pedido.id}/pagar`).set('Cookie', cookieCliente)
      .send({ formaPagamento: 'pix' });

    // despesa: 10 kg de carne por R$ 400,00
    await request(app).post('/api/compras').set('Cookie', cookieAdmin)
      .send({ tipo: 'ingrediente', ingredienteId, quantidade: 10, valorTotal: '400,00', fornecedor: 'Frigorífico' });
  });

  after(() => encerrar());

  it('só admin vê o caixa (cliente toma 403)', async () => {
    const caixa = await request(app).get('/api/relatorios/caixa').set('Cookie', cookieCliente);
    assert.equal(caixa.status, 403);

    const produtos = await request(app).get('/api/relatorios/produtos').set('Cookie', cookieCliente);
    assert.equal(produtos.status, 403);
  });

  it('fecha a conta: receita − despesas = saldo', async () => {
    const resposta = await request(app).get('/api/relatorios/caixa').set('Cookie', cookieAdmin);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.resumo.receita, 100);      // 2 x R$ 50,00
    assert.equal(resposta.body.resumo.despesas, 400);     // 10 kg de carne
    assert.equal(resposta.body.resumo.saldo, -300);       // a loja está no vermelho (comprou estoque)
    assert.equal(resposta.body.resumo.positivo, false);
    assert.equal(resposta.body.resumo.pedidosPagos, 1);
    assert.equal(resposta.body.resumo.ticketMedio, 100);
  });

  it('agrupa por dia, mês e ano', async () => {
    const porDia = await request(app).get('/api/relatorios/caixa?agrupamento=dia').set('Cookie', cookieAdmin);
    const porMes = await request(app).get('/api/relatorios/caixa?agrupamento=mes').set('Cookie', cookieAdmin);
    const porAno = await request(app).get('/api/relatorios/caixa?agrupamento=ano').set('Cookie', cookieAdmin);

    assert.equal(porDia.body.periodos.length, 1);
    assert.match(porDia.body.periodos[0].rotulo, /^\d{2}\/\d{2}\/\d{4}$/);

    assert.match(porMes.body.periodos[0].rotulo, /^\d{2}\/\d{4}$/);
    assert.match(porAno.body.periodos[0].rotulo, /^\d{4}$/);

    // o período mostra receita e despesa juntos
    assert.equal(porDia.body.periodos[0].receita, 100);
    assert.equal(porDia.body.periodos[0].despesas, 400);
    assert.equal(porDia.body.periodos[0].saldo, -300);
  });

  it('recusa agrupamento inválido', async () => {
    const resposta = await request(app).get('/api/relatorios/caixa?agrupamento=semana').set('Cookie', cookieAdmin);

    assert.equal(resposta.status, 400);
    assert.match(resposta.body.erro, /agrupamento inválido/i);
  });

  it('o extrato lista entradas e saídas', async () => {
    const resposta = await request(app).get('/api/relatorios/caixa').set('Cookie', cookieAdmin);
    const movimentacoes = resposta.body.extrato;

    const entrada = movimentacoes.find((linha) => linha.tipo === 'entrada');
    const saida = movimentacoes.find((linha) => linha.tipo === 'saida');

    assert.ok(entrada, 'esperava uma entrada (pedido pago)');
    assert.equal(entrada.valor, 100);
    assert.match(entrada.descricao, /Pedido #\d{4}/);

    assert.ok(saida, 'esperava uma saída (compra)');
    assert.equal(saida.valor, -400);   // negativo: é dinheiro saindo
    assert.match(saida.descricao, /Carne bovina/);
  });

  it('mostra o lucro por produto (receita − custo)', async () => {
    const resposta = await request(app).get('/api/relatorios/produtos').set('Cookie', cookieAdmin);

    assert.equal(resposta.status, 200);

    const lanche = resposta.body.produtos.find((produto) => produto.produtoId === lancheId);

    assert.equal(lanche.quantidadeVendida, 2);
    assert.equal(lanche.receita, 100);
    assert.equal(lanche.custoUnitario, 20);   // 0,5 kg x R$ 40,00
    assert.equal(lanche.custoTotal, 40);
    assert.equal(lanche.lucro, 60);
    assert.equal(lanche.lucroPercentual, 60);
  });

  it('só conta pedido PAGO na receita (pedido aguardando não entra)', async () => {
    // cria um pedido e deixa sem pagar
    await request(app).post('/api/pedidos').set('Cookie', cookieCliente)
      .send({ itens: [{ produtoId: lancheId, quantidade: 1 }] });

    const resposta = await request(app).get('/api/relatorios/caixa').set('Cookie', cookieAdmin);

    assert.equal(resposta.body.resumo.receita, 100);        // continua 100
    assert.equal(resposta.body.resumo.aguardandoPagamento, 1);
  });
});
