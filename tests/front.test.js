import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';

/**
 * Testes da INTERFACE (contrato do HTML/CSS servido).
 *
 * Por quê testar HTML? Porque a identidade visual e os elementos de navegação
 * são requisitos do cliente como qualquer outro. Se alguém apagar o botão de
 * mostrar senha ou o link entre loja e painel, o teste avisa na hora.
 */
describe('Interface — elementos obrigatórios', () => {
  let app;
  let encerrar;

  before(async () => {
    ({ app, encerrar } = await criarAmbienteDeTeste());
  });

  after(() => encerrar());

  it('login tem o botão de mostrar/esconder senha', async () => {
    const resposta = await request(app).get('/login.html');

    assert.equal(resposta.status, 200);
    assert.match(resposta.text, /data-alternar-senha="#senha"/);
    assert.match(resposta.text, /type="password"/);
  });

  it('cadastro tem botão de senha para os DOIS campos', async () => {
    const resposta = await request(app).get('/cadastro.html');

    assert.match(resposta.text, /data-alternar-senha="#senha"/);
    assert.match(resposta.text, /data-alternar-senha="#confirmar"/);
  });

  it('a loja tem o link para o painel marcado como exclusivo de admin', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.equal(resposta.status, 200);
    assert.match(resposta.text, /data-somente-admin/);
    assert.match(resposta.text, /href="\/admin\/painel.html"/);
  });

  it('o painel tem link para a loja (admin navega nas duas áreas)', async () => {
    const resposta = await request(app).get('/admin/painel.html').set('Cookie', 'token=invalido');
    // Sem sessão o guard redireciona: o conteúdo é verificado no teste de acesso,
    // aqui garantimos que o ARQUIVO contém a navegação cruzada.
    assert.equal(resposta.status, 302);

    const htmlDoArquivo = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../public/admin/painel.html', import.meta.url), 'utf8'),
    );
    assert.match(htmlDoArquivo, /href="\/loja.html"/);
    assert.match(htmlDoArquivo, /data-somente-admin|Ver a loja/);
  });

  it('a identidade visual nova está publicada (CSS com paleta monster)', async () => {
    const resposta = await request(app).get('/css/estilo.css');

    assert.equal(resposta.status, 200);
    assert.match(resposta.text, /--verde-monstro: #6ac30e/);
    assert.match(resposta.text, /--amarelo: #ffd60a/);
    assert.match(resposta.text, /--vermelho: #d62828/);
    // fundo de lanches com opacidade
    assert.match(resposta.text, /lanche\.svg/);
    assert.match(resposta.text, /opacity: \.07/);
  });

  it('os personagens da turma monster são servidos como SVG', async () => {
    const personagens = ['mumia', 'lobisomem', 'draculinha', 'monstro-pantano', 'frank', 'zumbi', 'chef-monstrinha'];

    for (const nome of personagens) {
      const resposta = await request(app).get(`/img/monstros/${nome}.svg`);
      assert.equal(resposta.status, 200, `esperava 200 para ${nome}.svg`);
      assert.match(resposta.headers['content-type'], /svg/);
    }
  });
});
