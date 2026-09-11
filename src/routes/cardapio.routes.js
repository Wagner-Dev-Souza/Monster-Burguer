import { Router } from 'express';
import * as cardapioController from '../controllers/cardapio.controller.js';
import { assincrono } from '../utils/async-handler.js';

const rotas = Router();

// PÚBLICO de propósito: o cardápio é o que qualquer visitante pode espiar.
rotas.get('/', assincrono(cardapioController.listar));

export default rotas;
