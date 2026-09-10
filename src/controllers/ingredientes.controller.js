import * as ingredientesService from '../services/ingredientes.service.js';

/** Controllers de ingredientes (sempre atrás de `autenticar` + `somenteAdmin`). */

export function listar(req, res) {
  const incluirInativos = req.query.todos === '1';
  return res.json({
    unidades: ingredientesService.UNIDADES,
    ingredientes: ingredientesService.listarIngredientes({ incluirInativos }),
  });
}

export function criar(req, res) {
  const ingrediente = ingredientesService.criarIngrediente(req.body ?? {});
  return res.status(201).json({ mensagem: `Ingrediente "${ingrediente.nome}" cadastrado! 🥬`, ingrediente });
}

export function atualizar(req, res) {
  const ingrediente = ingredientesService.atualizarIngrediente(Number(req.params.id), req.body ?? {});
  return res.json({ mensagem: `Ingrediente "${ingrediente.nome}" atualizado.`, ingrediente });
}

export function desativar(req, res) {
  const { ingrediente, usos } = ingredientesService.desativarIngrediente(Number(req.params.id));

  const aviso = usos > 0
    ? ` Ele ainda aparece em ${usos} ficha(s) técnica(s) e continua sendo usado no custo desses lanches.`
    : '';

  return res.json({ mensagem: `Ingrediente "${ingrediente.nome}" desativado.${aviso}`, ingrediente, usos });
}
