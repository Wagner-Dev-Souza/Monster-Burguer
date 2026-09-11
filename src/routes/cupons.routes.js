import { Router } from 'express';
import * as cuponsController from '../controllers/cupons.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

rotas.use(autenticar);

// 👤 O cliente precisa validar o cupom no checkout (é o botão "Aplicar").
rotas.post('/validar', assincrono(cuponsController.validar));

// 🔒 O resto é administração dos cupons.
rotas.get('/', somenteAdmin, assincrono(cuponsController.listar));
rotas.post('/', somenteAdmin, assincrono(cuponsController.criar));
rotas.put('/:id', somenteAdmin, assincrono(cuponsController.atualizar));
rotas.delete('/:id', somenteAdmin, assincrono(cuponsController.excluir));

export default rotas;
