import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';

describe('Saúde do servidor', () => {
  let app;
  let encerrar;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
  });

  after(() => encerrar());

  it('GET /health responde 200 com status ok', async () => {
    const resposta = await request(app).get('/health');

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.status, 'ok');
    assert.equal(resposta.body.servico, 'monster-burguer');
  });

  it('rota inexistente responde 404 em JSON padronizado', async () => {
    const resposta = await request(app).get('/api/nao-existe');

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.codigo, 'ROTA_NAO_ENCONTRADA');
  });
});
