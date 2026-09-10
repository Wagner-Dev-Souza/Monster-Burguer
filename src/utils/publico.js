/**
 * Traduz o usuário "de dentro" (com hash de senha) para o formato "de fora"
 * (o que pode ser devolvido na API).
 *
 * Por quê? Garantia de que a senha_hash NUNCA sai do servidor por descuido:
 * é só usar este mapper em toda resposta que envolva usuário.
 */
export function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    cpf: usuario.cpf,
    papel: usuario.papel,
    ativo: usuario.ativo,
    criadoEm: usuario.criadoEm,
  };
}
