import * as promocoesService from '../services/promocoes.service.js';
import * as auditoria from '../services/auditoria.service.js';

/** Promoções por produto — área administrativa. */

export function listar(req, res) {
  return res.json({
    promocoes: promocoesService.listarPromocoes({ somenteAtivas: req.query.ativas === '1' }),
  });
}

export function criar(req, res) {
  const promocao = promocoesService.criarPromocao(req.body ?? {});

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'promocao',
    entidade: 'promocao',
    entidadeId: promocao.id,
    detalhe: `${promocao.produtoNome}: ${promocao.percentual}% de desconto`,
  });

  return res.status(201).json({ mensagem: `Promoção criada: ${promocao.percentual}% em ${promocao.produtoNome}. 🎟️`, promocao });
}

export function atualizar(req, res) {
  const promocao = promocoesService.atualizarPromocao(Number(req.params.id), req.body ?? {});

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'atualizar',
    entidade: 'promocao',
    entidadeId: promocao.id,
    detalhe: `${promocao.produtoNome}: ${promocao.percentual}% (${promocao.ativo ? 'ativa' : 'inativa'})`,
  });

  return res.json({ mensagem: 'Promoção atualizada.', promocao });
}

export function excluir(req, res) {
  const promocao = promocoesService.excluirPromocao(Number(req.params.id));

  auditoria.registrar({
    usuario: req.usuario,
    acao: 'excluir',
    entidade: 'promocao',
    entidadeId: promocao.id,
    detalhe: `${promocao.produtoNome} (${promocao.percentual}%)`,
  });

  return res.json({ mensagem: 'Promoção excluída.', promocao });
}
