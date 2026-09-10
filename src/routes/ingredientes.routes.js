import { Router } from 'express';
import * as ingredientesController from '../controllers/ingredientes.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

// 🔒 Ingredientes são informação administrativa: custo de compra não é do
// conhecimento do cliente final. Cadeado no topo do router, como nas outras áreas.
rotas.use(autenticar, somenteAdmin);

rotas.get('/', assincrono(ingredientesController.listar));
rotas.post('/', assincrono(ingredientesController.criar));
rotas.put('/:id', assincrono(ingredientesController.atualizar));
rotas.delete('/:id', assincrono(ingredientesController.desativar));

export default rotas;
