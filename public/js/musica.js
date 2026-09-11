/* =====================================================================
   musica.js — tema 8-bits "dark" da Monster Burguer 🎵
   Toca em TODO o site, sem cortar ao trocar de página: login, cadastro,
   loja, painel, produtos, compras — a mesma música, sem reiniciar.

   ⚠️ ESTE ARQUIVO É CARREGADO COMO `type="module"` (veja o <script> nas páginas).
   Motivo: módulo tem ESCOPO PRÓPRIO. Sem isso, as variáveis daqui (botao,
   contexto, tocando...) vazariam para o escopo global e colidiriam com as
   variáveis das páginas — foi exatamente o que aconteceu: o login declara
   `const botao` e o navegador abortava o script da página inteira com
   "Identifier 'botao' has already been declared". Lição: global é terra de
   ninguém; cada arquivo cuida do seu quintal.

   COMO A CONTINUIDADE FUNCIONA (o coração do arquivo):
   Trocar de página no navegador DESTRÓI tudo que estava rodando (o áudio morre
   junto). Não dá para "manter tocando" entre páginas soltas. O truque é não
   guardar "quantos ms tocaram", e sim uma ÂNCORA DE RELÓGIO:

       inicioEm = Date.now() - posicaoMs        (gravado no sessionStorage)

   Posição em qualquer momento = Date.now() - inicioEm.

   Por que isso é melhor do que salvar a posição a cada 250ms? Porque não
   ACUMULA ERRO: o relógio é a única fonte da verdade. Se a página ficou 3
   segundos carregando, a música retoma 3 segundos depois — no mesmo compasso
   em que estaria, como se nunca tivesse parado. Salvar posição em intervalos
   somaria os atrasos de cada troca de página e a música iria ficando para trás.

   * ÁUDIO: gerado em tempo real com a Web Audio API (osciladores + ruído).
     Nenhum arquivo para baixar, zero peso no repositório, loop infinito sem
     "corte" no fim do arquivo.
   * AUTOPLAY: navegadores exigem interação do usuário para tocar som. Se o
     áudio for bloqueado, o tema começa na primeira tecla/clique — já no ponto
     certo do relógio, nunca do zero.
   * BOTÃO FLUTANTE (🔊/🔇): liga/desliga e a escolha vale para o site inteiro
     (fica gravada no estado). Desligado continua desligado ao navegar.
   * ABAS: só UMA aba toca por vez (trava no localStorage com batida de
     coração). Duas abas abertas — coisa que acontece muito aqui, com a loja e
     o painel lado a lado — tocariam a mesma trilha fora de fase, um som sujo.
     Quem chega depois espera a vez; quando a aba que tocava fecha, a outra
     assume sozinha.
   ===================================================================== */

const CHAVE_ESTADO = 'monsterMusica';
const CHAVE_DONO = 'monsterMusicaAbaAtiva';
const PASSO_SEGUNDOS = 0.15;   // 16 avos a 100 BPM
const PASSOS_NO_LOOP = 128;    // 8 compassos de 4 tempos
const VOLUME_MESTRE = 0.42;
const INTERVALO_BATIDA_MS = 1500;   // batida de coração da aba que toca
const VALIDADE_BATIDA_MS = 4000;    // batida mais velha que isso = aba morta

/* --------------------------- estado interno --------------------------- */
let contexto = null;
let ganhoMestre = null;
let temporizador = null;
let batida = null;
let tocando = false;
let ancoragemEm = null;        // relógio da música (Date.now() - posicaoMs)
let posicaoPausadaMs = 0;      // posição congelada quando a música está desligada
let posicaoNoInicioMs = 0;     // posição no instante em que o som começou nesta página
let inicioRealMs = 0;          // performance.now() quando o som começou
let inicioTempoCtx = 0;        // contexto.currentTime quando o som começou
let passoInicial = 0;
let proximoPasso = 0;
let botao = null;
let esperandoOutraAba = false;
let relogioDeEspera = null;

