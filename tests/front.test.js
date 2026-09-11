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

  it('REGRESSÃO: o atributo `hidden` vence o display das classes no CSS', async () => {
    // Sem esta regra, `.nav { display: flex }` atropelava o `hidden` e as abas
    // "Loja/Painel" apareciam para o cliente. Este teste existe para que o bug
    // nunca volte sem alguém perceber.
    const resposta = await request(app).get('/css/estilo.css');

    assert.match(resposta.text, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  });

  it('a tela de login NÃO tem a turma inteira, só o mascote sorteado', async () => {
    const resposta = await request(app).get('/login.html');

    assert.match(resposta.text, /data-mascote-aleatorio/);
    assert.ok(!resposta.text.includes('faixa-turma'), 'login não deve exibir a turma completa');
  });

  it('cadastro também sorteia o mascote do topo', async () => {
    const resposta = await request(app).get('/cadastro.html');

    assert.match(resposta.text, /data-mascote-aleatorio/);
    assert.match(resposta.text, /\/js\/mascote\.js/);
  });

  it('mascote.js tem os 9 personagens para o sorteio', async () => {
    const resposta = await request(app).get('/js/mascote.js');

    assert.equal(resposta.status, 200);
    const quantidade = (resposta.text.match(/arquivo: '/g) ?? []).length;
    assert.equal(quantidade, 9);
  });

  it('o selo do topo mostra o NOME do usuário (não a palavra "cliente")', async () => {
    const resposta = await request(app).get('/js/layout.js');

    // O texto do selo é montado com o ícone do papel + o nome + o código da pessoa.
    assert.match(resposta.text, /el\.textContent = `\$\{icone\} \$\{usuario\.nome\} · \$\{usuario\.codigo\}`/);
  });

  it('o selo do topo inclui o código do usuário (#0001)', async () => {
    const resposta = await request(app).get('/js/layout.js');

    assert.match(resposta.text, /usuario\.codigo/);
    assert.match(resposta.text, /data-codigo-usuario/);
  });

  it('Minha conta tem formulário editável (nome, telefone e endereço)', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.match(resposta.text, /id="form-conta"/);
    assert.match(resposta.text, /id="conta-nome"/);
    assert.match(resposta.text, /id="conta-telefone"/);
    assert.match(resposta.text, /id="conta-cep"/);
    assert.match(resposta.text, /id="conta-endereco"/);
  });

  it('a exclusão de conta é oferecida só ao cliente (admin vê a explicação)', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.match(resposta.text, /data-somente-cliente[\s\S]*id="botao-excluir"/);
    assert.match(resposta.text, /data-aviso-admin[\s\S]*rebaixar você a cliente/);
  });

  it('Minha conta começa em MODO LEITURA (campos travados, só o Editar visível)', async () => {
    const resposta = await request(app).get('/loja.html');

    // os campos nascem com readOnly
    assert.match(resposta.text, /id="conta-nome"[^>]*readonly/);
    assert.match(resposta.text, /id="conta-telefone"[^>]*readonly/);

    // Editar aparece; Salvar e Cancelar nascem escondidos
    assert.match(resposta.text, /id="botao-editar"/);
    assert.match(resposta.text, /id="botao-salvar" hidden/);
    assert.match(resposta.text, /id="botao-cancelar" hidden/);

    // e o JS tem as funções que alternam os modos
    assert.match(resposta.text, /function entrarEmModoEdicao/);
    assert.match(resposta.text, /function sairDoModoEdicao/);
  });

  it('a página de produtos da Fase 2 existe com ingredientes, produtos e ficha técnica', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/produtos.html', import.meta.url), 'utf8');

    assert.match(html, /id="form-ingrediente"/);
    assert.match(html, /id="form-produto"/);
    assert.match(html, /id="card-ficha"/);
    assert.match(html, /id="botao-adicionar-item"/);
    assert.match(html, /id="ficha-margem"/);
    // lanche x bebida: os campos de revenda aparecem só para bebida
    assert.match(html, /id="campos-bebida" hidden/);
  });

  it('o painel tem link para a página de produtos', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/painel.html', import.meta.url), 'utf8');

    assert.match(html, /href="\/admin\/produtos\.html"/);
  });

  it('login e cadastro carregam a musiquinha 8-bits', async () => {
    const login = await request(app).get('/login.html');
    const cadastro = await request(app).get('/cadastro.html');

    assert.match(login.text, /\/js\/musica\.js/);
    assert.match(cadastro.text, /\/js\/musica\.js/);
  });

  it('REGRESSÃO: musica.js é carregado como MÓDULO (escopo isolado)', async () => {
    // O arquivo declara variáveis curtas (botao, contexto, tocando...). Se ele
    // rodar como script clássico, essas variáveis vão para o escopo GLOBAL e
    // colidem com as da página — o login declara `const botao`, e a colisão
    // abortava o script da página inteira (o formulário parava de funcionar).
    // Carregar como módulo isola o escopo e resolve de vez.
    const login = await request(app).get('/login.html');
    const cadastro = await request(app).get('/cadastro.html');

    assert.match(login.text, /<script type="module" src="\/js\/musica\.js"><\/script>/);
    assert.match(cadastro.text, /<script type="module" src="\/js\/musica\.js"><\/script>/);
  });

  it('a música é gerada por código (Web Audio) e persiste a posição entre páginas', async () => {
    const resposta = await request(app).get('/js/musica.js');

    assert.equal(resposta.status, 200);
    // síntese em vez de arquivo de áudio
    assert.match(resposta.text, /AudioContext/);
    assert.match(resposta.text, /createOscillator/);
    // continuidade entre login <-> cadastro
    assert.match(resposta.text, /sessionStorage/);
    assert.match(resposta.text, /monsterMusica/);
    assert.match(resposta.text, /pagehide/);
    // parada ao logar
    assert.match(resposta.text, /function pararMusica/);
    assert.match(resposta.text, /window\.pararMusica = pararMusica/);
  });

  it('o login PARA a música antes de entrar', async () => {
    const resposta = await request(app).get('/login.html');

    assert.match(resposta.text, /pararMusica\(\)/);
  });

  it('o botão flutuante de ligar/desligar tem estilo próprio', async () => {
    const resposta = await request(app).get('/css/estilo.css');

    assert.match(resposta.text, /\.musica-botao/);
  });

  it('FASE 4: a loja tem cardápio dinâmico e carrinho', async () => {
    const resposta = await request(app).get('/loja.html');

    // cardápio montado a partir da API
    assert.match(resposta.text, /id="cardapio"/);
    assert.match(resposta.text, /API\.get\('\/api\/cardapio'\)/);
    // carrinho: contador, lista, total e as ações de mexer no pedido
    assert.match(resposta.text, /id="contador-carrinho"/);
    assert.match(resposta.text, /id="lista-carrinho"/);
    assert.match(resposta.text, /id="total-carrinho"/);
    assert.match(resposta.text, /function adicionarAoCarrinho/);
    assert.match(resposta.text, /function alterarQuantidade/);
    assert.match(resposta.text, /function removerDoCarrinho/);
    assert.match(resposta.text, /function limparCarrinho/);
    // carrinho separado por usuário e guardado no navegador
    assert.match(resposta.text, /localStorage/);
    assert.match(resposta.text, /monsterCarrinho:/);
  });

  it('o código do usuário (#0000) aparece na loja e no selo do topo', async () => {
    const loja = await request(app).get('/loja.html');
    const layout = await request(app).get('/js/layout.js');

    assert.match(loja.text, /data-codigo-usuario/);
    assert.match(layout.text, /usuario\.codigo/);
  });

  it('a tabela de ingredientes tem Editar e Excluir', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/produtos.html', import.meta.url), 'utf8');

    assert.match(html, /✏️ Editar/);
    assert.match(html, /🗑️ Excluir/);
    assert.match(html, /function excluirIngrediente/);
  });

  it('o painel mostra o histórico de alterações (auditoria)', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/painel.html', import.meta.url), 'utf8');

    assert.match(html, /id="lista-auditoria"/);
    assert.match(html, /\/api\/auditoria/);
  });
});
