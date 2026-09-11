/* =====================================================================
   layout.js — pedaços de interface COMPARTILHADOS entre as páginas.

   Por quê um arquivo só? O cabeçalho (navegação) e o selo do usuário são os
   mesmos em todas as telas. Se cada página montasse o seu, qualquer mudança
   viraria N alterações — e uma delas esquecida. Aqui é uma fonte da verdade.
   ===================================================================== */

/**
 * MAPA DAS TELAS — a navegação nasce daqui.
 *
 * Cada papel tem o seu conjunto de telas. Isso é o que "quebra a home em janelas"
 * de forma organizada: o cliente não vê um painel com cinco cards, ele navega
 * entre páginas dedicadas (cardápio, carrinho, pedidos, acompanhar, conta).
 *
 * ⚠️ Navegação é só experiência de uso. A segurança de verdade está no servidor
 * (guard das páginas /admin/* e o middleware somenteAdmin nas APIs).
 */
const PAGINAS_POR_PAPEL = {
  cliente: [
    { href: '/loja.html', rotulo: '🍔 Cardápio' },
    { href: '/carrinho.html', rotulo: '🛒 Carrinho', contador: true },
    { href: '/pedidos.html', rotulo: '📋 Meus pedidos' },
    { href: '/acompanhar.html', rotulo: '🚚 Acompanhar' },
    { href: '/conta.html', rotulo: '🙋 Minha conta' },
  ],
  admin: [
    { href: '/admin/painel.html', rotulo: '👑 Painel' },
    { href: '/admin/produtos.html', rotulo: '🍔 Produtos' },
    { href: '/admin/promocoes.html', rotulo: '🎟️ Promoções' },
    { href: '/admin/compras.html', rotulo: '📦 Compras' },
    { href: '/admin/caixa.html', rotulo: '💰 Caixa' },
    { href: '/loja.html', rotulo: '🛍️ Ver a loja' },
  ],
};

/**
 * Ajusta a navegação conforme o PAPEL do usuário.
 *
 * Como funciona: no HTML, os elementos administrativos nascem com
 * `data-somente-admin` + `hidden`; os exclusivos de cliente com
 * `data-somente-cliente` + `hidden`. Aqui revelamos só o que faz sentido.
 */
function ajustarNavegacao(usuario) {
  const ehAdmin = usuario.papel === 'admin';

  document.querySelectorAll('[data-somente-admin]').forEach((el) => {
    el.hidden = !ehAdmin;
  });

  document.querySelectorAll('[data-somente-cliente]').forEach((el) => {
    el.hidden = ehAdmin;
  });

  // A barra de abas em si (montada abaixo a partir do mapa de telas).
  const nav = document.querySelector('[data-nav]');
  if (nav) nav.hidden = false;
}

/** Monta a barra de abas do papel e marca a página atual como ativa. */
function montarNavegacao(usuario) {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;

  const caminhoAtual = window.location.pathname.replace(/\/+$/, '') || '/index.html';
  const telas = PAGINAS_POR_PAPEL[usuario.papel] ?? PAGINAS_POR_PAPEL.cliente;

  nav.innerHTML = '';

  telas.forEach((tela) => {
    const link = document.createElement('a');
    link.href = tela.href;
    link.textContent = tela.rotulo;

    // Marca a aba atual (comparando só o nome do arquivo, para não errar com ?query).
    const arquivoAtual = caminhoAtual.split('/').pop();
    const arquivoTela = tela.href.split('/').pop();
    if (arquivoAtual === arquivoTela) link.classList.add('ativo');

    if (tela.contador) {
      const bolinha = document.createElement('span');
      bolinha.className = 'contador-carrinho';
      bolinha.setAttribute('data-contador-carrinho', '');
      bolinha.textContent = '0';
      link.appendChild(bolinha);
    }

    nav.appendChild(link);
  });

  nav.hidden = false;

  // O carrinho é quem sabe quantos itens existem: se o módulo já estiver na
  // página, ele repinta o contador agora.
  window.Carrinho?.atualizarContador?.();
}

/** Preenche nome, primeiro nome, selo do topo e avisos contextuais. */
function exibirUsuario(usuario) {
  document.querySelectorAll('[data-nome-usuario]').forEach((el) => {
    el.textContent = usuario.nome;
  });

  document.querySelectorAll('[data-primeiro-nome]').forEach((el) => {
    el.textContent = usuario.nome.split(' ')[0];
  });

  // O selo no canto superior direito mostra o NOME da pessoa (com o ícone do
  // papel) e o ID simples dela (#0001, #0002...), para identificar na conversa
  // quem fez cada coisa no sistema.
  document.querySelectorAll('[data-papel-usuario]').forEach((el) => {
    const icone = usuario.papel === 'admin' ? '👑' : '🙋';
    el.textContent = `${icone} ${usuario.nome} · ${usuario.codigo}`;
    el.className = `selo ${usuario.papel}`;
    el.title = usuario.papel === 'admin'
      ? `Administrador da loja (${usuario.codigo})`
      : `Cliente ${usuario.codigo}`;
  });

  // Onde aparecer só o código (ex.: "Minha conta")
  document.querySelectorAll('[data-codigo-usuario]').forEach((el) => {
    el.textContent = usuario.codigo;
  });

  // Avisos que só fazem sentido para admin (ex.: regra de exclusão de conta).
  document.querySelectorAll('[data-aviso-admin]').forEach((el) => {
    el.hidden = usuario.papel !== 'admin';
  });
}

/** Atalho: protege a página e já desenha a interface do usuário. */
async function iniciarPagina(papelNecessario) {
  const usuario = await protegerPagina(papelNecessario);
  if (!usuario) return null; // redirecionou

  exibirUsuario(usuario);
  ajustarNavegacao(usuario);
  montarNavegacao(usuario);
  return usuario;
}

/** Formata centavos/reais no padrão brasileiro: 1234.5 -> "R$ 1.234,50". */
function reais(valor) {
  return `R$ ${Number(valor ?? 0).toFixed(2).replace('.', ',')}`;
}
