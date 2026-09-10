/* =====================================================================
   musica.js — tema 8-bits "dark" da Monster Burguer 🎵

   ⚠️ ESTE ARQUIVO É CARREGADO COMO `type="module"` (veja o <script> nas páginas).
   Motivo: módulo tem ESCOPO PRÓPRIO. Sem isso, as variáveis daqui (botao,
   contexto, tocando...) vazariam para o escopo global e colidiriam com as
   variáveis das páginas — foi exatamente o que aconteceu: o login declara
   `const botao` e o navegador abortava o script da página inteira com
   "Identifier 'botao' has already been declared". Lição: global é terra de
   ninguém; cada arquivo cuida do seu quintal.

   Como funciona (e por quê):
   * O tema é GERADO em tempo real com a Web Audio API (osciladores + ruído).
     Vantagens: nenhum arquivo de áudio para baixar, zero peso no repositório e
     o som é infinito (loop) sem "corte" no fim.
   * CONTINUIDADE entre páginas: o navegador descarrega tudo ao trocar de página,
     então salva a POSIÇÃO (ms tocados) no sessionStorage. Ao abrir a outra
     página, o tema retoma do ponto em que estava — não reinicia nem trava.
   * PARADA: só quando o usuário entra (login). A função `pararMusica()` limpa o
     estado salvo, então a música não volta a tocar depois de logar.
   * AUTOPLAY: navegadores exigem interação do usuário antes de tocar som. Se o
     áudio for bloqueado, o tema começa no primeiro clique/tecla do usuário
     (e o botão flutuante permite ligar/desligar manualmente).
   ===================================================================== */

const CHAVE_ESTADO = 'monsterMusica';
const PASSO_SEGUNDOS = 0.15;   // 16 avos a 100 BPM
const PASSOS_NO_LOOP = 128;    // 8 compassos de 4 tempos
const VOLUME_MESTRE = 0.42;

/* --------------------------- estado interno --------------------------- */
let contexto = null;
let ganhoMestre = null;
let temporizador = null;
let tocando = false;
let posicaoHerdadaMs = 0;      // posição vinda da página anterior
let inicioRealMs = 0;          // performance.now() quando o som começou
let inicioTempoCtx = 0;        // contexto.currentTime quando o som começou
let passoInicial = 0;
let proximoPasso = 0;
let botao = null;

/* ------------------------- tabela de notas ---------------------------- */
const SEMITONS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

/** "A4" -> 440 Hz (padrão A4 = 440) */
function frequencia(nota) {
  const encontrado = /^([A-G]#?)(\d)$/.exec(nota);
  if (!encontrado) return 440;
  const [, nome, oitava] = encontrado;
  const midi = (Number(oitava) + 1) * 12 + SEMITONS[nome];
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Melodia (tema sombrio em Lá menor, com o sol# do modo harmônico no fim).
 * Cada item: [passo, nota, duração em passos]
 */
const MELODIA = [
  [0, 'A4', 6], [6, 'C5', 2], [8, 'E5', 4], [12, 'D5', 2], [14, 'C5', 2],
  [16, 'C5', 6], [22, 'A4', 2], [24, 'F4', 4], [28, 'A4', 4],
  [32, 'B4', 4], [36, 'D5', 4], [40, 'G5', 6], [46, 'F5', 2],
  [48, 'E5', 8], [56, 'B4', 4], [60, 'G4', 4],
  [64, 'A4', 4], [68, 'C5', 4], [72, 'E5', 8],
  [80, 'F5', 6], [86, 'E5', 2], [88, 'D5', 4], [92, 'C5', 4],
  [96, 'B4', 6], [102, 'G#4', 2], [104, 'B4', 4], [108, 'E5', 4],
  [112, 'G#5', 8], [120, 'B4', 4], [124, 'E5', 4],
];

/** Acorde de cada compasso (8 compassos): raiz + notas do arpejo. */
const COMPASSOS = [
  { baixo: 'A2', arpejo: ['A3', 'C4', 'E4'] },  // Am
  { baixo: 'F2', arpejo: ['F3', 'A3', 'C4'] },  // F
  { baixo: 'G2', arpejo: ['G3', 'B3', 'D4'] },  // G
  { baixo: 'E2', arpejo: ['E3', 'G3', 'B3'] },  // Em
  { baixo: 'A2', arpejo: ['A3', 'C4', 'E4'] },  // Am
  { baixo: 'F2', arpejo: ['F3', 'A3', 'C4'] },  // F
  { baixo: 'E2', arpejo: ['E3', 'G#3', 'B3'] }, // E (modo harmônico)
  { baixo: 'E2', arpejo: ['E3', 'G#3', 'B3'] }, // E
];

const MELODIA_POR_PASSO = new Map(MELODIA.map(([passo, nota, duracao]) => [passo, { nota, duracao }]));

/* --------------------------- persistência ----------------------------- */
function lerEstado() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_ESTADO));
  } catch {
    return null;
  }
}

