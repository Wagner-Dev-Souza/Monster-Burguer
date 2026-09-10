import { Router } from 'express';
import rotasAuth from './auth.routes.js';
import rotasUsuarios from './usuarios.routes.js';
import rotasIngredientes from './ingredientes.routes.js';
import rotasProdutos from './produtos.routes.js';

/**
 * Agregador de rotas da API. Tudo que é API vive sob /api.
 * Próximas fases entram aqui: /compras, /pedidos, /relatorios...
 */
const rotas = Router();

rotas.use('/auth', rotasAuth);
rotas.use('/usuarios', rotasUsuarios);
rotas.use('/ingredientes', rotasIngredientes);
rotas.use('/produtos', rotasProdutos);

export default rotas;
