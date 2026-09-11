import * as cuponsRepo from '../repositories/cupons.repository.js';
import { centavosParaReais, reaisParaCentavos } from '../utils/moeda.js';
import { ErroConflito, ErroNaoEncontrado, ErroValidacao } from '../utils/errors.js';

/**
 * FASE 7 — CUPONS de desconto.
 *
 * Um cupom é avaliado em DUAS etapas de propósito:
 *  1. `validarCupom()` é usado pelo botão "Aplicar" no checkout (avisa o cliente);
 *  2. `avaliarCupom()` roda de novo na hora de CRIAR o pedido.
 * Revalidar parece redundante, mas é o que impede alguém de aplicar o cupom na
 * tela, esperar o cupom vencer (ou esgotar) e mandar o pedido mesmo assim.
 */
const PERCENTUAL_MAXIMO = 90;

function paraPublico(cupom) {
  return {
    id: cupom.id,
    codigo: cupom.codigo,
    percentual: cupom.percentual,
    valorMinimo: centavosParaReais(cupom.valorMinimoCentavos),
    usosMaximos: cupom.usosMaximos,
    usos: cupom.usos,
    usosRestantes: cupom.usosMaximos === null ? null : Math.max(0, cupom.usosMaximos - cupom.usos),
    validoAte: cupom.validoAte,
    ativo: cupom.ativo,
    criadoEm: cupom.criadoEm,
  };
}

function validar(dados) {
  const codigo = String(dados?.codigo ?? '').trim().toUpperCase();

  if (!/^[A-Z0-9]{3,20}$/.test(codigo)) {
    throw new ErroValidacao('O código do cupom deve ter de 3 a 20 caracteres (letras e números, sem espaço).');
  }

  const percentual = Number(dados?.percentual);
  if (!Number.isInteger(percentual) || percentual < 1 || percentual > PERCENTUAL_MAXIMO) {
    throw new ErroValidacao(`O desconto do cupom precisa ser um número inteiro de 1 a ${PERCENTUAL_MAXIMO} (%).`);
  }

  const valorMinimoCentavos = dados?.valorMinimo ? reaisParaCentavos(dados.valorMinimo) : 0;
  if (!Number.isInteger(valorMinimoCentavos) || valorMinimoCentavos < 0) {
    throw new ErroValidacao('Valor mínimo inválido. Informe um valor em reais (ou deixe em branco).');
  }

  const usosMaximos = dados?.usosMaximos === undefined || dados?.usosMaximos === null || dados?.usosMaximos === ''
    ? null
    : Number(dados.usosMaximos);

  if (usosMaximos !== null && (!Number.isInteger(usosMaximos) || usosMaximos <= 0)) {
    throw new ErroValidacao('Limite de usos inválido. Use um número inteiro maior que zero ou deixe em branco (ilimitado).');
  }

  const validoAte = dados?.validoAte || null;
  if (validoAte && !/^\d{4}-\d{2}-\d{2}$/.test(validoAte)) {
    throw new ErroValidacao('A validade deve estar no formato AAAA-MM-DD.');
  }

  return { codigo, percentual, valorMinimoCentavos, usosMaximos, validoAte };
}

export function listarCupons({ somenteAtivos = false } = {}) {
  return cuponsRepo.listar({ somenteAtivos }).map(paraPublico);
}

export function criarCupom(dados) {
  const validado = validar(dados);

  if (cuponsRepo.buscarPorCodigo(validado.codigo)) {
    throw new ErroConflito(`Já existe um cupom com o código ${validado.codigo}.`);
  }

  return paraPublico(cuponsRepo.criar(validado));
}

export function atualizarCupom(id, dados) {
  const atual = cuponsRepo.buscarPorId(id);
  if (!atual) throw new ErroNaoEncontrado('Cupom não encontrado.');

  const validado = validar({ ...dados, codigo: dados?.codigo ?? atual.codigo });

  const comMesmoCodigo = cuponsRepo.buscarPorCodigo(validado.codigo);
  if (comMesmoCodigo && comMesmoCodigo.id !== id) {
    throw new ErroConflito(`Já existe um cupom com o código ${validado.codigo}.`);
  }

  // Troca de código é feita em SQL direto (UPDATE simples, sem regra de negócio).
  if (validado.codigo !== atual.codigo) {
    cuponsRepo.atualizar(id, { ...validado, ativo: atual.ativo });
    const renomear = cuponsRepo.buscarPorId(id);
    return paraPublico(renomear);
  }

  return paraPublico(cuponsRepo.atualizar(id, {
    ...validado,
    ativo: dados?.ativo === undefined ? atual.ativo : Boolean(dados.ativo),
  }));
}

export function excluirCupom(id) {
  const cupom = cuponsRepo.buscarPorId(id);
  if (!cupom) throw new ErroNaoEncontrado('Cupom não encontrado.');

  cuponsRepo.excluir(id);
  return paraPublico(cupom);
}

/**
 * Avalia um cupom para um subtotal. Lança erro explicando o motivo quando não vale.
 * `ErroConflito` (409) para as regras de uso/validade; `ErroNaoEncontrado` (404)
 * quando o código não existe.
 */
export function avaliarCupom(codigo, subtotalCentavos) {
  const cupom = cuponsRepo.buscarPorCodigo(codigo);

  if (!cupom) throw new ErroNaoEncontrado('Cupom não encontrado. Confira o código digitado.');

  if (!cupom.ativo) throw new ErroConflito(`O cupom ${cupom.codigo} está desativado.`);

  const hoje = new Date().toISOString().slice(0, 10);

  if (cupom.validoAte && cupom.validoAte < hoje) {
    throw new ErroConflito(`O cupom ${cupom.codigo} venceu em ${cupom.validoAte.split('-').reverse().join('/')}.`);
  }

  if (cupom.usosMaximos !== null && cupom.usos >= cupom.usosMaximos) {
    throw new ErroConflito(`O cupom ${cupom.codigo} atingiu o limite de usos.`);
  }

  if (subtotalCentavos < cupom.valorMinimoCentavos) {
    throw new ErroConflito(
      `O cupom ${cupom.codigo} vale para pedidos a partir de R$ ${centavosParaReais(cupom.valorMinimoCentavos).toFixed(2).replace('.', ',')}.`,
    );
  }

  const descontoCentavos = Math.round((subtotalCentavos * cupom.percentual) / 100);

  return {
    cupom,
    percentual: cupom.percentual,
    descontoCentavos,
    totalCentavos: subtotalCentavos - descontoCentavos,
  };
}

/** Versão "silenciosa" (sem erro) para o botão Aplicar do checkout. */
export function validarCupom(codigo, subtotal) {
  const subtotalCentavos = reaisParaCentavos(subtotal);
  if (!Number.isInteger(subtotalCentavos) || subtotalCentavos <= 0) {
    throw new ErroValidacao('Informe os itens do carrinho antes de aplicar o cupom.');
  }

  const avaliado = avaliarCupom(codigo, subtotalCentavos);

  return {
    codigo: avaliado.cupom.codigo,
    percentual: avaliado.percentual,
    desconto: centavosParaReais(avaliado.descontoCentavos),
    novoTotal: centavosParaReais(avaliado.totalCentavos),
  };
}

/** Chamado quando o pagamento é confirmado: o cupom passa a ter um uso a mais. */
export function registrarUso(cupomId) {
  return paraPublico(cuponsRepo.registrarUso(cupomId));
}
