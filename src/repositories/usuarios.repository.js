import { db } from '../database/connection.js';

/**
 * CAMADA REPOSITORY — só conversa com o banco.
 *
 * Regra: aqui NÃO existe regra de negócio ("só admin pode promover", "senha
 * mínima"...). Aqui só mora SQL. Isso deixa os services testáveis sem banco e
 * o SQL fácil de achar quando precisar otimizar uma consulta.
 */

/**
 * Converte a linha do banco (snake_case) no objeto da aplicação (camelCase).
 * O banco tem uma convenção, o JavaScript tem outra; a tradução vive aqui.
 */
function mapear(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    nome: linha.nome,
    cpf: linha.cpf,
    senhaHash: linha.senha_hash,
    papel: linha.papel,
    ativo: Boolean(linha.ativo),
    telefone: linha.telefone,
    cep: linha.cep,
    endereco: linha.endereco,
    numero: linha.numero,
    complemento: linha.complemento,
    bairro: linha.bairro,
    cidade: linha.cidade,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

export function criar({ nome, cpf, senhaHash, papel = 'cliente' }) {
  const resultado = db
    .prepare('INSERT INTO usuarios (nome, cpf, senha_hash, papel) VALUES (?, ?, ?, ?)')
    .run(nome, cpf, senhaHash, papel);

  return buscarPorId(resultado.lastInsertRowid);
}

export function buscarPorId(id) {
  return mapear(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id));
}

export function buscarPorCpf(cpf) {
  return mapear(db.prepare('SELECT * FROM usuarios WHERE cpf = ?').get(cpf));
}

export function listar() {
  return db.prepare('SELECT * FROM usuarios ORDER BY nome COLLATE NOCASE').all().map(mapear);
}

export function atualizarPapel(id, papel) {
  db.prepare("UPDATE usuarios SET papel = ?, atualizado_em = datetime('now') WHERE id = ?").run(papel, id);
  return buscarPorId(id);
}

/** Desativa o usuário (exclusão lógica): ele não consegue mais entrar. */
export function desativar(id) {
  db.prepare("UPDATE usuarios SET ativo = 0, atualizado_em = datetime('now') WHERE id = ?").run(id);
  return buscarPorId(id);
}

/** Atualiza os dados de contato/identificação do próprio usuário. */
export function atualizarContato(id, dados) {
  db.prepare(`
    UPDATE usuarios SET
      nome = ?, telefone = ?, cep = ?, endereco = ?, numero = ?,
      complemento = ?, bairro = ?, cidade = ?,
      atualizado_em = datetime('now')
    WHERE id = ?
  `).run(
    dados.nome,
    dados.telefone,
    dados.cep,
    dados.endereco,
    dados.numero,
    dados.complemento,
    dados.bairro,
    dados.cidade,
    id,
  );

  return buscarPorId(id);
}

/** Conta admins ativos — usado para proteger o "último admin". */
export function contarAdminsAtivos() {
  return db.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'admin' AND ativo = 1").get().total;
}
