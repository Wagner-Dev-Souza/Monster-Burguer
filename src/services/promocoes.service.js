import * as promocoesRepo from '../repositories/promocoes.repository.js';
import * as produtosRepo from '../repositories/produtos.repository.js';
import { centavosParaReais, reaisParaCentavos } from '../utils/moeda.js';
import { ErroNaoEncontrado, ErroValidacao } from '../utils/errors.js';

/**
 * FASE 7 — PROMOÇÕES por produto.
 *
 * Regra central: `precoVigente(produto)` devolve o preço que o cliente paga AGORA
 * (com desconto, se houver promoção ativa e dentro do período). Todo o resto do
 * sistema usa essa função — cardápio, carrinho e pedido — para não existir
 * divergência entre o preço mostrado e o preço cobrado.
 */
const PERCENTUAL_MINIMO = 1;
const PERCENTUAL_MAXIMO = 90;

function paraPublico(promocao) {
  return {
    id: promocao.id,
    produtoId: promocao.produtoId,
    produtoNome: promocao.produtoNome,
    percentual: promocao.percentual,
    inicio: promocao.inicio,
    fim: promocao.fim,
    ativo: promocao.ativo,
    vigente: ehVigente(promocao),
    criadoEm: promocao.criadoEm,
  };
}

export function ehVigente(promocao, hoje = new Date().toISOString().slice(0, 10)) {
  if (!promocao?.ativo) return false;
  if (promocao.inicio && promocao.inicio > hoje) return false;
  if (promocao.fim && promocao.fim < hoje) return false;
  return true;
}

/**
 * Preço que vale AGORA para o produto (promoção aplicada, se houver).
 * Devolve também o preço original e o percentual, para a tela mostrar "de/por".
 */
export function precoVigente(produto, promocao = undefined) {
  const promo = promocao === undefined ? promocoesRepo.buscarVigentePorProduto(produto.id) : promocao;

  if (!promo || !ehVigente(promo)) {
    return { precoCentavos: produto.precoVendaCentavos, precoOriginalCentavos: null, percentual: null };
  }

  const precoCentavos = Math.round((produto.precoVendaCentavos * (100 - promo.percentual)) / 100);

  return {
    precoCentavos,
    precoOriginalCentavos: produto.precoVendaCentavos,
    percentual: promo.percentual,
  };
}

function validar(dados) {
  const produtoId = Number(dados?.produtoId);
  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    throw new ErroValidacao('Escolha o produto da promoção.');
  }

  const produto = produtosRepo.buscarPorId(produtoId);
  if (!produto) throw new ErroNaoEncontrado('Produto não encontrado.');

  const percentual = Number(dados?.percentual);
  if (!Number.isInteger(percentual) || percentual < PERCENTUAL_MINIMO || percentual > PERCENTUAL_MAXIMO) {
    throw new ErroValidacao(`O desconto precisa ser um número inteiro de ${PERCENTUAL_MINIMO} a ${PERCENTUAL_MAXIMO} (%).`);
  }

  const data = (valor) => {
    if (!valor) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      throw new ErroValidacao('Datas devem estar no formato AAAA-MM-DD.');
    }
    return valor;
  };

  const inicio = data(dados?.inicio);
  const fim = data(dados?.fim);

  if (inicio && fim && fim < inicio) {
    throw new ErroValidacao('A data final não pode ser antes da data inicial.');
  }

  return { produtoId, percentual, inicio, fim };
}

export function listarPromocoes({ somenteAtivas = false } = {}) {
  return promocoesRepo.listar({ somenteAtivas }).map(paraPublico);
}

export function criarPromocao(dados) {
  const validado = validar(dados);
  const promocao = promocoesRepo.criar(validado);

  // Uma promoção ativa por produto: a nova substitui a anterior.
  promocoesRepo.desativarDoProduto(validado.produtoId, promocao.id);

  return paraPublico(promocoesRepo.buscarPorId(promocao.id));
}

export function atualizarPromocao(id, dados) {
  const atual = promocoesRepo.buscarPorId(id);
  if (!atual) throw new ErroNaoEncontrado('Promoção não encontrada.');

  const validado = validar({ ...dados, produtoId: dados?.produtoId ?? atual.produtoId });
  const atualizada = promocoesRepo.atualizar(id, {
    percentual: validado.percentual,
    inicio: validado.inicio,
    fim: validado.fim,
    ativo: dados?.ativo === undefined ? atual.ativo : Boolean(dados.ativo),
  });

  if (atualizada.ativo) promocoesRepo.desativarDoProduto(validado.produtoId, id);

  return paraPublico(atualizada);
}

export function excluirPromocao(id) {
  const promocao = promocoesRepo.buscarPorId(id);
  if (!promocao) throw new ErroNaoEncontrado('Promoção não encontrada.');

  promocoesRepo.excluir(id);
  return paraPublico(promocao);
}

/** Resumo do desconto, no formato que o front usa ("de R$ 29,90 por R$ 25,42"). */
export function descreverDesconto({ precoCentavos, precoOriginalCentavos, percentual }) {
  if (!percentual) return null;

  return {
    percentual,
    de: centavosParaReais(precoOriginalCentavos),
    por: centavosParaReais(precoCentavos),
    economia: centavosParaReais(precoOriginalCentavos - precoCentavos),
  };
}

/** Converte um preço digitado em R$ para centavos (usado nos testes/utilitários). */
export function centavosDeReais(valor) {
  return reaisParaCentavos(valor);
}
