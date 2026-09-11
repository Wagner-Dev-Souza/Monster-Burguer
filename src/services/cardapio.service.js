import * as produtosRepo from '../repositories/produtos.repository.js';
import * as promocoesRepo from '../repositories/promocoes.repository.js';
import { centavosParaReais } from '../utils/moeda.js';
import { mascoteDoProduto } from '../utils/mascotes.js';
import { precoVigente } from './promocoes.service.js';

/**
 * CARDÁPIO PÚBLICO (Fase 4 + promoções da Fase 7) — o que o cliente final pode ver.
 *
 * ⚠️ REGRA DE OURO DESTE ARQUIVO: aqui NÃO entram custo, margem, ficha técnica
 * nem estoque. Este mapper é separado do mapper do painel justamente para que
 * dado estratégico não vaze por descuido — a lista de chaves abaixo é o contrato.
 *
 * O preço exibido já vem com PROMOÇÃO aplicada (`precoVenda`) e, quando há
 * desconto, `precoOriginal` + `percentualDesconto` permitem a tela mostrar
 * "de R$ X por R$ Y". O pedido usa a mesma função de preço (promocoes.service),
 * então o que o cliente vê é exatamente o que ele paga.
 */
export function listarCardapio() {
  const produtos = produtosRepo.listar({ incluirInativos: false });

  // Busca TODAS as promoções vigentes de uma vez (evita uma consulta por produto).
  const promocoesVigentes = new Map(promocoesRepo.listarVigentes().map((promocao) => [promocao.produtoId, promocao]));

  const disponiveis = produtos
    // Bebida sem estoque não tem como ser vendida: sai do cardápio.
    .filter((produto) => produto.tipo === 'lanche' || produto.estoque > 0)
    .map((produto) => {
      const preco = precoVigente(produto, promocoesVigentes.get(produto.id) ?? null);

      return {
        id: produto.id,
        nome: produto.nome,
        descricao: produto.descricao,
        tipo: produto.tipo,
        mascote: mascoteDoProduto(produto),
        precoVenda: centavosParaReais(preco.precoCentavos),
        precoOriginal: preco.precoOriginalCentavos === null ? null : centavosParaReais(preco.precoOriginalCentavos),
        percentualDesconto: preco.percentual,
      };
    });

  return {
    lanches: disponiveis.filter((produto) => produto.tipo === 'lanche'),
    bebidas: disponiveis.filter((produto) => produto.tipo === 'bebida'),
  };
}
