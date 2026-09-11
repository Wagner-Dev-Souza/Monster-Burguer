import { Router } from 'express';
import * as promocoesController from '../controllers/promocoes.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

// 🔒 Promoção mexe em PREÇO: só admin.
rotas.use(autenticar, somenteAdmin);

rotas.get('/', assincrono(promocoesController.listar));
rotas.post('/', assincrono(promocoesController.criar));
rotas.put('/:id', assincrono(promocoesController.atualizar));
rotas.delete('/:id', assincrono(promocoesController.excluir));

export default rotas;
