import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Tokens JWT (JSON Web Token).
 *
 * Como funciona: o servidor assina um "crachá" com a chave secreta. Nas próximas
 * requisições o cliente devolve esse crachá e o servidor confere a assinatura —
 * sem precisar guardar sessão em memória.
 *
 * O crachá leva apenas o essencial (id e papel do usuário). Nada de senha!
 */
export function gerarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, papel: usuario.papel },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

/** Lança se o token for inválido/expirado (tratado pelo middleware). */
export function verificarToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
