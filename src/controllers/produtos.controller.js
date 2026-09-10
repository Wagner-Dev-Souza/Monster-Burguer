import * as produtosService from '../services/produtos.service.js';

/** Controllers de produtos e ficha técnica (área administrativa). */

export function listar(req, res) {
  const incluirInativos = req.query.todos === '1';
  const tipo = req.query.tipo; // 'lanche' | 'bebida' | undefined

  return res.json({ produtos: produtosService.listarProdutos({ tipo, incluirInativos }) });
}

export function buscar(req, res) {
  return res.json({ produto: produtosService.buscarProduto(Number(req.params.id)) });
}

export function criar(req, res) {
  const produto = produtosService.criarProduto(req.body ?? {});
  const emoji = produto.tipo === 'lanche' ? '🍔' : '🥤';
  return res.status(201).json({ mensagem: `${emoji} "${produto.nome}" cadastrado!`, produto });
}

export function atualizar(req, res) {
  const produto = produtosService.atualizarProduto(Number(req.params.id), req.body ?? {});
  return res.json({ mensagem: `"${produto.nome}" atualizado.`, produto });
}

export function desativar(req, res) {
  const produto = produtosService.desativarProduto(Number(req.params.id));
  return res.json({ mensagem: `"${produto.nome}" saiu do cardápio (pode ser reativado depois).`, produto });
}

/** PUT /api/produtos/:id/composicao — salva a ficha técnica inteira. */
export function definirComposicao(req, res) {
  const produto = produtosService.definirComposicao(Number(req.params.id), req.body?.itens);

  return res.json({
    mensagem: `Ficha técnica de "${produto.nome}" salva! Custo de produção: R$ ${produto.custo.toFixed(2)} · Margem: ${produto.margemPercentual}%`,
    produto,
  });
}
