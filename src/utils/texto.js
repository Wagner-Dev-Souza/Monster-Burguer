/**
 * Utilitários de texto.
 *
 * Por quê separado do cpf.js? Porque "tirar tudo que não é número" e "limitar
 * tamanho" são necessidades de vários campos (telefone, CEP, número da casa),
 * não só de CPF. Cada arquivo com uma responsabilidade.
 */

/** Remove tudo que não for dígito: "(21) 99999-8888" -> "21999998888" */
export function apenasDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/** Apara espaços e corta no limite de caracteres (defesa contra texto gigante). */
export function limitarTexto(valor, maximo) {
  return String(valor ?? '').trim().slice(0, maximo);
}
