import { Router } from 'express';
import rotasAuth from './auth.routes.js';
import rotasUsuarios from './usuarios.routes.js';

/**
 * Agregador de rotas da API. Tudo que é API vive sob /api.
 * Nas próximas fases entram aqui: /produtos, /ingredientes, /compras,
 * /pedidos, /relatorios...
 */
const rotas = Router();

rotas.use('/auth', rotasAuth);
rotas.use('/usuarios', rotasUsuarios);

export default rotas;
