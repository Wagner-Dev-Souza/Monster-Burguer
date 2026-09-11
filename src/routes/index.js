import { Router } from 'express';
import rotasAuth from './auth.routes.js';
import rotasUsuarios from './usuarios.routes.js';
import rotasIngredientes from './ingredientes.routes.js';
import rotasProdutos from './produtos.routes.js';
import rotasCardapio from './cardapio.routes.js';
import rotasAuditoria from './auditoria.routes.js';
import rotasCompras from './compras.routes.js';
import rotasPedidos from './pedidos.routes.js';

/**
 * Agregador de rotas da API. Tudo que é API vive sob /api.
 * Próximas fases entram aqui: /relatorios (caixa).
 */
const rotas = Router();

rotas.use('/auth', rotasAuth);
rotas.use('/usuarios', rotasUsuarios);
rotas.use('/ingredientes', rotasIngredientes);
rotas.use('/produtos', rotasProdutos);
rotas.use('/cardapio', rotasCardapio);   // 🌍 público
rotas.use('/auditoria', rotasAuditoria); // 🔒 admin
rotas.use('/compras', rotasCompras);     // 🔒 admin (despesas)
rotas.use('/pedidos', rotasPedidos);     // 👤 cliente + 🔒 admin

export default rotas;
