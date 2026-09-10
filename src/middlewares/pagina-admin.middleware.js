import { verificarToken } from '../utils/jwt.js';
import * as usuariosRepo from '../repositories/usuarios.repository.js';

/**
 * GUARDA DAS PÁGINAS ADMINISTRATIVAS (proteção no SERVIDOR).
 *
 * Por quê existe? Antes, o /painel.html era servido para qualquer pessoa e só
 * depois o JavaScript redirecionava quem não era admin. Isso é frágil:
 *  * a página inteira (HTML, textos, telas futuras) era ENTREGUE ao cliente
 *    não autorizado — bastava olhar o código-fonte
 *  * se o JavaScript falhasse ou fosse bloqueado, a página ficava exposta
 *
 * Agora a decisão acontece ANTES de o arquivo sair do servidor:
 *  * sem sessão      -> redireciona para /login.html
 *  * cliente logado  -> redireciona para /loja.html
 *  * admin logado    -> deixa passar (next()) e o arquivo é servido
 *
 * Usamos 302 (redirecionamento) em vez de 403 porque, para NAVEGAÇÃO de páginas,
 * jogar o usuário para o lugar certo é melhor experiência do que uma tela de erro.
 * (Nas rotas de API, onde quem consome é o JavaScript, mantemos 401/403 em JSON.)
 */
export function somenteAdminNaPagina(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.redirect(302, '/login.html');

    const dados = verificarToken(token); // lança se inválido/expirado

    const usuario = usuariosRepo.buscarPorId(dados.sub);
    if (!usuario || !usuario.ativo) return res.redirect(302, '/login.html');

    if (usuario.papel !== 'admin') return res.redirect(302, '/loja.html');

    return next();
  } catch {
    // Token corrompido, expirado ou assinatura inválida: volta para o login.
    return res.redirect(302, '/login.html');
  }
}
