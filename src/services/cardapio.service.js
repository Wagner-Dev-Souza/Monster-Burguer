import * as produtosRepo from '../repositories/produtos.repository.js';
import { centavosParaReais } from '../utils/moeda.js';

/**
 * CARDÁPIO PÚBLICO (Fase 4) — o que o cliente final pode ver.
 *
 * ⚠️ REGRA DE OURO: aqui NÃO passa custo, margem, ficha técnica nem estoque
 * detalhado. É por isso que este arquivo tem o seu PRÓPRIO mapper em vez de
 * reaproveitar o `produtos.service`: quem monta a resposta define o que vaza.
 * O cliente vê nome, descrição, tipo e preço de venda. Só.
 */
export function listarCardapio() {
  const produtos = produtosRepo.listar({ incluirInativos: false });

  const visiveis = produtos
    // Bebida sem estoque não entra no cardápio (não tem como vender).
    .filter((produto) => produto.tipo === 'lanche' || produto.estoque > 0)
    .map((produto) => ({
      id: produto.id,
      nome: produto.nome,
      descricao: produto.descricao,
      tipo: produto.tipo,
      precoVenda: centavosParaReais(produto.precoVendaCentavos),
    }));

  return {
    lanches: visiveis.filter((produto) => produto.tipo === 'lanche'),
    bebidas: visiveis.filter((produto) => produto.tipo === 'bebida'),
  };
}
