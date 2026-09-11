import * as cardapioService from '../services/cardapio.service.js';

/** Cardápio público: o cardápio da loja é informação pública. */
export function listar(req, res) {
  return res.json(cardapioService.listarCardapio());
}
