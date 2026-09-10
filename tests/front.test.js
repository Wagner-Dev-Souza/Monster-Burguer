import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbienteDeTeste } from './helpers/ambiente.js';

/**
 * Testes da INTERFACE (contrato do HTML/CSS servido).
 *
 * Por quê testar HTML? Porque a identidade visual e os elementos de navegação
 * são requisitos do cliente como qualquer outro. Se alguém apagar o botão de
 * mostrar senha, o botão de excluir a conta ou a trava das abas, o teste avisa.
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

  it('cadastro encaminha para o login com aviso de sucesso', async () => {
    const cadastro = await request(app).get('/cadastro.html');

    // O cadastro NÃO loga: ele manda para o login com o aviso.
    assert.match(cadastro.text, /\/login\.html\?cadastro=sucesso/);

    // E o login sabe ler esse aviso.
    const login = await request(app).get('/login.html');
    assert.match(login.text, /get\('cadastro'\)/);
  });

  it('as ABAS de navegação são exclusivas do admin (cliente não transita)', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.equal(resposta.status, 200);
    // As duas abas ficam dentro do bloco que só o admin vê.
    assert.match(resposta.text, /<nav class="nav" data-somente-admin hidden>/);
    assert.match(resposta.text, /href="\/admin\/painel.html"/);
    assert.match(resposta.text, /href="\/loja.html" class="ativo"/);
  });

  it('o botão Sair fica no canto superior direito (bloco de ações do topo)', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.match(resposta.text, /class="acoes-topo">[\s\S]*class="sair"/);
  });

  it('o cliente tem a opção de excluir o próprio cadastro (com confirmação)', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.match(resposta.text, /zona-perigo/);
    assert.match(resposta.text, /confirmacao-exclusao/);
    assert.match(resposta.text, /Excluir meu cadastro/);
  });

  it('o painel tem link para a loja (admin navega nas duas áreas)', async () => {
    const resposta = await request(app).get('/admin/painel.html').set('Cookie', 'token=invalido');
    // Sem sessão o guard redireciona: o conteúdo é verificado no teste de acesso.
    assert.equal(resposta.status, 302);

    const htmlDoArquivo = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../public/admin/painel.html', import.meta.url), 'utf8'),
    );
    assert.match(htmlDoArquivo, /href="\/loja.html"/);
    assert.match(htmlDoArquivo, /class="acoes-topo"/);
  });

  it('a identidade visual está publicada (paleta monster + fundo de lanches)', async () => {
    const resposta = await request(app).get('/css/estilo.css');

    assert.equal(resposta.status, 200);
    assert.match(resposta.text, /--verde-monstro: #6ac30e/);
    assert.match(resposta.text, /--amarelo: #ffd60a/);
    assert.match(resposta.text, /--vermelho: #d62828/);
    assert.match(resposta.text, /lanche\.svg/);
    assert.match(resposta.text, /opacity: \.07/);
  });

  it('a turma monster tem 9 personagens servidos como SVG', async () => {
    const personagens = [
      'fantasma',
      'esqueleto',
      'bruxa',
      'frank',
      'draculinha',
      'lobisomem',
      'mumia',
      'monstro-pantano',
      'zumbi',
    ];

    for (const nome of personagens) {
      const resposta = await request(app).get(`/img/monstros/${nome}.svg`);
      assert.equal(resposta.status, 200, `esperava 200 para ${nome}.svg`);
      assert.match(resposta.headers['content-type'], /svg/);
    }
  });

  it('o Chef Monstrinho saiu de cena (arquivo removido)', async () => {
    const resposta = await request(app).get('/img/monstros/chef-monstrinha.svg');

    assert.equal(resposta.status, 404);
  });
});
