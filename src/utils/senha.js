import bcrypt from 'bcryptjs';

/**
 * Senhas: hash e verificação.
 *
 * Por quê bcrypt? Ele é lento DE PROPÓSITO e adiciona um "sal" aleatório,
 * o que torna inviável descobrir a senha original mesmo que o banco vaze.
 * Comparar senha com hash é diferente de comparar textos: nunca faça `===`.
 */
const CUSTO = 10; // custo do bcrypt: ~100ms por hash (bom equilíbrio segurança x velocidade)

export async function hashSenha(senha) {
  return bcrypt.hash(senha, CUSTO);
}

export async function verificarSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}
