import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';
import { usuarioPublico } from '../utils/publico.js';

/**
 * CAMADA CONTROLLER — tradução HTTP <-> service.
 *
 * Só sabe ler `req`, chamar o service e responder. Zero regra de negócio aqui:
 * se você vir um `if` de negócio neste arquivo, ele está no lugar errado.
 */
const NOME_COOKIE = 'token';

/**
 * O token vai num cookie HttpOnly.
 *  - httpOnly: JavaScript da página NÃO consegue ler (proteção contra XSS)
 *  - sameSite 'lax': ajuda contra CSRF
 *  - secure: só viaja em HTTPS (ligado em produção)
 */
function opcoesDoCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.ehProducao,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 1 dia (mesmo prazo do JWT_EXPIRES_IN padrão)
  };
}

export async function registrar(req, res) {
  const { nome, cpf, senha } = req.body ?? {};
  const { usuario, token } = await authService.registrar({ nome, cpf, senha });

  res.cookie(NOME_COOKIE, token, opcoesDoCookie());
  return res.status(201).json({
    mensagem: 'Cadastro realizado com sucesso! Bem-vindo(a) à Monster Burguer 🍔',
    usuario,
  });
}

export async function login(req, res) {
  const { cpf, senha } = req.body ?? {};
  const { usuario, token } = await authService.login({ cpf, senha });

  res.cookie(NOME_COOKIE, token, opcoesDoCookie());
  return res.json({ mensagem: `Bem-vindo(a) de volta, ${usuario.nome}!`, usuario });
}

export function logout(req, res) {
  // Limpar o cookie é o suficiente: o "crachá" (JWT) já era do cliente.
  res.clearCookie(NOME_COOKIE, { path: '/' });
  return res.status(204).send();
}

export function eu(req, res) {
  // req.usuario foi colocado pelo middleware `autenticar`.
  return res.json({ usuario: usuarioPublico(req.usuario) });
}
