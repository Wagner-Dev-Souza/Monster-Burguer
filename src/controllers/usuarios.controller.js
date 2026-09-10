import * as usuariosService from '../services/usuarios.service.js';

/** Controllers da área administrativa (sempre atrás de `somenteAdmin`). */

export function listar(req, res) {
  return res.json({ usuarios: usuariosService.listarUsuarios() });
}

export function alterarPapel(req, res) {
  const { id } = req.params;
  const { papel } = req.body ?? {};

  const usuario = usuariosService.alterarPapel(Number(id), papel);
  const acao = papel === 'admin' ? 'promovido a administrador' : 'rebaixado para cliente';

  return res.json({ mensagem: `${usuario.nome} foi ${acao}.`, usuario });
}
