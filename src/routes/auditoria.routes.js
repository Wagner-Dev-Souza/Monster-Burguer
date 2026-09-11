import { Router } from 'express';
import * as auditoriaController from '../controllers/auditoria.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

// 🔒 Só admin: o histórico mostra quem mexeu no quê (inclusive outros admins).
rotas.use(autenticar, somenteAdmin);

rotas.get('/', assincrono(auditoriaController.listar));

export default rotas;
