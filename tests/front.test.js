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

  it('as ABAS de navegação são montadas conforme o papel (cliente não vê o painel)', async () => {
    const loja = await request(app).get('/loja.html');
    const layout = await request(app).get('/js/layout.js');

    // A navegação da loja nasce como um contêiner vazio...
    assert.match(loja.text, /<nav class="nav" data-nav hidden><\/nav>/);

    // ...e o layout.js monta as abas do papel: o cliente NÃO tem aba de painel.
    assert.match(layout.text, /PAGINAS_POR_PAPEL/);
    assert.match(layout.text, /cliente: \[/);
    assert.match(layout.text, /admin: \[/);
    // a aba do painel só existe no conjunto do admin
    const blocoAdmin = layout.text.slice(layout.text.indexOf('admin: ['));
    assert.match(blocoAdmin, /\/admin\/painel\.html/);
  });

  it('o botão Sair fica no canto superior direito (bloco de ações do topo)', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.match(resposta.text, /class="acoes-topo">[\s\S]*class="sair"/);
  });

  it('o cliente tem a opção de excluir o próprio cadastro (com confirmação)', async () => {
    const resposta = await request(app).get('/conta.html');

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
    const resposta = await request(app).get('/conta.html');

    assert.match(resposta.text, /id="form-conta"/);
    assert.match(resposta.text, /id="conta-nome"/);
    assert.match(resposta.text, /id="conta-telefone"/);
    assert.match(resposta.text, /id="conta-cep"/);
    assert.match(resposta.text, /id="conta-endereco"/);
  });

  it('a exclusão de conta é oferecida só ao cliente (admin vê a explicação)', async () => {
    const resposta = await request(app).get('/conta.html');

    assert.match(resposta.text, /data-somente-cliente[\s\S]*id="botao-excluir"/);
    assert.match(resposta.text, /data-aviso-admin[\s\S]*rebaixar você a cliente/);
  });

  it('Minha conta começa em MODO LEITURA (campos travados, só o Editar visível)', async () => {
    const resposta = await request(app).get('/conta.html');

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

  it('TODAS as páginas carregam a musiquinha (o tema acompanha o site inteiro)', async () => {
    // Lemos os arquivos do disco: as páginas de /admin respondem 302 sem sessão
    // (proteção correta), e aqui o que interessa é o HTML em si.
    const fs = await import('node:fs/promises');

    const paginas = [
      'index.html',
      'login.html',
      'cadastro.html',
      'loja.html',
      'carrinho.html',
      'checkout.html',
      'pedidos.html',
      'acompanhar.html',
      'conta.html',
      'admin/painel.html',
      'admin/produtos.html',
      'admin/compras.html',
      'admin/promocoes.html',
      'admin/caixa.html',
    ];

    for (const pagina of paginas) {
      const html = await fs.readFile(new URL(`../public/${pagina}`, import.meta.url), 'utf8');

      assert.match(html, /\/js\/musica\.js/, `${pagina} deveria carregar a música`);
      assert.match(
        html,
        /<script type="module" src="\/js\/musica\.js"><\/script>/,
        `${pagina} deveria carregar a música como módulo (escopo isolado)`,
      );
    }
  });

  it('a música é gerada por código (Web Audio) e persiste a posição entre páginas', async () => {
    const resposta = await request(app).get('/js/musica.js');

    assert.equal(resposta.status, 200);
    // síntese em vez de arquivo de áudio
    assert.match(resposta.text, /AudioContext/);
    assert.match(resposta.text, /createOscillator/);
    // continuidade pelo site inteiro: âncora de relógio no sessionStorage
    assert.match(resposta.text, /sessionStorage/);
    assert.match(resposta.text, /monsterMusica/);
    assert.match(resposta.text, /inicioEm/);     // a âncora que evita acumular erro
    assert.match(resposta.text, /pagehide/);
    // uma aba por vez (senão duas abas tocam fora de fase)
    assert.match(resposta.text, /monsterMusicaAbaAtiva/);
    assert.match(resposta.text, /outraAbaEstaTocando/);
    // e a música NÃO para mais no login
    assert.ok(!/function pararMusica/.test(resposta.text));
  });

  it('o login NÃO interrompe mais a música (ela continua pelo site)', async () => {
    const resposta = await request(app).get('/login.html');

    assert.ok(!/pararMusica\(\)/.test(resposta.text), 'o login não deve mais parar a música');
    assert.match(resposta.text, /js\/musica\.js/);
  });

  it('o desligar/ligar pelo botão fica gravado no estado (vale para o site todo)', async () => {
    const resposta = await request(app).get('/js/musica.js');

    // desligado = ativa:false salvo -> a próxima página continua desligada
    assert.match(resposta.text, /ativa: false/);
    assert.match(resposta.text, /ativa: true/);
  });

  it('o botão flutuante de ligar/desligar tem estilo próprio', async () => {
    const resposta = await request(app).get('/css/estilo.css');

    assert.match(resposta.text, /\.musica-botao/);
  });

  it('FASE 4: o cardápio tem promoção com "de/por" e a barra do carrinho', async () => {
    const resposta = await request(app).get('/loja.html');

    assert.match(resposta.text, /id="cardapio"/);
    assert.match(resposta.text, /API\.get\('\/api\/cardapio'\)/);
    // selo de desconto e preço antigo riscado (Fase 7)
    assert.match(resposta.text, /selo-promo/);
    assert.match(resposta.text, /precoOriginal/);
    // barra flutuante que leva ao carrinho
    assert.match(resposta.text, /id="barra-carrinho"/);
    assert.match(resposta.text, /href="\/carrinho.html"/);
  });

  it('FASE 4: o carrinho virou uma página própria com quantidades e total', async () => {
    const resposta = await request(app).get('/carrinho.html');

    assert.match(resposta.text, /id="lista-carrinho"/);
    assert.match(resposta.text, /id="total-carrinho"/);
    assert.match(resposta.text, /Carrinho\.alterarQuantidade/);
    assert.match(resposta.text, /Carrinho\.remover/);
    assert.match(resposta.text, /Carrinho\.limpar/);
    assert.match(resposta.text, /href="\/checkout.html"/);
  });

  it('o carrinho é compartilhado entre as páginas (módulo carrinho.js)', async () => {
    const resposta = await request(app).get('/js/carrinho.js');

    assert.equal(resposta.status, 200);
    // guardado por usuário, no navegador
    assert.match(resposta.text, /monsterCarrinho:/);
    assert.match(resposta.text, /localStorage/);
    // namespace único (um só morador no escopo global)
    assert.match(resposta.text, /window\.Carrinho = /);
    assert.match(resposta.text, /Carrinho|assinar/);
  });

  it('a área do cliente é dividida em JANELAS separadas (sem poluir a home)', async () => {
    const layout = await request(app).get('/js/layout.js');

    // o mapa de telas do cliente tem uma página para cada assunto
    assert.match(layout.text, /\/loja\.html', rotulo: '🍔 Cardápio/);
    assert.match(layout.text, /\/carrinho\.html', rotulo: '🛒 Carrinho/);
    assert.match(layout.text, /\/pedidos\.html', rotulo: '📋 Meus pedidos/);
    assert.match(layout.text, /\/acompanhar\.html', rotulo: '🚚 Acompanhar/);
    assert.match(layout.text, /\/conta\.html', rotulo: '🙋 Minha conta/);

    // e cada página existe de verdade
    const paginas = ['loja.html', 'carrinho.html', 'pedidos.html', 'acompanhar.html', 'conta.html'];
    for (const pagina of paginas) {
      const resposta = await request(app).get(`/${pagina}`);
      assert.equal(resposta.status, 200, `esperava a página ${pagina}`);
    }
  });

  it('o código do usuário (#0000) aparece em Minha conta e no selo do topo', async () => {
    const conta = await request(app).get('/conta.html');
    const layout = await request(app).get('/js/layout.js');

    assert.match(conta.text, /data-codigo-usuario/);
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

  it('FASE 5: o pagamento é uma página própria com formas e botão de pagamento', async () => {
    const resposta = await request(app).get('/checkout.html');

    assert.match(resposta.text, /id="formas-pagamento"/);
    assert.match(resposta.text, /id="campo-troco"/);
    assert.match(resposta.text, /id="botao-confirmar-pedido"/);
    assert.match(resposta.text, /id="botao-pagar"/);
    assert.match(resposta.text, /API\.post\('\/api\/pedidos'/);
    assert.match(resposta.text, /\/pagar`/);
    // a loja é de teste: nada de dados de cartão
    assert.match(resposta.text, /não pedimos número de cartão/i);
    // aceita pagar um pedido já criado (?pedido=ID) vindo de "Meus pedidos"
    assert.match(resposta.text, /\.get\('pedido'\)/);
  });

  it('pagamento na entrega saiu da lista (crédito/débito/dinheiro já são na entrega)', async () => {
    const resposta = await request(app).get('/checkout.html');

    assert.ok(!/na_entrega/.test(resposta.text), 'a opção "pagar na entrega" não deve mais existir');
    assert.ok(!/Pagar na entrega/i.test(resposta.text));
    // as quatro formas que continuam:
    assert.match(resposta.text, /pix: '🔵 PIX'/);
    assert.match(resposta.text, /dinheiro: '💵 Dinheiro'/);
  });

  it('FASE 6: a página de acompanhamento mostra a linha do tempo do pedido', async () => {
    const resposta = await request(app).get('/acompanhar.html');

    assert.match(resposta.text, /linha-do-tempo/);
    assert.match(resposta.text, /'em_preparo', rotulo: 'Em preparo'/);
    assert.match(resposta.text, /'saiu_entrega'/);
    // se atualiza sozinha (o cliente deixa aberta esperando o lanche)
    assert.match(resposta.text, /setInterval\(carregar, 10000\)/);
  });

  it('o painel do dono tem os botões de avançar o pedido (Fase 6)', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/painel.html', import.meta.url), 'utf8');

    assert.match(html, /\/status`/);
    assert.match(html, /👨‍🍳 Iniciar preparo/);
    assert.match(html, /🛵 Saiu para entrega/);
    // os passos possíveis vêm do servidor (não inventamos no front)
    assert.match(html, /pedido\.proximos/);
  });

  it('FASE 7: a página de promoções e cupons existe no painel', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/promocoes.html', import.meta.url), 'utf8');

    assert.match(html, /id="form-promocao"/);
    assert.match(html, /id="form-cupom"/);
    assert.match(html, /id="lista-promocoes"/);
    assert.match(html, /id="lista-cupons"/);
    assert.match(html, /'\/api\/promocoes'/);
    assert.match(html, /'\/api\/cupons'/);
  });

  it('FASE 8: a página de caixa mostra receita, despesa e saldo', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/caixa.html', import.meta.url), 'utf8');

    assert.match(html, /id="resumo-receita"/);
    assert.match(html, /id="resumo-despesas"/);
    assert.match(html, /id="resumo-saldo"/);
    assert.match(html, /id="lista-periodos"/);
    assert.match(html, /id="lista-produtos"/);
    assert.match(html, /\/api\/relatorios\/caixa/);
    assert.match(html, /\/api\/relatorios\/produtos/);
  });

  it('o painel do dono permite escolher a ARTE do produto (mascote)', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/produtos.html', import.meta.url), 'utf8');

    assert.match(html, /id="grade-mascotes"/);
    assert.match(html, /function montarGradeDeMascotes/);
    assert.match(html, /mascote: mascoteEscolhido/);
    // a mesma lista de monstros do servidor
    for (const mascote of ['frank', 'draculinha', 'lobisomem', 'monstro-pantano', 'zumbi', 'mumia', 'fantasma', 'esqueleto', 'bruxa']) {
      assert.ok(html.includes(mascote), `esperava o mascote ${mascote} na grade de opções`);
    }
  });

  it('FASE 3: a página de compras existe com formulário e histórico', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/compras.html', import.meta.url), 'utf8');

    assert.match(html, /id="form-compra"/);
    assert.match(html, /id="compra-tipo"/);
    assert.match(html, /id="compra-item"/);
    assert.match(html, /id="compra-valor"/);
    assert.match(html, /id="lista-compras"/);
    assert.match(html, /média ponderada/i);
  });

  it('o painel mostra os pedidos dos clientes e a receita', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile(new URL('../public/admin/painel.html', import.meta.url), 'utf8');
    const layout = await fs.readFile(new URL('../public/js/layout.js', import.meta.url), 'utf8');

    assert.match(html, /id="lista-pedidos-admin"/);
    assert.match(html, /id="receita-total"/);
    // o link para Compras vive no mapa de telas do admin (layout.js)
    assert.match(layout, /\/admin\/compras\.html/);
  });
});
