/**
 * Traduz o usuário "de dentro" (com hash de senha) para o formato "de fora"
 * (o que pode ser devolvido na API).
 *
 * Por quê? Garantia de que a senha_hash NUNCA sai do servidor por descuido:
 * é só usar este mapper em toda resposta que envolva usuário.
 *
 * Inclui os dados de contato (telefone/endereço) porque a tela "Minha conta"
 * precisa deles para edição — e são dados do próprio dono da conta.
 */
export function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    // "ID simples" para conversa do dia a dia: #0001, #0002...
    // É o mesmo id do banco, só formatado de um jeito legível para humanos.
    codigo: `#${String(usuario.id).padStart(4, '0')}`,
    nome: usuario.nome,
    cpf: usuario.cpf,
    papel: usuario.papel,
    ativo: usuario.ativo,
    telefone: usuario.telefone ?? null,
    cep: usuario.cep ?? null,
    endereco: usuario.endereco ?? null,
    numero: usuario.numero ?? null,
    complemento: usuario.complemento ?? null,
    bairro: usuario.bairro ?? null,
    cidade: usuario.cidade ?? null,
    criadoEm: usuario.criadoEm,
  };
}