const idDestaAba = `aba-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

/** Grava o estado com a âncora de relógio (o formato que garante a continuidade). */
function salvarEstadoAtual() {
  if (tocando) {
    salvarEstado({
      ativa: true,
      inicioEm: ancoragemEm,
      posicaoMs: Math.round(posicaoAtualMs()),
      salvoEm: Date.now(),
    });
    return;
  }

  salvarEstado({ ativa: false, posicaoMs: Math.round(posicaoPausadaMs), salvoEm: Date.now() });
}

/* ------------------------ posição na linha do tempo -------------------- */
/** Posição "virtual" agora, na linha do tempo da música. */
function posicaoAtualMs() {
  if (!tocando) return posicaoPausadaMs;
  return posicaoNoInicioMs + (performance.now() - inicioRealMs);
}

/** Posição indicada pela âncora de relógio (o que a música DEVERIA estar tocando). */
function posicaoDaAncora() {
  if (ancoragemEm === null) return posicaoPausadaMs;
  return Math.max(0, Date.now() - ancoragemEm);
}

/* ------------------- trava de aba (só uma toca por vez) ---------------- */
function lerDonoDaAba() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_DONO) ?? 'null');
  } catch {
    return null;
  }
}

/** Outra aba viva está tocando? (batida de coração recente e de outro id) */
function outraAbaEstaTocando() {
  const dono = lerDonoDaAba();
  if (!dono || dono.id === idDestaAba) return false;
  return Date.now() - (dono.em ?? 0) < VALIDADE_BATIDA_MS;
}

function assumirPosse() {
  try {
    localStorage.setItem(CHAVE_DONO, JSON.stringify({ id: idDestaAba, em: Date.now() }));
  } catch {
    /* sem localStorage: cada aba toca por si (pior caso, não quebra nada) */
  }

  if (batida) clearInterval(batida);
  batida = setInterval(assumirPosse, INTERVALO_BATIDA_MS);
}

function soltarPosse() {
  if (batida) clearInterval(batida);
  batida = null;

  const dono = lerDonoDaAba();
  if (dono?.id === idDestaAba) {
    try {
      localStorage.removeItem(CHAVE_DONO);
    } catch {
      /* ignora */
    }
  }
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
function iniciarSom(posicaoMs) {
  if (tocando) return;

  contexto = new (window.AudioContext || window.webkitAudioContext)();

  ganhoMestre = contexto.createGain();
  ganhoMestre.gain.value = 0;
  ganhoMestre.connect(contexto.destination);
  // fade-in curto: entrada suave sem parecer que a música "recomeçou"
  ganhoMestre.gain.linearRampToValueAtTime(VOLUME_MESTRE, contexto.currentTime + 0.6);

  posicaoNoInicioMs = posicaoMs;
  inicioRealMs = performance.now();
  inicioTempoCtx = contexto.currentTime;
  passoInicial = Math.round(posicaoMs / 1000 / PASSO_SEGUNDOS);
  proximoPasso = passoInicial;

  tocando = true;
  agendarPassos();

  temporizador = setInterval(() => {
    agendarPassos();
    salvarEstadoAtual();
  }, 250);

  assumirPosse();
  atualizarBotao();
}

function pararSom({ silencioso = false } = {}) {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;

  if (ganhoMestre && contexto && !silencioso) {
    ganhoMestre.gain.cancelScheduledValues(contexto.currentTime);
    ganhoMestre.gain.setValueAtTime(ganhoMestre.gain.value, contexto.currentTime);
    ganhoMestre.gain.linearRampToValueAtTime(0.0001, contexto.currentTime + 0.2);
  }

  const contextoAtual = contexto;
  setTimeout(() => { contextoAtual?.close?.(); }, 300 + (silencioso ? 0 : 200));

  contexto = null;
  ganhoMestre = null;
  tocando = false;
  soltarPosse();
}

/** Liga/desliga manualmente (botão flutuante). A escolha vale para o site todo. */
function alternarMusica() {
  if (tocando) {
    posicaoPausadaMs = posicaoAtualMs();
    ancoragemEm = null;              // pausado: o relógio para de correr
    pararSom();
    salvarEstadoAtual();
    return;
  }

  ligarNaPosicao(posicaoPausadaMs);
}

/**
 * Tenta ligar o som na posição pedida, respeitando a trava de aba e o autoplay.
 * Se nenhuma das duas condições permitir, tenta de novo em alguns segundos.
 */
function ligarNaPosicao(posicaoMs) {
  if (tocando) return;

  if (outraAbaEstaTocando()) {
    marcarEsperaPelaOutraAba();
    return;
  }

  try {
    iniciarSom(posicaoMs);
    ancoragemEm = Date.now() - posicaoMs;   // (re)ancora o relógio

    if (contexto?.state === 'suspended') contexto.resume();

    // O navegador pode ter bloqueado o autoplay: aí ele fica suspenso até o
    // primeiro toque. O estado fica salvo do mesmo jeito (posição certa).
    salvarEstadoAtual();
    atualizarBotao();
  } catch {
    /* navegador sem Web Audio: a página funciona normalmente, só sem música */
  }
}

function marcarEsperaPelaOutraAba() {
  esperandoOutraAba = true;
  atualizarBotao();

  if (relogioDeEspera) return;
  relogioDeEspera = setInterval(() => {
    if (!esperandoOutraAba || tocando) return;
    if (outraAbaEstaTocando()) return;

    // a aba que tocava fechou: assume o som na posição em que a linha do tempo está
    esperandoOutraAba = false;
    clearInterval(relogioDeEspera);
    relogioDeEspera = null;
    ligarNaPosicao(posicaoDaAncora());
  }, 2000);
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

  if (esperandoOutraAba) {
    alvo.textContent = '🔇';
    alvo.title = 'A musiquinha está tocando em outra aba';
  } else if (tocando) {
    alvo.textContent = '🔊';
    alvo.title = 'Desligar a musiquinha';
  } else {
    alvo.textContent = '🔇';
    alvo.title = 'Ligar a musiquinha';
  }

  alvo.setAttribute('aria-label', alvo.title);
  alvo.setAttribute('aria-pressed', String(tocando));
}

/* ------------------------------ inicial ------------------------------- */
function iniciarMusica() {
  const estado = lerEstado();

  // Usuário desligou a música: continua desligada ao navegar (escolha respeitada).
  if (estado && estado.ativa === false) {
    posicaoPausadaMs = estado.posicaoMs ?? 0;
    atualizarBotao();
    return;
  }

  /*
   * CONTINUIDADE SEM CORTE:
   *  - se veio estado, a âncora de relógio da página anterior é reaproveitada
   *    -> a música retoma no mesmo compasso, como se nunca tivesse parado;
   *  - se o estado é antigo (sem `inicioEm`), a posição salva + o tempo parado
   *    dão a âncora equivalente.
   */
  ancoragemEm = estado?.inicioEm
    ? estado.inicioEm
    : estado
      ? Date.now() - ((estado.posicaoMs ?? 0) + (Date.now() - (estado.salvoEm ?? Date.now())))
      : Date.now();

  posicaoPausadaMs = posicaoDaAncora();

  ligarNaPosicao(posicaoDaAncora());

  // Autoplay bloqueado? Começa na primeira interação — no ponto certo do relógio.
  const aoInteragir = () => {
    if (tocando) {
      window.removeEventListener('pointerdown', aoInteragir);
      window.removeEventListener('keydown', aoInteragir);
      return;
    }

    if (contexto?.state === 'suspended') {
      contexto.resume();
      ancoragemEm = Date.now() - posicaoPausadaMs;
      atualizarBotao();
      return;
    }

    if (!contexto) ligarNaPosicao(posicaoDaAncora());
  };

  window.addEventListener('pointerdown', aoInteragir);
  window.addEventListener('keydown', aoInteragir);

  // Enquanto o som não começa (autoplay bloqueado), a posição continua contando
  // no relógio — assim a música entra no compasso certo, não do zero.
  if (!tocando) {
    posicaoPausadaMs = posicaoDaAncora();
  }

  atualizarBotao();
}

// Se o módulo carregar depois do HTML pronto, inicia na hora; senão espera o DOM.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarMusica);
} else {
  iniciarMusica();
}

// Ao sair da página: salva a posição (para a próxima continuar) e libera a vez
// de outra aba. `pagehide` cobre navegação, reload e fechamento de aba.
window.addEventListener('pagehide', () => {
  if (tocando) salvarEstadoAtual();
  soltarPosse();
});

// Exposto para as páginas e para testes de interface.
window.musicaEstaTocando = () => tocando;
window.musicaPosicaoMs = () => Math.round(posicaoAtualMs());
