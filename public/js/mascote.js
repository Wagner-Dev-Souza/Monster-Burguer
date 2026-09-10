/* =====================================================================
   mascote.js — sorteia um personagem da turma para o topo das telas.

   Por quê? Dá vida às telas de login/cadastro: a cada visita aparece um
   monstro diferente, sem custo nenhum (é só trocar o `src` da imagem).
   ===================================================================== */

const MASCOTES = [
  { arquivo: 'fantasma', nome: 'Fantasma' },
  { arquivo: 'esqueleto', nome: 'Esqueleto' },
  { arquivo: 'bruxa', nome: 'Bruxa' },
  { arquivo: 'frank', nome: 'Frank' },
  { arquivo: 'draculinha', nome: 'Draculinha' },
  { arquivo: 'lobisomem', nome: 'Lobi' },
  { arquivo: 'mumia', nome: 'Faraó Múmia' },
  { arquivo: 'monstro-pantano', nome: 'Monstro do Pântano' },
  { arquivo: 'zumbi', nome: 'Zu' },
];

/** Escreve um mascote sorteado em todo elemento [data-mascote-aleatorio]. */
function sortearMascote() {
  const alvos = document.querySelectorAll('[data-mascote-aleatorio]');
  if (alvos.length === 0) return;

  const sorteado = MASCOTES[Math.floor(Math.random() * MASCOTES.length)];

  alvos.forEach((alvo) => {
    alvo.src = `/img/monstros/${sorteado.arquivo}.svg`;
    alvo.alt = sorteado.nome;
  });

  // Exposto para depuração no console do navegador (útil para conferir o sorteio).
  window.mascoteSorteado = sorteado;
}

document.addEventListener('DOMContentLoaded', sortearMascote);
