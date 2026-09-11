import { Router } from 'express';
import * as pedidosController from '../controllers/pedidos.controller.js';
import { autenticar, somenteAdmin } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

/**
 * Aqui as permissões são MISTAS (cliente cuida do próprio pedido; admin vê
 * todos), então não dá para usar um cadeado único no topo como nas outras rotas.
 * A ordem das rotas importa: '/meus' e '/resumo' vêm ANTES de '/:id', senão o
 * Express entenderia "meus" como um id.
 */
rotas.use(autenticar); // tudo aqui exige login

rotas.get('/meus', assincrono(pedidosController.listarMeus));
rotas.get('/formas-pagamento', assincrono(pedidosController.listarFormasPagamento));
rotas.post('/', assincrono(pedidosController.criar));

// 🔒 visão administrativa (todos os pedidos + resumo de vendas)
rotas.get('/resumo', somenteAdmin, assincrono((req, res) => pedidosController.listarTodos(req, res)));
rotas.get('/', somenteAdmin, assincrono(pedidosController.listarTodos));

rotas.get('/:id', assincrono(pedidosController.buscar));
rotas.post('/:id/pagar', assincrono(pedidosController.pagar));

// 🔒 FASE 6: só a loja avança o status (preparo, pronto, saiu, entregue, cancelado).
rotas.patch('/:id/status', somenteAdmin, assincrono(pedidosController.avancarStatus));

export default rotas;
