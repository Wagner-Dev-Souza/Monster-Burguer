import * as ingredientesRepo from '../repositories/ingredientes.repository.js';
import { centavosParaReais, reaisParaCentavos } from '../utils/moeda.js';
import { limitarTexto } from '../utils/texto.js';
import { ErroConflito, ErroNaoEncontrado, ErroValidacao } from '../utils/errors.js';

/**
 * Regras de negócio dos INGREDIENTES (componentes dos lanches).
 *
 * O custo do ingrediente é o que permite o cálculo mais importante do sistema:
 * o custo de produção de cada sanduíche (e, por consequência, a margem).
 */
export const UNIDADES = ['un', 'g', 'kg', 'ml', 'l', 'fatia', 'porcao'];

function paraPublico(ingrediente) {
  return {
    id: ingrediente.id,
    nome: ingrediente.nome,
    unidade: ingrediente.unidade,
    custoUnitario: centavosParaReais(ingrediente.custoUnitarioCentavos),
    ativo: ingrediente.ativo,
    criadoEm: ingrediente.criadoEm,
  };
}

/** Valida e normaliza a entrada (usada tanto no criar quanto no editar). */
function validar(dados) {
  const nome = limitarTexto(dados?.nome, 60);
  if (nome.length < 2) {
    throw new ErroValidacao('Informe o nome do ingrediente (mínimo 2 caracteres).');
  }

  const unidade = dados?.unidade;
  if (!UNIDADES.includes(unidade)) {
    throw new ErroValidacao(`Unidade inválida. Use uma destas: ${UNIDADES.join(', ')}.`);
  }

  const custoUnitarioCentavos = reaisParaCentavos(dados?.custoUnitario ?? 0);
  if (!Number.isInteger(custoUnitarioCentavos) || custoUnitarioCentavos < 0) {
    throw new ErroValidacao('Custo unitário inválido. Informe um valor em reais (ex.: 12,50).');
  }

  return { nome, unidade, custoUnitarioCentavos };
}

export function listarIngredientes({ incluirInativos = false } = {}) {
  return ingredientesRepo.listar({ incluirInativos }).map(paraPublico);
}

export function buscarIngrediente(id) {
  const ingrediente = ingredientesRepo.buscarPorId(id);
  if (!ingrediente) throw new ErroNaoEncontrado('Ingrediente não encontrado.');
  return ingrediente;
}

export function criarIngrediente(dados) {
  const validado = validar(dados);

  if (ingredientesRepo.buscarPorNomeAtivo(validado.nome)) {
    throw new ErroConflito('Já existe um ingrediente ativo com esse nome.');
  }

  return paraPublico(ingredientesRepo.criar(validado));
}

export function atualizarIngrediente(id, dados) {
  const atual = buscarIngrediente(id);
  const validado = validar(dados);

  const comMesmoNome = ingredientesRepo.buscarPorNomeAtivo(validado.nome);
  if (comMesmoNome && comMesmoNome.id !== atual.id) {
    throw new ErroConflito('Já existe um ingrediente ativo com esse nome.');
  }

  return paraPublico(ingredientesRepo.atualizar(id, validado));
}

/**
 * Desativa o ingrediente (exclusão lógica).
 * Devolve também quantas fichas técnicas usam o ingrediente — informação útil
 * para o dono entender que aquele custo continua aparecendo nos lanches.
 */
export function desativarIngrediente(id) {
  const atual = buscarIngrediente(id);

  if (!atual.ativo) {
    throw new ErroValidacao('Este ingrediente já está desativado.');
  }

  const usos = ingredientesRepo.contarUsos(id);
  ingredientesRepo.desativar(id);

  return { ingrediente: paraPublico(ingredientesRepo.buscarPorId(id)), usos };
}
