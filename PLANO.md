# Plano de Fases — Monster Burguer

Cada fase é construída, testada e enviada (push) de forma independente.
No fim, tudo funciona ponta a ponta.

## Fase 0 — Fundação 🏗️ — ✅ CONCLUÍDA
Estrutura de pastas, `package.json`, `.env.example`, `.gitignore`, README,
conexão SQLite, sistema de migrations, Express com health check e tratamento
global de erros, suíte de testes.

**Entregável:** `npm install && npm run dev` → servidor no ar, banco criado,
testes passando.

## Fase 1 — Usuários, Login e Permissões 🔐 — ✅ CONCLUÍDA
Tabela `usuarios` (nome, CPF, senha com hash, papel `cliente`|`admin`, ativo).
Cadastro de cliente, login com CPF + senha, token JWT em cookie HttpOnly.
Middlewares `autenticar` e `autorizarAdmin`. Admin inicial criado por seed.
Rota para o admin promover/rebaixar usuários. Telas de login/cadastro com
redirecionamento por papel.

**Entregável:** o sistema distingue **cliente** de **admin**, e só admin entra
nas áreas administrativas.

## Fase 2 — Produtos, Ingredientes e Composição 🍔 — ✅ CONCLUÍDA
Tabelas `produtos` (tipo lanche|bebida, estoque, ativo), `ingredientes` e
`produto_composicao` (ficha técnica). CRUD no painel do dono. Cálculo automático
do custo de produção e da margem de cada sanduíche.

## Fase 3 — Compras/Despesas e Estoque 📦 — ✅ CONCLUÍDA
Tabela `compras` (ingrediente, quantidade, valor, fornecedor, data). Cada compra
recalcula o **custo médio ponderado** do ingrediente. Controle de estoque,
inclusive das bebidas.

## Fase 4 — Loja do Cliente: cardápio e carrinho 🛒 — ✅ CONCLUÍDA
Endpoints do cardápio (lanches + bebidas ativos). Carrinho no navegador:
adicionar, remover item, alterar quantidade e voltar ao cardápio.

> Observação: a Fase 4 foi entregue antes da Fase 3 (a pedido do cliente);
> ambas já estão concluídas.

## Fase 5 — Pedidos, Checkout e Pagamento Simulado 💳 — ✅ CONCLUÍDA
Tabelas `pedidos` e `pedido_itens` (com preço congelado). Confirmação do pedido,
revisão dos itens, escolha da forma de pagamento (PIX, crédito, débito, dinheiro
com troco, na entrega) e botão de **confirmar pagamento (simulado)** → o pedido
vira receita da loja.

## Fase 6 — Acompanhamento do Pedido 🛵
Fluxo de status: `aguardando_pagamento → pago → em_preparo → pronto →
saiu_entrega → entregue`. O cliente acompanha; o admin avança o status.

## Fase 7 — Promoções e Cupons 🎟️
Promoção por produto (desconto %) e cupom de desconto (código, %, validade),
aplicados no total do pedido.

## Fase 8 — Relatórios Financeiros 📊
Dashboard do dono: receita (pedidos pagos), despesa (compras), saldo, histórico
por pedido com filtro por dia/mês/ano e margem por produto.
