import * as cuponsService from '../services/cupons.service.js';
import * as auditoria from '../services/auditoria.service.js';

/**
 * Cupons de desconto.
 * O CRUD é do admin; `validar` é do CLIENTE (é o botão "Aplicar" do checkout).
 */

export function listar(req, res) {
  return res.json({ cupons: cuponsService.listarCupons({ somenteAtivos: req.query.ativos === '1' }) });
}

/** POST /api/cupons/validar — o cliente confere o cupom antes de fechar o pedido. */
export function validar(req, res) {
  const resultado = cuponsService.validarCupom(req.body?.codigo, req.body?.subtotal);

  return res.json({
    mensagem: `Cupom ${resultado.codigo} aplicado: ${resultado.percentual}% de desconto! 🎟️`,
    ...resultado,
  });
}

export function criar(req, res) {
  const cupom = cuponsService.criarCupom(req.body ?? {});

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'cupom',
    entidade: 'cupom',
    entidadeId: cupom.id,
    detalhe: `${cupom.codigo}: ${cupom.percentual}% (mínimo R$ ${cupom.valorMinimo})`,
  });

  return res.status(201).json({ mensagem: `Cupom ${cupom.codigo} criado! 🎟️`, cupom });
}

export function atualizar(req, res) {
  const cupom = cuponsService.atualizarCupom(Number(req.params.id), req.body ?? {});

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'atualizar',
    entidade: 'cupom',
    entidadeId: cupom.id,
    detalhe: `${cupom.codigo}: ${cupom.percentual}% (${cupom.ativo ? 'ativo' : 'inativo'})`,
  });

  return res.json({ mensagem: 'Cupom atualizado.', cupom });
}

export function excluir(req, res) {
  const cupom = cuponsService.excluirCupom(Number(req.params.id));

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'excluir',
    entidade: 'cupom',
    entidadeId: cupom.id,
    detalhe: `${cupom.codigo} (${cupom.percentual}%)`,
  });

  return res.json({ mensagem: 'Cupom excluído.', cupom });
}
