import { Router } from 'express';
import * as usuariosController from '../controllers/usuarios.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

/**
 * 🔒 O CADEADO DA ÁREA ADMINISTRATIVA.
 *
 * Os dois middlewares estão no TOPO do router (e não rota por rota).
 * Por quê? Assim é IMPOSSÍVEL esquecer de proteger uma rota nova criada aqui
 * depois — a proteção é do arquivo inteiro, não da linha.
 *
 * Todas as funcionalidades administrativas que virão nas próximas fases
 * (estoque, pedidos confirmados, compras, fluxo de caixa) seguem este padrão.
 */
rotas.use(autenticar, somenteAdmin);

rotas.get('/', assincrono(usuariosController.listar));
rotas.patch('/:id/papel', assincrono(usuariosController.alterarPapel));

export default rotas;
