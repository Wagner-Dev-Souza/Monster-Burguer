import * as usuariosRepo from '../repositories/usuarios.repository.js';
import { usuarioPublico } from '../utils/publico.js';
import { ErroNaoEncontrado, ErroValidacao } from '../utils/errors.js';

/**
 * Regras de negócio dos usuários (área administrativa).
 *
 * Esta é a única porta para MUDAR o papel de alguém: é o admin concedendo ou
 * tirando o crachá de admin de outro usuário (tipicamente um funcionário que
 * se cadastrou como cliente).
 */
const PAPEIS_VALIDOS = ['cliente', 'admin'];

export function listarUsuarios() {
  return usuariosRepo.listar().map(usuarioPublico);
}

export function buscarUsuario(id) {
  const usuario = usuariosRepo.buscarPorId(id);
  if (!usuario) throw new ErroNaoEncontrado('Usuário não encontrado.');
  return usuario;
}

export function alterarPapel(id, papel) {
  if (!PAPEIS_VALIDOS.includes(papel)) {
    throw new ErroValidacao('Papel inválido. Use "cliente" ou "admin".');
  }

  const usuario = buscarUsuario(id);

  // Trava de segurança: sem isso, o dono poderia se rebaixar e a loja ficaria
  // sem NINGUÉM capaz de acessar a área administrativa.
  if (usuario.papel === 'admin' && papel === 'cliente' && usuariosRepo.contarAdminsAtivos() <= 1) {
    throw new ErroValidacao('Não é possível rebaixar o último administrador ativo da loja.');
  }

  return usuarioPublico(usuariosRepo.atualizarPapel(id, papel));
}
