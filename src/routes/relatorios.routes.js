import { Router } from 'express';
import * as relatoriosController from '../controllers/relatorios.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

// 🔒 Faturamento e lucro são o retrato financeiro da loja: só admin.
rotas.use(autenticar, somenteAdmin);

rotas.get('/caixa', assincrono(relatoriosController.caixa));
rotas.get('/produtos', assincrono(relatoriosController.produtos));

export default rotas;
