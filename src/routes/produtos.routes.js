import { Router } from 'express';
import * as produtosController from '../controllers/produtos.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

/**
 * 🔒 Fase 2 é área administrativa: cadastro de produtos, custos e margens são
 * dados estratégicos da loja. O cliente final verá o cardápio na Fase 4.
 */
rotas.use(autenticar, somenteAdmin);

rotas.get('/', assincrono(produtosController.listar));
rotas.get('/:id', assincrono(produtosController.buscar));
rotas.post('/', assincrono(produtosController.criar));
rotas.put('/:id', assincrono(produtosController.atualizar));
rotas.put('/:id/composicao', assincrono(produtosController.definirComposicao));
rotas.delete('/:id', assincrono(produtosController.desativar));

export default rotas;