function salvarEstado(estado) {
  try {
    sessionStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado));
  } catch {
    /* sessionStorage indisponível (modo privado): a música toca, só não persiste */
  }
}

function limparEstado() {
  try {
    sessionStorage.removeItem(CHAVE_ESTADO);
  } catch {
    /* ignora */
  }
}

/** Quantos ms de música já tocaram (posição "virtual", contando o que herdou). */
function posicaoAtualMs() {
  if (!tocando) return posicaoHerdadaMs;
  return posicaoHerdadaMs + (performance.now() - inicioRealMs);
}

function salvarPosicao() {
  salvarEstado({ ativa: tocando, posicaoMs: Math.round(posicaoAtualMs()), salvoEm: Date.now() });
}

/* ----------------------------- síntese -------------------------------- */
function envelope(quando, duracao, pico) {
  const g = contexto.createGain();
  g.gain.setValueAtTime(0.0001, quando);
  g.gain.linearRampToValueAtTime(pico, quando + 0.012);
  g.gain.exponentialRampToValueAtTime(pico * 0.55, quando + duracao * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, quando + duracao);
  return g;
}

/** Nota "chiptune": onda quadrada (com leve desafinação para dar corpo). */
function tocarNota(nota, quando, duracao, volume = 0.16) {
  const frequenciaBase = frequencia(nota);

  [0, 6].forEach((desafinacao) => {
    const oscilador = contexto.createOscillator();
    oscilador.type = 'square';
    oscilador.frequency.value = frequenciaBase;
    oscilador.detune.value = desafinacao;

    const g = envelope(quando, duracao, volume / 2);
    oscilador.connect(g).connect(ganhoMestre);
    oscilador.start(quando);
    oscilador.stop(quando + duracao + 0.05);
  });
}

function tocarBaixo(nota, quando, duracao) {
  const oscilador = contexto.createOscillator();
  oscilador.type = 'triangle';
  oscilador.frequency.value = frequencia(nota);

  const g = envelope(quando, duracao, 0.30);
  oscilador.connect(g).connect(ganhoMestre);
  oscilador.start(quando);
  oscilador.stop(quando + duracao + 0.05);
}

function tocarBumbo(quando) {
  const oscilador = contexto.createOscillator();
  oscilador.type = 'sine';
  oscilador.frequency.setValueAtTime(130, quando);
  oscilador.frequency.exponentialRampToValueAtTime(45, quando + 0.12);

  const g = envelope(quando, 0.22, 0.5);
  oscilador.connect(g).connect(ganhoMestre);
  oscilador.start(quando);
  oscilador.stop(quando + 0.3);
}

let bufferRuido = null;

function tocarChimbal(quando) {
  if (!bufferRuido) {
    const amostras = contexto.sampleRate * 0.06;
    bufferRuido = contexto.createBuffer(1, amostras, contexto.sampleRate);
    const canal = bufferRuido.getChannelData(0);
    for (let i = 0; i < amostras; i += 1) canal[i] = Math.random() * 2 - 1;
  }

  const fonte = contexto.createBufferSource();
  fonte.buffer = bufferRuido;

  const filtro = contexto.createBiquadFilter();
  filtro.type = 'highpass';
  filtro.frequency.value = 6500;

  const g = envelope(quando, 0.05, 0.10);
  fonte.connect(filtro).connect(g).connect(ganhoMestre);
  fonte.start(quando);
  fonte.stop(quando + 0.08);
}

/* --------------------------- sequenciador ----------------------------- */
function tocarPasso(passo, quando) {
  const passoNoLoop = ((passo % PASSOS_NO_LOOP) + PASSOS_NO_LOOP) % PASSOS_NO_LOOP;
  const indiceCompasso = Math.floor(passoNoLoop / 16) % COMPASSOS.length;
  const passoNoCompasso = passoNoLoop % 16;
  const compasso = COMPASSOS[indiceCompasso];

  // baixo: fundamental no tempo 1 e no tempo 3
  if (passoNoCompasso === 0 || passoNoCompasso === 8) {
    tocarBaixo(compasso.baixo, quando, PASSO_SEGUNDOS * 6);
  }

  // arpejo em colcheias (bem discreto, dá o clima "trilha de jogo")
  if (passoNoCompasso % 2 === 0) {
    const notaArpejo = compasso.arpejo[(passoNoLoop / 2) % compasso.arpejo.length];
    tocarNota(notaArpejo, quando, PASSO_SEGUNDOS * 1.6, 0.05);
  }

  // percussão
  if (passoNoCompasso === 0 || passoNoCompasso === 10) tocarBumbo(quando);
  if (passoNoCompasso % 4 === 2) tocarChimbal(quando);

  // melodia
  const nota = MELODIA_POR_PASSO.get(passoNoLoop);
  if (nota) {
    tocarNota(nota.nota, quando, PASSO_SEGUNDOS * nota.duracao * 0.92, 0.20);
  }
}

