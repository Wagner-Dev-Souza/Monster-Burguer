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
| POST   | `/api/auth/registrar`       | público | Cadastra cliente — **não cria sessão**, o usuário é levado ao login |
| POST   | `/api/auth/login`           | público | Autentica (CPF + senha) e emite o token    |
| POST   | `/api/auth/logout`          | logado  | Encerra a sessão (limpa o cookie)          |
| GET    | `/api/auth/eu`              | logado  | Dados do usuário da sessão                 |
| PATCH  | `/api/auth/minha-conta`     | logado  | Edita os PRÓPRIOS dados (nome, telefone, endereço) |
| DELETE | `/api/auth/minha-conta`     | logado  | Exclui o PRÓPRIO cadastro (exclusão lógica; admin precisa ser rebaixado antes) |
| GET    | `/api/usuarios`             | admin   | Lista usuários                             |
| PATCH  | `/api/usuarios/:id/papel`   | admin   | Promove/rebaixa usuário (cliente <-> admin)|
| GET    | `/api/ingredientes`         | admin   | Lista ingredientes (+ unidades permitidas) — `?todos=1` inclui inativos |
| POST   | `/api/ingredientes`         | admin   | Cadastra ingrediente (nome, unidade, custo) |
| PUT    | `/api/ingredientes/:id`     | admin   | Atualiza ingrediente                       |
| PATCH  | `/api/ingredientes/:id/desativar` | admin | Desativa (alternativa à exclusão)      |
| DELETE | `/api/ingredientes/:id`     | admin   | **Exclui de verdade** — bloqueado (409) se estiver em alguma ficha técnica |
| GET    | `/api/produtos`             | admin   | Lista produtos com **custo e margem** — `?tipo=lanche\|bebida`, `?todos=1` |
| GET    | `/api/produtos/:id`         | admin   | Produto + ficha técnica completa           |
| POST   | `/api/produtos`             | admin   | Cadastra produto (lanche ou bebida)        |
| PUT    | `/api/produtos/:id`         | admin   | Atualiza produto                           |
| PUT    | `/api/produtos/:id/composicao` | admin | Salva a **ficha técnica** inteira (itens: ingrediente + quantidade) |
| DELETE | `/api/produtos/:id`         | admin   | Desativa produto (soft delete)             |
| GET    | `/api/cardapio`             | 🌍 público | Cardápio do cliente final (lanches + bebidas disponíveis) — **sem custo/margem** |
| GET    | `/api/auditoria`            | admin   | Histórico de quem fez o quê — `?limite=30`, `?entidade=produto` |
| GET    | `/api/compras`              | admin   | Despesas registradas + resumo (total e do mês) — `?tipo=ingrediente\|produto` |
| POST   | `/api/compras`              | admin   | Registra compra do fornecedor → recalcula **custo médio ponderado** |
| DELETE | `/api/compras/:id`          | admin   | Exclui compra e recalcula os custos (devolve estoque, se bebida) |
| POST   | `/api/pedidos`              | cliente | Cria o pedido (preço congelado, exige telefone + endereço) |
| GET    | `/api/pedidos/meus`         | cliente | Meus pedidos com status |
| GET    | `/api/pedidos/:id`          | dono/admin | Detalhe do pedido                        |
| POST   | `/api/pedidos/:id/pagar`    | cliente | **Pagamento simulado** → vira receita e baixa estoque de bebida |
| GET    | `/api/pedidos`              | admin   | Todos os pedidos + resumo de receita       |
| PATCH  | `/api/pedidos/:id/status`   | admin   | **Fase 6**: avança o pedido (preparo → pronto → saiu → entregue), com cancelamento que devolve estoque |
| GET    | `/api/promocoes`            | admin   | Promoções por produto — `?ativas=1`        |
| POST   | `/api/promocoes`            | admin   | Cria promoção (produto + % + período opcional) |
| PUT    | `/api/promocoes/:id`        | admin   | Atualiza / ativa / desativa promoção       |
| DELETE | `/api/promocoes/:id`        | admin   | Exclui promoção                            |
| POST   | `/api/cupons/validar`       | cliente | Confere um cupom no checkout (botão "Aplicar") |
| GET    | `/api/cupons`               | admin   | Lista cupons (com usos e situação)         |
| POST   | `/api/cupons`               | admin   | Cria cupom (código, %, mínimo, usos, validade) |
| PUT    | `/api/cupons/:id`           | admin   | Atualiza / ativa / desativa cupom          |
| DELETE | `/api/cupons/:id`           | admin   | Exclui cupom                               |
| GET    | `/api/relatorios/caixa`     | admin   | **Fase 8**: receita, despesas, saldo e extrato — `?agrupamento=dia\|mes\|ano` |
| GET    | `/api/relatorios/produtos`  | admin   | Quanto cada produto vendeu e lucrou        |

