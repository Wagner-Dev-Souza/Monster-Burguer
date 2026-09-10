import * as usuariosRepo from '../repositories/usuarios.repository.js';
import { usuarioPublico } from '../utils/publico.js';
import { apenasDigitos, limitarTexto } from '../utils/texto.js';
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

/**
 * O usuário exclui o PRÓPRIO cadastro.
 *
 * REGRA: administrador NÃO exclui a própria conta. Ele precisa ser rebaixado a
 * cliente por outro admin antes. Por quê? A loja não pode ficar sem ninguém
 * capaz de administrá-la, e essa trava também evita autoexclusão por impulso de
 * quem tem acesso a tudo.
 *
 * Segunda decisão: fazemos EXCLUSÃO LÓGICA (ativo = 0), não DELETE. Nas
 * próximas fases o usuário terá PEDIDOS ligados a ele; apagar a linha quebraria
 * o histórico de vendas e o fluxo de caixa. Efeito prático é o mesmo: não entra mais.
 */
export function excluirMinhaConta(usuario) {
  if (usuario.papel === 'admin') {
    throw new ErroValidacao(
      'Administradores não podem excluir a própria conta. Peça a outro admin para rebaixar você a cliente primeiro.',
    );
  }

  usuariosRepo.desativar(usuario.id);
  return { id: usuario.id, nome: usuario.nome };
}

/**
 * O usuário edita os próprios dados (nome, telefone e endereço).
 * Telefone e endereço serão coletados no fechamento do pedido (Fase 5), mas
 * já ficam editáveis aqui — quem muda de casa não quer esperar a próxima compra.
 */
export function atualizarMeusDados(usuario, dados) {
  const nome = limitarTexto(dados?.nome, 80);

  if (nome.length < 3) {
    throw new ErroValidacao('Informe seu nome completo (mínimo 3 caracteres).');
  }

  const telefone = apenasDigitos(dados?.telefone);
  if (telefone && (telefone.length < 10 || telefone.length > 11)) {
    throw new ErroValidacao('Telefone inválido: informe DDD + número (10 ou 11 dígitos).');
  }

  const cep = apenasDigitos(dados?.cep);
  if (cep && cep.length !== 8) {
    throw new ErroValidacao('CEP inválido: informe os 8 dígitos.');
  }

  const atualizado = usuariosRepo.atualizarContato(usuario.id, {
    nome,
    telefone: telefone || null,
    cep: cep || null,
    endereco: limitarTexto(dados?.endereco, 120) || null,
    numero: limitarTexto(dados?.numero, 20) || null,
    complemento: limitarTexto(dados?.complemento, 60) || null,
    bairro: limitarTexto(dados?.bairro, 60) || null,
    cidade: limitarTexto(dados?.cidade, 60) || null,
  });

  return usuarioPublico(atualizado);
}