/** Agenda os próximos passos com folga, para não depender do timing do setTimeout. */
function agendarPassos() {
  const decorrido = contexto.currentTime - inicioTempoCtx;
  const passoAtual = passoInicial + Math.floor(decorrido / PASSO_SEGUNDOS);

  while (proximoPasso <= passoAtual + 4) {
    const quando = inicioTempoCtx + (proximoPasso - passoInicial) * PASSO_SEGUNDOS;
    if (quando >= contexto.currentTime) tocarPasso(proximoPasso, quando);
    proximoPasso += 1;
  }
}

/* ----------------------------- controle ------------------------------- */
function iniciarSom(posicaoMs = 0) {
  if (tocando) return;

  contexto = new (window.AudioContext || window.webkitAudioContext)();

  ganhoMestre = contexto.createGain();
  ganhoMestre.gain.value = 0;
  ganhoMestre.connect(contexto.destination);
  // fade-in suave (não "estraga" o ouvido de quem entra na página)
  ganhoMestre.gain.linearRampToValueAtTime(VOLUME_MESTRE, contexto.currentTime + 1.2);

  posicaoHerdadaMs = posicaoMs;
  inicioRealMs = performance.now();
  inicioTempoCtx = contexto.currentTime;
  passoInicial = Math.round(posicaoMs / 1000 / PASSO_SEGUNDOS);
  proximoPasso = passoInicial;

  tocando = true;
  agendarPassos();
  temporizador = setInterval(() => {
    agendarPassos();
    salvarPosicao();
  }, 250);

  atualizarBotao();
}

function pararSom() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;

  if (ganhoMestre && contexto) {
    ganhoMestre.gain.cancelScheduledValues(contexto.currentTime);
    ganhoMestre.gain.setValueAtTime(ganhoMestre.gain.value, contexto.currentTime);
    ganhoMestre.gain.linearRampToValueAtTime(0.0001, contexto.currentTime + 0.25);
  }

  const contextoAtual = contexto;
  setTimeout(() => { contextoAtual?.close?.(); }, 350);

  contexto = null;
  ganhoMestre = null;
  tocando = false;
  atualizarBotao();
}

/** Para a música E apaga o estado: usada quando o usuário LOGA. */
function pararMusica() {
  pararSom();
  limparEstado();
}

/** Liga/desliga manualmente (botão flutuante). */
function alternarMusica() {
  if (tocando) {
    pararSom();
    salvarEstado({ ativa: false, posicaoMs: Math.round(posicaoAtualMs()), salvoEm: Date.now() });
  } else {
    iniciarSom(posicaoAtualMs());
    salvarEstado({ ativa: true, posicaoMs: Math.round(posicaoAtualMs()), salvoEm: Date.now() });
  }
}

/* -------------------------- botão flutuante --------------------------- */
function criarBotao() {
  if (botao) return botao;

  botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'musica-botao';
  botao.addEventListener('click', alternarMusica);
  document.body.appendChild(botao);
  return botao;
}

function atualizarBotao() {
  const alvo = criarBotao();
  alvo.textContent = tocando ? '🔊' : '🔇';
  alvo.title = tocando ? 'Desligar a musiquinha' : 'Ligar a musiquinha';
  alvo.setAttribute('aria-label', alvo.title);
  alvo.setAttribute('aria-pressed', String(tocando));
}

/* ------------------------------ inicial ------------------------------- */
function iniciarMusica() {
  const estado = lerEstado();

  if (estado && estado.ativa === false) {
    posicaoHerdadaMs = estado.posicaoMs ?? 0;
    atualizarBotao(); // começa desligada, botão liga
    return;
  }

  // Retoma exatamente de onde parou (somando o tempo em que a outra página ficou aberta)
  const posicao = estado
    ? (estado.posicaoMs ?? 0) + (Date.now() - (estado.salvoEm ?? Date.now()))
    : 0;

  posicaoHerdadaMs = posicao;

  const tentar = () => {
    try {
      iniciarSom(posicao);
      if (contexto?.state === 'suspended') contexto.resume();
    } catch {
      /* navegador sem Web Audio: a página funciona normalmente, só sem música */
    }
  };

  tentar(); // pode funcionar se o usuário já interagiu com o site antes

  // Se o navegador bloqueou o autoplay, começa na primeira interação.
  const aoInteragir = () => {
    if (!tocando) tentar();
    if (tocando) {
      window.removeEventListener('pointerdown', aoInteragir);
      window.removeEventListener('keydown', aoInteragir);
    }
  };

  window.addEventListener('pointerdown', aoInteragir);
  window.addEventListener('keydown', aoInteragir);

  atualizarBotao();
}

// Se o módulo carregar depois do HTML pronto, inicia na hora; senão espera o DOM.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarMusica);
} else {
  iniciarMusica();
}

// Garante o estado salvo quando a página está saindo (troca de login <-> cadastro).
window.addEventListener('pagehide', () => {
  if (tocando) salvarPosicao();
});

// Exposto para as páginas: o login chama `pararMusica()` ao entrar.
window.pararMusica = pararMusica;
window.musicaEstaTocando = () => tocando;
