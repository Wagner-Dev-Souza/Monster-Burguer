/**
 * Erros da APLICAÇÃO (não são "bugs", são situações previstas).
 *
 * Por quê? Em vez de espalhar `res.status(400).json(...)` pelos controllers,
 * lançamos erros com significado de negócio e UM middleware central decide o
 * HTTP correspondente. Isso mantém o código limpo e as respostas padronizadas.
 */
export class ErroAplicacao extends Error {
  constructor(mensagem, { status = 400, codigo = 'ERRO' } = {}) {
    super(mensagem);
    this.name = this.constructor.name;
    this.status = status;
    this.codigo = codigo;
  }
}

/** 400 — dados enviados não fazem sentido. */
export class ErroValidacao extends ErroAplicacao {
  constructor(mensagem, codigo = 'DADOS_INVALIDOS') {
    super(mensagem, { status: 400, codigo });
  }
}

/** 401 — quem é você? (falta token válido) */
export class ErroNaoAutenticado extends ErroAplicacao {
  constructor(mensagem = 'Você precisa estar logado para acessar este recurso.') {
    super(mensagem, { status: 401, codigo: 'NAO_AUTENTICADO' });
  }
}

/** 403 — sei quem você é, mas você NÃO pode fazer isso. */
export class ErroProibido extends ErroAplicacao {
  constructor(mensagem = 'Acesso restrito a administradores.') {
    super(mensagem, { status: 403, codigo: 'ACESSO_NEGADO' });
  }
}

/** 404 — recurso não encontrado. */
export class ErroNaoEncontrado extends ErroAplicacao {
  constructor(mensagem = 'Recurso não encontrado.') {
    super(mensagem, { status: 404, codigo: 'NAO_ENCONTRADO' });
  }
}

/** 409 — conflito com algo que já existe (ex.: CPF duplicado). */
export class ErroConflito extends ErroAplicacao {
  constructor(mensagem, codigo = 'CONFLITO') {
    super(mensagem, { status: 409, codigo });
  }
}
