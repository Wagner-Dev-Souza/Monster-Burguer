import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { CPF_ADMIN, CPF_CLIENTE, criarAmbienteDeTeste } from './helpers/ambiente.js';

/**
 * Testes da proteção das PÁGINAS administrativas (não é API, é HTML).
 *
 * O que estamos provando: um cliente NÃO recebe o HTML do painel — nem por um
 * instante. O servidor responde com redirecionamento, então o arquivo nunca
 * chega ao navegador dele.
 */
describe('Proteção das páginas administrativas', () => {
  let app;
  let encerrar;
  let cookieAdmin;
  let cookieCliente;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());

    const usuariosRepo = await import('../src/repositories/usuarios.repository.js');
    const { hashSenha } = await import('../src/utils/senha.js');
    await usuariosRepo.criar({
      nome: 'Dono da Loja',
      cpf: CPF_ADMIN,
      senhaHash: await hashSenha('monster123'),
      papel: 'admin',
    });

    await request(app)
      .post('/api/auth/registrar')
      .send({ nome: 'Cliente Curioso', cpf: CPF_CLIENTE, senha: 'senha123' });

    cookieAdmin = (
      await request(app).post('/api/auth/login').send({ cpf: CPF_ADMIN, senha: 'monster123' })
    ).headers['set-cookie'];

    cookieCliente = (
      await request(app).post('/api/auth/login').send({ cpf: CPF_CLIENTE, senha: 'senha123' })
    ).headers['set-cookie'];
  });

  after(() => encerrar());

  it('visitante é redirecionado para o login e NÃO recebe o HTML do painel', async () => {
    const resposta = await request(app).get('/admin/painel.html');

    assert.equal(resposta.status, 302);
    assert.equal(resposta.headers.location, '/login.html');
    // Garantia extra: nenhum conteúdo da página administrativa vazou no corpo.
    assert.ok(!resposta.text.includes('Painel do Dono'));
  });

  it('cliente logado é redirecionado para a loja e NÃO recebe o HTML do painel', async () => {
    const resposta = await request(app).get('/admin/painel.html').set('Cookie', cookieCliente);

    assert.equal(resposta.status, 302);
    assert.equal(resposta.headers.location, '/loja.html');
    assert.ok(!resposta.text.includes('Painel do Dono'));
  });

  it('admin logado recebe a página do painel (200)', async () => {
    const resposta = await request(app).get('/admin/painel.html').set('Cookie', cookieAdmin);

    assert.equal(resposta.status, 200);
    assert.match(resposta.text, /Painel do Dono/);
  });

  it('token inválido é tratado como visitante (302 para o login)', async () => {
    const resposta = await request(app)
      .get('/admin/painel.html')
      .set('Cookie', 'token=token-falsificado');

    assert.equal(resposta.status, 302);
    assert.equal(resposta.headers.location, '/login.html');
  });

  it('link antigo /painel.html redireciona para a área administrativa', async () => {
    const resposta = await request(app).get('/painel.html');

    assert.equal(resposta.status, 302);
    assert.equal(resposta.headers.location, '/admin/painel.html');
  });

  it('a página da loja continua pública', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.equal(resposta.status, 200);
  });
});
