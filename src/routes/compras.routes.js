import { Router } from 'express';
import * as comprasController from '../controllers/compras.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

// 🔒 Despesas e custos médios são informação estratégica: só admin.
rotas.use(autenticar, somenteAdmin);

rotas.get('/', assincrono(comprasController.listar));
rotas.post('/', assincrono(comprasController.criar));
rotas.delete('/:id', assincrono(comprasController.excluir));

export default rotas;
