/**
 * Utilitários de CPF.
 *
 * Por quê validar CPF? Ele é a credencial de login do cliente. Sem validação,
 * o banco acumula lixo ("123", "abc", CPF inventado) e o login fica confuso.
 *
 * Decisão: guardamos SEMPRE só os dígitos (ex.: "11144477735").
 * Formatação (111.444.777-35) é assunto da interface, não do banco.
 */

/** Remove pontos, traços e espaços. */
export function normalizarCPF(cpf) {
  return String(cpf ?? '').replace(/\D/g, '');
}

/** Formata para exibição: 11144477735 -> 111.444.777-35 */
export function formatarCPF(cpf) {
  const digitos = normalizarCPF(cpf);
  if (digitos.length !== 11) return digitos;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/**
 * Validação de CPF pelo dígito verificador (algoritmo oficial da Receita).
 * Aceita com ou sem máscara.
 */
export function validarCPF(cpf) {
  const digitos = normalizarCPF(cpf);

  if (digitos.length !== 11) return false;

  // "111.111.111-11" e afins passam na conta dos dígitos, mas não são válidos.
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (ate) => {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) {
      soma += Number(digitos[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(digitos[9]) && calcularDigito(10) === Number(digitos[10]);
}
