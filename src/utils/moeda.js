/**
 * Dinheiro: conversão entre REAIS (o que o usuário digita) e CENTAVOS (o que o
 * banco guarda).
 *
 * Por quê centavos? Números decimais em computador são aproximados:
 *   0.1 + 0.2  =>  0.30000000000000004
 * Somando muitos pedidos isso vira "centavo fantasma" no caixa. Trabalhando com
 * inteiros (centavos), a soma é exata e o arredondamento acontece UMA vez, na
 * conversão.
 */

/** "12,50" | "12.50" | 12.5  ->  1250 (centavos). Retorna NaN se não for número. */
export function reaisParaCentavos(valor) {
  if (valor === undefined || valor === null || valor === '') return null;

  const texto = typeof valor === 'string' ? valor.trim().replace(',', '.') : valor;
  const numero = Number(texto);

  if (!Number.isFinite(numero)) return Number.NaN;

  return Math.round(numero * 100);
}

/** 1250 -> 12.5 (reais, para exibir na API/tela). */
export function centavosParaReais(centavos) {
  if (centavos === null || centavos === undefined) return null;
  return Number((centavos / 100).toFixed(2));
}

/** 1250 -> "R$ 12,50" (útil em mensagens e logs). */
export function formatarReais(centavos) {
  if (centavos === null || centavos === undefined) return '-';
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}
