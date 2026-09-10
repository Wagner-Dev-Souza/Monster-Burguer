import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { autenticar } from '../middlewares/auth.middleware.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

// Públicas: qualquer visitante pode se cadastrar ou entrar.
rotas.post('/registrar', assincrono(authController.registrar));
rotas.post('/login', assincrono(authController.login));
rotas.post('/logout', authController.logout);

// Só quem está logado descobre os próprios dados.
rotas.get('/eu', autenticar, authController.eu);

// O usuário logado exclui o PRÓPRIO cadastro (cliente ou admin).
rotas.delete('/minha-conta', autenticar, assincrono(authController.excluirMinhaConta));

export default rotas;
