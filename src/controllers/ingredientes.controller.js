import * as ingredientesService from '../services/ingredientes.service.js';
import * as auditoria from '../services/auditoria.service.js';

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

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'criar',
    entidade: 'ingrediente',
    entidadeId: ingrediente.id,
    detalhe: `${ingrediente.nome} (${ingrediente.unidade}) a R$ ${ingrediente.custoUnitario}`,
  });

  return res.status(201).json({ mensagem: `Ingrediente "${ingrediente.nome}" cadastrado! 🥬`, ingrediente });
}

export function atualizar(req, res) {
  const ingrediente = ingredientesService.atualizarIngrediente(Number(req.params.id), req.body ?? {});

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'atualizar',
    entidade: 'ingrediente',
    entidadeId: ingrediente.id,
    detalhe: `${ingrediente.nome} (${ingrediente.unidade}) a R$ ${ingrediente.custoUnitario}`,
  });

  return res.json({ mensagem: `Ingrediente "${ingrediente.nome}" atualizado.`, ingrediente });
}

/** PATCH /api/ingredientes/:id/desativar — alternativa à exclusão (mantém o item no histórico). */
export function desativar(req, res) {
  const { ingrediente, usos } = ingredientesService.desativarIngrediente(Number(req.params.id));

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'desativar',
    entidade: 'ingrediente',
    entidadeId: ingrediente.id,
    detalhe: `${ingrediente.nome} (usado em ${usos} ficha(s) técnica(s))`,
  });

  const aviso = usos > 0
    ? ` Ele ainda aparece em ${usos} ficha(s) técnica(s) e continua sendo usado no custo desses lanches.`
    : '';

  return res.json({ mensagem: `Ingrediente "${ingrediente.nome}" desativado.${aviso}`, ingrediente, usos });
}

/** DELETE = exclusão de verdade (só quando nenhuma ficha técnica usa o ingrediente). */
export function excluir(req, res) {
  const { ingrediente } = ingredientesService.excluirIngrediente(Number(req.params.id));

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'excluir',
    entidade: 'ingrediente',
    entidadeId: ingrediente.id,
    detalhe: ingrediente.nome,
  });

  return res.json({ mensagem: `Ingrediente "${ingrediente.nome}" excluído. 🗑️`, ingrediente });
}