## 🎨 Identidade visual

- **Paleta da casa:** verde Monster em gradiente (`#6ac30e → #1f8a3b`), com
  vermelho (`#d62828`) e amarelo (`#ffd60a`) nos detalhes — pegada de rede de
  lanchonete.
- **Fundo:** lanches ilustrados em baixa opacidade (`public/img/lanche.svg`,
  aplicado em `body::before` com `opacity: .07`).
  Para usar uma **foto real** de lanche, basta substituir esse arquivo (ou
  apontar o `url()` do CSS para a foto) e ajustar o `background-size`.
- **Turma Monster** (chibi, em SVG vetorial em `public/img/monstros/`):
  Fantasma, Esqueleto, Bruxa, Frank, Draculinha, Lobi (lobisomem),
  Faraó (múmia), Pântano e Zu (zumbi).
- **Pré-visualizações em PNG:** `docs/artes/` (geradas a partir dos SVGs).
- **Interface compartilhada:** `public/js/layout.js` monta o cabeçalho e a
  navegação conforme o papel do usuário; `public/js/senha.js` cuida do botão
  de mostrar/esconder a senha (acessível por teclado); `public/js/mascote.js`
  sorteia um monstro para o topo das telas de entrada.
- **🎵 Musiquinha 8-bits** (`public/js/musica.js`): tema sombrio em Lá menor
  **gerado em tempo real** com a Web Audio API (osciladores quadrados, baixo
  triangular, bumbo e chimbal de ruído) — nenhum arquivo de áudio no repositório.
  Toca em **todo o site** (login, cadastro, loja, painel, produtos, compras) e
  **não corta** ao trocar de página: a continuidade vem de uma **âncora de
  relógio** gravada no `sessionStorage` (`inicioEm = Date.now() - posição`), então
  a música retoma no mesmo compasso em que estaria — sem acumular erro a cada
  navegação. Botão flutuante 🔊/🔇 liga/desliga, e a escolha vale para o site
  todo. Só **uma aba toca por vez** (trava com batida de coração no
  `localStorage`), senão duas abas abertas — loja e painel lado a lado — tocariam
  a mesma trilha fora de fase.
  ⚠️ É carregada com `type="module"` de propósito: sem escopo isolado, as
  variáveis do arquivo colidiriam com as das páginas (o login declara `const botao`).

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
- **Cadastro não loga automaticamente**: o novo usuário confirma a senha na tela de
  login (evita sessão criada "sem querer" em aparelho de terceiros).
- **Excluir a própria conta é exclusão LÓGICA** (`ativo = 0`): o histórico de pedidos
  e o fluxo de caixa continuam íntegros; o efeito prático para a pessoa é o mesmo —
  ela não entra mais.
- **Abas de navegação só para admin**: o cliente não vê (nem transita) entre loja e
  painel. As abas nascem com `data-somente-admin` e o servidor bloqueia por trás.
  ⚠️ O CSS tem `[hidden] { display: none !important; }` — sem essa regra, o
  `display: flex` das classes atropelava o atributo `hidden` e as abas apareciam
  para o cliente. Há teste de regressão para isso.
- **Admin não exclui a própria conta**: precisa ser rebaixado a cliente por outro
  admin antes. Protege a loja de ficar sem ninguém capaz de administrá-la.
- **Mascote aleatório** no topo de login/cadastro (`public/js/mascote.js`): cada
  visita sorteia um dos 9 monstros.
- **Dinheiro em CENTAVOS (INTEGER), não em decimal**: `0.1 + 0.2` em ponto flutuante
  dá `0.30000000000000004`; somando dezenas de pedidos isso vira "centavo fantasma"
  no caixa. Guardamos inteiros e convertemos só na borda (`src/utils/moeda.js`).
- **Custo do lanche vem da FICHA TÉCNICA** (soma de quantidade × custo do ingrediente);
  **custo da bebida vem da compra** (`custo_compra`) — bebida é revenda, não receita.
- **`custoConfiavel`**: lanche sem ficha técnica responde com margem "não confiável"
  para o front não exibir um 100% de margem que não existe.
- **Índice único PARCIAL** (`WHERE ativo = 1`): impede dois ingredientes/produtos
  ativos com o mesmo nome, mas libera o nome quando o item é desativado.
- **Soma do custo no SQL** (`LEFT JOIN` + `GROUP BY`): evita o problema "N+1"
  (uma consulta por produto) ao listar o cardápio.
