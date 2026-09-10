import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import rotas from './routes/index.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/error.middleware.js';
import { somenteAdminNaPagina } from './middlewares/pagina-admin.middleware.js';

/**
 * Monta o app Express SEM subir o servidor.
 *
 * Por quê separar de server.js? Porque os testes importam o app e conversam
 * com ele direto (via supertest), sem precisar ocupar uma porta de rede.
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function criarApp() {
  const app = express();

  app.disable('x-powered-by'); // não anuncia qual servidor usamos (higiene de segurança)
  app.use(express.json()); // corpo JSON da requisição -> req.body
  app.use(cookieParser()); // cookies -> req.cookies

  // Endpoint de saúde: serve para saber se o servidor está vivo.
  app.get('/health', (req, res) =>
    res.json({
      status: 'ok',
      servico: 'monster-burguer',
      versao: '0.1.0',
      hora: new Date().toISOString(),
    }),
  );

  app.use('/api', rotas);

  // ===================================================================
  // 🔒 ÁREA ADMINISTRATIVA (HTML) — protegida no SERVIDOR.
  //
  // A ORDEM AQUI É CRÍTICA: este guard precisa ser registrado ANTES do
  // express.static da pasta public/, senão o static genérico encontraria o
  // arquivo em public/admin/ e o entregaria a qualquer visitante, sem passar
  // pela verificação de papel.
  //
  // Todo arquivo dentro de public/admin/ (as telas administrativas das
  // próximas fases: produtos, estoque, caixa...) nasce protegido por padrão.
  // ===================================================================
  app.use('/admin', somenteAdminNaPagina, express.static(path.join(RAIZ, 'public', 'admin')));

  // Compatibilidade: link antigo continua funcionando (e continua protegido).
  app.get('/painel.html', (req, res) => res.redirect(302, '/admin/painel.html'));

  // Front-end público (loja, login, cadastro, CSS, JS).
  app.use(express.static(path.join(RAIZ, 'public')));

  app.use(rotaNaoEncontrada);
  app.use(tratarErros); // sempre por último

  return app;
}
