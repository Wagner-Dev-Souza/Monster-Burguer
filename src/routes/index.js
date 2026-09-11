import { Router } from 'express';
import rotasAuth from './auth.routes.js';
import rotasUsuarios from './usuarios.routes.js';
import rotasIngredientes from './ingredientes.routes.js';
import rotasProdutos from './produtos.routes.js';
import rotasCardapio from './cardapio.routes.js';
import rotasAuditoria from './auditoria.routes.js';
import rotasCompras from './compras.routes.js';
import rotasPedidos from './pedidos.routes.js';
import rotasPromocoes from './promocoes.routes.js';
import rotasCupons from './cupons.routes.js';
import rotasRelatorios from './relatorios.routes.js';

/**
 * Agregador de rotas da API. Tudo que é API vive sob /api.
 * Legenda: 🌍 público · 👤 cliente logado · 🔒 admin
 */
const rotas = Router();

rotas.use('/auth', rotasAuth);
rotas.use('/usuarios', rotasUsuarios);       // 🔒
rotas.use('/ingredientes', rotasIngredientes); // 🔒
rotas.use('/produtos', rotasProdutos);         // 🔒
rotas.use('/cardapio', rotasCardapio);         // 🌍 público
rotas.use('/auditoria', rotasAuditoria);       // 🔒
rotas.use('/compras', rotasCompras);           // 🔒 despesas
rotas.use('/pedidos', rotasPedidos);           // 👤 + 🔒
rotas.use('/promocoes', rotasPromocoes);       // 🔒
rotas.use('/cupons', rotasCupons);             // 👤 validar + 🔒 CRUD
rotas.use('/relatorios', rotasRelatorios);     // 🔒 fluxo de caixa

export default rotas;
