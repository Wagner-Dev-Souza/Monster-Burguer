import * as usuariosRepo from '../repositories/usuarios.repository.js';
import { usuarioPublico } from '../utils/publico.js';
import { hashSenha, verificarSenha } from '../utils/senha.js';
import { gerarToken } from '../utils/jwt.js';
import { normalizarCPF, validarCPF } from '../utils/cpf.js';
import { ErroConflito, ErroNaoAutenticado, ErroProibido, ErroValidacao } from '../utils/errors.js';

/**
 * CAMADA SERVICE — o "cérebro" do sistema.
 *
 * É aqui que ficam as regras de negócio. Nada de HTTP (req/res) e nada de SQL:
 * só decisões. Isso permite testar as regras sem subir servidor.
 */
const SENHA_MINIMA = 6;

/**
 * REGRA DE OURO: quem se cadastra nasce SEMPRE como cliente.
 * Não existe nenhum caminho público para virar admin — só o dono promove
 * (ver usuarios.service.js > alterarPapel).
 */
export async function registrar({ nome, cpf, senha }) {
  const nomeLimpo = String(nome ?? '').trim();

  if (nomeLimpo.length < 3) {
    throw new ErroValidacao('Informe seu nome completo (mínimo 3 caracteres).');
  }

  const cpfNormalizado = normalizarCPF(cpf);
  if (!validarCPF(cpfNormalizado)) {
    throw new ErroValidacao('CPF inválido. Confira os números digitados.');
  }

  if (!senha || senha.length < SENHA_MINIMA) {
    throw new ErroValidacao(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  }

  if (usuariosRepo.buscarPorCpf(cpfNormalizado)) {
    throw new ErroConflito('Já existe um usuário cadastrado com este CPF.');
  }

  const usuario = usuariosRepo.criar({
    nome: nomeLimpo,
    cpf: cpfNormalizado,
    senhaHash: await hashSenha(senha),
    papel: 'cliente',
  });

  return { usuario: usuarioPublico(usuario), token: gerarToken(usuario) };
}

export async function login({ cpf, senha }) {
  const cpfNormalizado = normalizarCPF(cpf);

  if (!cpfNormalizado || !senha) {
    throw new ErroValidacao('Informe o CPF e a senha.');
  }

  const usuario = usuariosRepo.buscarPorCpf(cpfNormalizado);

  // Mesma mensagem para "CPF não existe" e "senha errada": não damos pistas
  // a quem tenta adivinhar quais CPFs estão cadastrados.
  if (!usuario || !(await verificarSenha(senha, usuario.senhaHash))) {
    throw new ErroNaoAutenticado('CPF ou senha inválidos.');
  }

  if (!usuario.ativo) {
    throw new ErroProibido('Este usuário está desativado. Fale com o administrador da loja.');
  }

  return { usuario: usuarioPublico(usuario), token: gerarToken(usuario) };
}
