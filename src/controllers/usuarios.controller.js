import * as usuariosService from '../services/usuarios.service.js';
import * as auditoria from '../services/auditoria.service.js';

/** Controllers da área administrativa (sempre atrás de `somenteAdmin`). */

export function listar(req, res) {
  return res.json({ usuarios: usuariosService.listarUsuarios() });
}

export function alterarPapel(req, res) {
  const { id } = req.params;
  const { papel } = req.body ?? {};

  const usuario = usuariosService.alterarPapel(Number(id), papel);
  const acao = papel === 'admin' ? 'promover' : 'rebaixar';

  auditoria.registrar({
    usuario: req.usuario,
    acao,
    entidade: 'usuario',
    entidadeId: usuario.id,
    detalhe: `${usuario.nome} (${usuario.codigo}) agora é ${usuario.papel}`,
  });

  return res.json({ mensagem: `${usuario.nome} foi ${acao === 'promover' ? 'promovido a administrador' : 'rebaixado para cliente'}.`, usuario });
}
