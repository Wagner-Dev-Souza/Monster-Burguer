/* =====================================================================
   senha.js — botão de MOSTRAR/ESCONDER senha.

   Como funciona:
     * no HTML, cada campo de senha fica dentro de `.campo-senha` e tem um
       botão vizinho com o atributo `data-alternar-senha`
     * ao clicar, trocamos o `type` do input entre "password" e "text"
     * o ícone e o rótulo de acessibilidade são atualizados junto

   Por que um botão e não um "olhinho" clicável em cima do campo? Botão é
   navegável pelo teclado (Tab + Enter) e leitor de tela anuncia o que ele faz —
   acessibilidade de graça.
   ===================================================================== */
function inicializarAlternarSenha() {
  const botoes = document.querySelectorAll('[data-alternar-senha]');

  botoes.forEach((botao) => {
    botao.addEventListener('click', () => {
      const seletor = botao.getAttribute('data-alternar-senha');
      const campo = document.querySelector(seletor);
      if (!campo) return;

      const estaEscondida = campo.type === 'password';
      campo.type = estaEscondida ? 'text' : 'password';

      botao.textContent = estaEscondida ? '🙈' : '👁️';
      botao.setAttribute('aria-label', estaEscondida ? 'Esconder senha' : 'Mostrar senha');
      botao.setAttribute('aria-pressed', String(estaEscondida));

      campo.focus(); // devolve o foco para quem está digitando
    });
  });
}

document.addEventListener('DOMContentLoaded', inicializarAlternarSenha);