- **Ingrediente pode ser EXCLUÍDO de verdade; produto não.** Ingrediente não tem
  histórico (nenhum pedido aponta para ele) — então `DELETE` apaga. Produto vai
  aparecer nos pedidos, então desativar é o caminho. A exclusão de ingrediente é
  bloqueada (409) se ele estiver em alguma ficha técnica, com a lista dos lanches.
- **Auditoria é fotografia, não espelho** (`auditoria`): guardamos uma cópia do
  nome e do papel de quem agiu. Se a pessoa mudar de nome ou virar admin depois,
  o registro de ontem continua contando a história de ontem.
- **ID simples do usuário** (`#0001`, `#0002`...): derivado do id do banco e
  mostrado na interface, para identificar na conversa quem fez cada alteração.
- **Cardápio público tem mapper PRÓPRIO**: `/api/cardapio` nunca usa o mapper do
  painel, justamente para não vazar custo, margem, estoque ou ficha técnica.
- **Carrinho no `localStorage`, com chave por usuário** (`monsterCarrinho:<id>`):
  duas contas na mesma máquina não misturam pedidos, e o carrinho sobrevive ao
  recarregar a página.
- **Compra do fornecedor recalcula o custo sozinha** (média ponderada:
  `Σ valor pago ÷ Σ quantidade comprada`). É o que liga a despesa da loja ao custo
  do lanche e, por consequência, à margem. Média móvel por lote exigiria controlar
  estoque por lote — complexidade que não se paga nesta fase.
- **Preço e nome CONGELADOS no item do pedido**: reajustar o cardápio hoje não
  reescreve o que o cliente fechou ontem. Histórico não se reescreve.
- **Itens repetidos são consolidados ANTES de validar estoque**: se o carrinho
  mandasse "3 + 3" de uma bebida com 5 em estoque em duas linhas, a validação
  passaria duas vezes — juntando primeiro, o furo fecha.
- **Estoque de bebida é baixado na confirmação do pagamento** (lanche não tem
  estoque: é produzido na hora). O `MAX(0, ...)` impede estoque negativo.
- **Telefone e endereço são exigidos para fechar o pedido** — é aqui que os dados
  de entrega são recolhidos; ficam editáveis em "Minha conta".
- **Continuidade da música por ÂNCORA DE RELÓGIO**, não por posição salva em
  intervalos: `inicioEm = Date.now() - posição`. Salvar a posição a cada 250ms
  pareceria funcionar, mas somaria o atraso de cada troca de página — depois de
  dez navegações a música estaria visivelmente atrás. Com a âncora, o relógio é a
  única fonte da verdade e a posição é sempre `Date.now() - inicioEm`.
- **Uma aba só toca a música** (trava no `localStorage` + batida de coração): com
  duas abas abertas a mesma trilha sairia fora de fase e viraria um som sujo.
- **Área do cliente dividida em PÁGINAS, não em cards empilhados**: cardápio,
  carrinho, pagamento, meus pedidos, acompanhar e minha conta são telas próprias.
  Uma home com seis blocos vira poluição; cada assunto na sua janela é mais fácil
  de usar no celular — e o carrinho sobrevive à navegação (por isso ele vive no
  `localStorage` com chave por usuário, no módulo `carrinho.js`).
- **Preço com promoção é decidido por UMA função** (`promocoes.service.precoVigente`),
  usada pelo cardápio E pelo pedido. Se cada tela calculasse o desconto por conta
  própria, uma hora o preço mostrado divergiria do cobrado.
- **Cupom é revalidado ao CRIAR o pedido**, não só no botão "Aplicar": sem isso,
  daria para aplicar na tela, deixar o cupom vencer/esgotar e mandar o pedido.
- **Uso de cupom só conta quando o pedido é PAGO** — carrinho abandonado não queima
  o cupom de ninguém.
- **Status do pedido só anda para frente** (mapa `PROXIMOS_STATUS`): pular de "pago"
  direto para "entregue" deixaria buracos no histórico. Cancelar um pedido pago
  **devolve o estoque** das bebidas.
- **Arte do produto é uma lista fechada no código** (`utils/mascotes.js`): o nome do
  mascote aponta para um arquivo SVG, então texto livre quebraria a imagem. Sem
  escolha do dono, a arte é derivada do id — nunca fica tudo igual, e não troca a
  cada visita.
- **`reais()` e a navegação vivem no `layout.js`**, e as páginas NÃO redeclaram nada
  disso (colisão de escopo global mata o script inteiro em silêncio — ver o teste
  `tests/escopo-global.test.js`, feito depois de esse bug morder duas vezes).
