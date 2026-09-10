import { ErroAplicacao } from '../utils/errors.js';
import { env } from '../config/env.js';

/**
 * TRATAMENTO CENTRAL DE ERROS.
 *
 * Por quê? Um único lugar decide o formato das respostas de erro, então a API
 * é previsível: sempre `{ erro, codigo }`. Se cada controller respondesse do
 * seu jeito, o front-end viraria uma colcha de retalhos.
 */

/** Rota que não existe (404). */
export function rotaNaoEncontrada(req, res) {
  return res.status(404).json({
    erro: 'Rota não encontrada.',
    codigo: 'ROTA_NAO_ENCONTRADA',
    caminho: req.originalUrl,
  });
}

/** Middleware final de erros — precisa ser o ÚLTIMO registrado no Express. */
export function tratarErros(erro, req, res, next) { // eslint-disable-line no-unused-vars
  // 1) Erros previstos pela aplicação: usam o status definido na classe.
  if (erro instanceof ErroAplicacao) {
    return res.status(erro.status).json({ erro: erro.message, codigo: erro.codigo });
  }

  // 2) Erro de UNIQUE vindo do banco (ex.: CPF duplicado em corrida de cadastros).
  if (erro?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ erro: 'Registro duplicado.', codigo: 'CONFLITO' });
  }

  // 3) Qualquer outra coisa é bug: registramos no log do servidor.
  console.error('💥 Erro inesperado:', erro);
  return res.status(500).json({
    erro: 'Erro interno do servidor.',
    codigo: 'ERRO_INTERNO',
    // Em produção não vazamos detalhe técnico para o cliente final.
    ...(env.ehProducao ? {} : { detalhe: erro?.message }),
  });
}
