/**
 * Envolve controllers assíncronos para que qualquer erro caia no middleware
 * central de erros.
 *
 * Por quê? No Express 4, um `await` que lança dentro de um handler NÃO é
 * capturado automaticamente — a requisição ficaria pendurada. Com este wrapper
 * a gente escreve `async` sem poluir tudo com try/catch repetido.
 */
export const assincrono = (manipulador) => (req, res, next) =>
  Promise.resolve(manipulador(req, res, next)).catch(next);
