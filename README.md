# 🍔 Monster Burguer

Sistema de gestão e pedidos online para a hamburgueria **Monster Burguer**.

- **Painel do Dono (admin):** cadastro de produtos e ingredientes, fichas técnicas,
  compras/despesas, estoque, pedidos confirmados, fluxo de caixa e relatórios.
- **Loja do Cliente:** cadastro/login com CPF e senha, cardápio, carrinho, pedido,
  pagamento (simulado) e acompanhamento do pedido.

> ⚠️ **Regra de ouro do sistema:** funcionalidades administrativas (estoque,
> pedidos de clientes, compras, caixa) são acessíveis **somente** por usuários com
> papel `admin`. Quem se cadastra entra como `cliente` e só vê a loja.

---

## 🧱 Stack

| Camada    | Tecnologia                                   |
|-----------|----------------------------------------------|
| Runtime   | Node.js 20+ (ES Modules)                     |
| Servidor  | Express                                      |
| Banco     | SQLite (`better-sqlite3`) + migrations em SQL |
| Segurança | bcrypt (hash de senha) + JWT em cookie HttpOnly |
| Front-end | HTML + CSS + JavaScript puro (sem build)     |
| Testes    | `node:test` (nativo) + `supertest`           |

## 📂 Estrutura

```
monster-burguer/
├── src/
│   ├── config/         # leitura e validação de variáveis de ambiente
│   ├── database/       # conexão, migrations (.sql) e seeds
│   ├── repositories/   # acesso ao banco (só SQL, sem regra de negócio)
│   ├── services/       # regras de negócio (o "cérebro")
│   ├── controllers/    # traduzem HTTP <-> service
│   ├── routes/         # definição das rotas da API
│   ├── middlewares/    # autenticação, autorização, tratamento de erros
│   ├── utils/          # CPF, senha, JWT, erros da aplicação
│   ├── app.js          # monta o app Express (sem subir servidor)
│   └── server.js       # sobe o servidor (e roda migrations/seeds)
├── public/             # front-end público (loja, login, cadastro)
│   └── admin/          # 🔒 telas administrativas (protegidas no servidor)
├── tests/              # testes automatizados
├── data/               # banco SQLite (ignorado pelo git)
└── PLANO.md            # plano de fases do projeto
```

## 🚀 Como rodar

```bash
# 1. dependências
npm install

# 2. arquivo de ambiente
cp .env.example .env
# edite JWT_SECRET (ex.: openssl rand -hex 32)

# 3. subir em modo desenvolvimento (as migrations rodam automaticamente)
npm run dev
# servidor em http://localhost:3000
```

Outros comandos:

```bash
npm run migrate   # aplica as migrations pendentes
npm run seed      # cria o admin inicial (idempotente)
npm test          # roda a suíte de testes
```

## 🔑 Credenciais do admin inicial

Definidas no `.env` (`ADMIN_NOME`, `ADMIN_CPF`, `ADMIN_SENHA`).
No exemplo: CPF `111.444.777-35` / senha `monster123`.
Troque em produção!

## 🔌 API (Fase 1)

| Método | Rota                        | Acesso  | O que faz                                  |
|--------|-----------------------------|---------|--------------------------------------------|
| GET    | `/health`                   | público | Status do servidor                         |
| POST   | `/api/auth/registrar`       | público | Cadastra cliente (nome, CPF, senha)        |
| POST   | `/api/auth/login`           | público | Autentica (CPF + senha) e emite o token    |
| POST   | `/api/auth/logout`          | logado  | Encerra a sessão (limpa o cookie)          |
| GET    | `/api/auth/eu`              | logado  | Dados do usuário da sessão                 |
| GET    | `/api/usuarios`             | admin   | Lista usuários                             |
| PATCH  | `/api/usuarios/:id/papel`   | admin   | Promove/rebaixa usuário (cliente <-> admin)|

## 🎨 Identidade visual

- **Paleta da casa:** verde Monster em gradiente (`#6ac30e → #1f8a3b`), com
  vermelho (`#d62828`) e amarelo (`#ffd60a`) nos detalhes — pegada de rede de
  lanchonete.
- **Fundo:** lanches ilustrados em baixa opacidade (`public/img/lanche.svg`,
  aplicado em `body::before` com `opacity: .07`).
  Para usar uma **foto real** de lanche, basta substituir esse arquivo (ou
  apontar o `url()` do CSS para a foto) e ajustar o `background-size`.
- **Turma Monster** (chibi, em SVG vetorial em `public/img/monstros/`):
  Chef Monstrinha, Frank, Draculinha, Lobi (lobisomem), Faraó (múmia),
  Pântano e Zu (zumbi).
- **Pré-visualizações em PNG:** `docs/artes/` (geradas a partir dos SVGs).
- **Interface compartilhada:** `public/js/layout.js` monta o cabeçalho e a
  navegação conforme o papel do usuário; `public/js/senha.js` cuida do botão
  de mostrar/esconder a senha (acessível por teclado).

## 🧠 Decisões de projeto (o porquê)

- **Camadas** (`routes → controllers → services → repositories`): cada arquivo com
  uma responsabilidade só. Fica fácil testar o "cérebro" (service) sem HTTP.
- **SQLite + SQL explícito**: sem ORM mágico; você enxerga exatamente o que roda no banco.
- **Migrations versionadas**: o banco evolui junto com o código, sem perder dados.
- **bcrypt**: senha nunca é gravada em texto puro.
- **JWT em cookie HttpOnly**: o navegador não consegue ler o cookie via JavaScript
  (proteção contra XSS) e o servidor não precisa guardar sessão em memória.
- **Soft delete** (`ativo = false`): apagar produto de verdade quebraria o histórico
  de pedidos e relatórios financeiros.
- **Área administrativa segregada em `/admin/`**: as páginas de admin ficam atrás
  de um guard (**`somenteAdminNaPagina`**) registrado ANTES do `express.static`.
  Consequência: um cliente **nunca recebe o HTML** do painel — o servidor responde
  com redirecionamento antes de o arquivo sair. Rota nova dentro de `public/admin/`
  já nasce protegida.
- **Preço congelado no item do pedido**: mudar o preço do produto hoje não reescreve
  o passado no caixa.
