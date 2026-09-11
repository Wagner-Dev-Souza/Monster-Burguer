import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

/**
 * REGRESSÃO: COLISÃO DE ESCOPO GLOBAL ENTRE OS SCRIPTS DE UMA PÁGINA.
 *
 * Este arquivo existe por causa de dois bugs reais (o mesmo, duas vezes):
 *
 *  1. `musica.js` declarava `let botao` e o login declarava `const botao`.
 *  2. `layout.js` passou a declarar `reais()` e três páginas do painel também
 *     declaravam `const reais`.
 *
 * Nos dois casos o navegador aborta o SCRIPT INTEIRO da página com
 * "Identifier 'x' has already been declared" — o formulário simplesmente para de
 * funcionar, sem mensagem visível. É um erro de PARSE: nada roda, nem a primeira
 * linha. E é silencioso o bastante para passar despercebido em teste de HTML.
 *
 * COMO O TESTE PEGA ISSO: os scripts clássicos de uma página compartilham o mesmo
 * escopo global. Se juntarmos o código deles num único texto e tentarmos compilar,
 * o `vm` acusa exatamente o mesmo SyntaxError que o navegador acusaria. Módulos
 * (`type="module"`) ficam de fora: eles têm escopo próprio e não colidem.
 */
const PAGINAS = [
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

/** Extrai os scripts CLÁSSICOS da página (src de arquivo + inline), na ordem. */
async function scriptsClassicosDaPagina(pagina) {
  const caminho = new URL(`../public/${pagina}`, import.meta.url);
  const html = await fs.readFile(caminho, 'utf8');

  // O negative lookahead pula <script type="module">: escopo isolado, sem colisão.
  const etiquetas = [...html.matchAll(/<script((?![^>]*type="module")[^>]*)>([\s\S]*?)<\/script>/g)];

  const partes = [];

  for (const [, atributos, inline] of etiquetas) {
    const src = /src="([^"]+)"/.exec(atributos)?.[1];

    if (src) {
      const arquivo = new URL(`../public${src}`, import.meta.url);
      partes.push({ origem: src, codigo: await fs.readFile(arquivo, 'utf8') });
      continue;
    }

    if (inline.trim().length > 0) {
      partes.push({ origem: `${pagina} (script inline)`, codigo: inline });
    }
  }

  return partes;
}

/** Nomes declarados no nível de cima do arquivo (const/let/var/function). */
function nomesDeTopo(codigo) {
  const nomes = new Set();

  for (const [, tipo, nome] of codigo.matchAll(/^[ \t]*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (tipo) nomes.add(nome);
  }

  for (const [, nome] of codigo.matchAll(/^[ \t]*function\s+([A-Za-z_$][\w$]*)/gm)) {
    nomes.add(nome);
  }

  return nomes;
}

describe('Escopo global das páginas (regressão)', () => {
  for (const pagina of PAGINAS) {
    it(`${pagina}: os scripts não colidem entre si`, async () => {
      const partes = await scriptsClassicosDaPagina(pagina);
      const codigoJunto = partes.map((parte) => `// ${parte.origem}\n${parte.codigo}`).join('\n;\n');

      // Compilar junta é exatamente o que o navegador faz com scripts clássicos:
      // a mesma declaração duas vezes vira SyntaxError e mata a página inteira.
      assert.doesNotThrow(
        () => new vm.Script(codigoJunto, { filename: pagina }),
        `${pagina}: dois scripts declaram o mesmo nome no escopo global`,
      );
    });
  }

  it('nenhum arquivo compartilhado declara nomes genéricos soltos', async () => {
    // Nomes que já causaram problema e/ou são genéricos demais para o global.
    const proibidos = ['botao', 'aviso', 'form', 'contexto', 'tocando', 'lista', 'dados'];

    for (const arquivo of ['js/api.js', 'js/layout.js', 'js/carrinho.js', 'js/mascote.js', 'js/senha.js']) {
      const codigo = await fs.readFile(new URL(`../public/${arquivo}`, import.meta.url), 'utf8');
      const nomes = nomesDeTopo(codigo);

      for (const proibido of proibidos) {
        assert.ok(
          !nomes.has(proibido),
          `${arquivo} declara "${proibido}" no escopo global — use um nome específico ou isole em módulo`,
        );
      }
    }
  });
});
