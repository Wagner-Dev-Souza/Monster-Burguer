/* =====================================================================
   carrinho.js — o carrinho de compras, compartilhado entre as páginas.

   POR QUE UM OBJETO GLOBAL (`Carrinho`) E NÃO MÓDULO?
   A lição do `botao` (ver musica.js) é: NÃO espalhar variáveis soltas no escopo
   global. Aqui a escolha é consciente e diferente: um ÚNICO nome, `Carrinho`,
   que funciona como um "sobrenome" para tudo do carrinho (Carrinho.adicionar,
   Carrinho.total...). É o padrão clássico de namespace: um só morador no terreno
   público, e ele é bem identificado.

   Por que não `type="module"`? Porque as páginas são scripts clássicos e usam o
   carrinho já na inicialização — módulo é adiado (defer) e chegaria tarde.

   ONDE O CARRINHO MORA: localStorage, com chave POR USUÁRIO
   (`monsterCarrinho:<id>`). Assim duas contas na mesma máquina não misturam
   pedidos, e o carrinho sobrevive à navegação entre cardápio → carrinho →
   checkout — que agora são páginas separadas.

   LISTENERS: quem quiser redesenhar quando o carrinho mudar chama
   `Carrinho.assinar(fn)`. Isso evita a página ficar consultando "mudou? mudou?"
   de tempo em tempo.
   ===================================================================== */
window.Carrinho = (() => {
  const PREFIXO_CHAVE = 'monsterCarrinho:';

  let chave = null;      // definida em `carregar(usuarioId)`
  let itens = [];
  const ouvintes = [];

  /* ----------------------------- persistência ----------------------------- */
  function ler() {
    try {
      const bruto = localStorage.getItem(chave);
      const lista = JSON.parse(bruto ?? '[]');
      return Array.isArray(lista) ? lista : [];
    } catch {
      return []; // localStorage bloqueado ou JSON corrompido: carrinho vazio
    }
  }

  function salvar() {
    try {
      localStorage.setItem(chave, JSON.stringify(itens));
    } catch {
      /* modo privado: o carrinho funciona na sessão, só não persiste */
    }
  }

  function avisar() {
    salvar();
    atualizarContador();
    ouvintes.forEach((fn) => fn(itens));
  }

  /* -------------------------------- API ---------------------------------- */
  function carregar(usuarioId) {
    chave = `${PREFIXO_CHAVE}${usuarioId}`;
    itens = ler();
    atualizarContador();
    return itens;
  }

  function adicionar(produto, quantidade = 1) {
    const existente = itens.find((item) => item.produtoId === produto.id);

    if (existente) {
      existente.quantidade += quantidade;
      // O preço pode ter mudado (promoção nova): vale sempre o mais recente.
      existente.precoVenda = produto.precoVenda;
      existente.mascote = produto.mascote ?? existente.mascote;
    } else {
      itens.push({
        produtoId: produto.id,
        nome: produto.nome,
        tipo: produto.tipo,
        mascote: produto.mascote ?? null,
        precoVenda: produto.precoVenda,
        quantidade,
      });
    }

    avisar();
    return itens;
  }

  /** delta = +1 / -1 (zerar a quantidade remove o item). */
  function alterarQuantidade(produtoId, delta) {
    const item = itens.find((linha) => linha.produtoId === produtoId);
    if (!item) return itens;

    item.quantidade += delta;
    if (item.quantidade <= 0) itens = itens.filter((linha) => linha.produtoId !== produtoId);

    avisar();
    return itens;
  }

  function remover(produtoId) {
    itens = itens.filter((item) => item.produtoId !== produtoId);
    avisar();
    return itens;
  }

  function limpar() {
    itens = [];
    avisar();
    return itens;
  }

  function listar() {
    return itens;
  }

  function quantidade() {
    return itens.reduce((soma, item) => soma + item.quantidade, 0);
  }

  function total() {
    return itens.reduce((soma, item) => soma + item.precoVenda * item.quantidade, 0);
  }

  function vazio() {
    return itens.length === 0;
  }

  /** Deixa o item do carrinho no formato que a API de pedidos espera. */
  function paraPedido() {
    return itens.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade }));
  }

  /** Pinta todos os contadores do topo (`data-contador-carrinho`). */
  function atualizarContador() {
    document.querySelectorAll('[data-contador-carrinho]').forEach((el) => {
      const valor = quantidade();
      el.textContent = String(valor);
      el.hidden = valor === 0;
    });
  }

  function assinar(fn) {
    ouvintes.push(fn);
  }

  return {
    carregar,
    adicionar,
    alterarQuantidade,
    remover,
    limpar,
    listar,
    quantidade,
    total,
    vazio,
    paraPedido,
    atualizarContador,
    assinar,
  };
})();
