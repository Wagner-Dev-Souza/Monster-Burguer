/**
 * MASCOTES da Monster Burguer.
 *
 * Por que uma lista fixa no código (e não texto livre no banco)? Porque o nome do
 * mascote aponta para um ARQUIVO (`public/img/monstros/<mascote>.svg`). Se
 * aceitássemos qualquer texto, o dono poderia gravar "frank2" e a imagem
 * quebraria na loja do cliente. Lista fechada = impossível salvar arte inexistente.
 */
export const MASCOTES = [
  'frank',
  'draculinha',
  'lobisomem',
  'monstro-pantano',
  'zumbi',
  'mumia',
  'fantasma',
  'esqueleto',
  'bruxa',
];

export const MASCOTE_PADRAO = 'frank';

export function ehMascoteValido(valor) {
  return MASCOTES.includes(String(valor ?? ''));
}

/**
 * Escolhe a arte do produto: a que o dono definiu ou, sem escolha, uma fixa
 * derivada do id (assim dois produtos diferentes nunca ficam idênticos por
 * acidente, e a mesma mercadoria não troca de monstro a cada visita).
 */
export function mascoteDoProduto(produto) {
  if (produto?.mascote && ehMascoteValido(produto.mascote)) return produto.mascote;
  return MASCOTES[Number(produto?.id ?? 0) % MASCOTES.length];
}
