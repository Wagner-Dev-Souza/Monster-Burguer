import { verificarToken } from '../utils/jwt.js';
import * as usuariosRepo from '../repositories/usuarios.repository.js';
import { ErroAplicacao, ErroNaoAutenticado, ErroProibido } from '../utils/errors.js';

/**
 * MIDDLEWARES DE AUTENTICAÇÃO E AUTORIZAÇÃO.
 *
 * Diferença importante:
 *  - AUTENTICAR  = "quem é você?" (tem crachá válido?)
 *  - AUTORIZAR   = "você pode fazer isso?" (seu papel permite?)
 */

/** Coloca `req.usuario` quando há um token válido. */
export function autenticar(req, res, next) {
  try {
    const doCookie = req.cookies?.token;
    const doCabecalho = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = doCookie ?? doCabecalho;

    if (!token) throw new ErroNaoAutenticado();

    const dados = verificarToken(token); // lança se inválido/expirado

    // Buscar no banco (e não confiar só no token) garante que usuário apagado
    // ou desativado perde o acesso imediatamente, mesmo com token "na validade".
    const usuario = usuariosRepo.buscarPorId(dados.sub);
    if (!usuario || !usuario.ativo) {
      throw new ErroNaoAutenticado('Sessão inválida. Faça login novamente.');
    }

    req.usuario = usuario;
    return next();
  } catch (erro) {
    if (erro instanceof ErroAplicacao) return next(erro);
    return next(new ErroNaoAutenticado('Sessão inválida ou expirada. Faça login novamente.'));
  }
}

/** 🔒 A barreira: só passa quem tem papel `admin`. */
export function somenteAdmin(req, res, next) {
  if (req.usuario?.papel !== 'admin') {
    return next(new ErroProibido('Área restrita ao administrador da loja.'));
  }
  return next();
}
