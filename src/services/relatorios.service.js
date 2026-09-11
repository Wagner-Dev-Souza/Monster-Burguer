import * as relatoriosRepo from '../repositories/relatorios.repository.js';
import * as produtosRepo from '../repositories/produtos.repository.js';
import * as promocoesRepo from '../repositories/promocoes.repository.js';
import { precoVigente } from './promocoes.service.js';
import { centavosParaReais } from '../utils/moeda.js';
import { ErroValidacao } from '../utils/errors.js';

/**
 * FASE 8 — RELATÓRIOS FINANCEIROS (o fluxo de caixa da loja).
 *
 * A conta que o dono quer ver:
 *   RECEITA (pedidos pagos) − DESPESAS (compras) = SALDO
 *
 * Tudo por período (dia, mês ou ano) e com o detalhamento por produto, para
 * responder também "qual lanche dá mais lucro?" — que é a pergunta que decide
 * o cardápio.
 */
export const AGRUPAMENTOS = ['dia', 'mes', 'ano'];

function rotularPeriodo(periodo, agrupamento) {
  if (!periodo) return '(sem data)';

  const [ano, mes, dia] = String(periodo).split('-');

  if (agrupamento === 'ano') return ano;
  if (agrupamento === 'mes') return `${mes}/${ano}`;
  return `${dia}/${mes}/${ano}`;
}

export function fluxoDeCaixa({ agrupamento = 'dia', limite = 30 } = {}) {
  if (!AGRUPAMENTOS.includes(agrupamento)) {
    throw new ErroValidacao('Agrupamento inválido. Use "dia", "mes" ou "ano".');
  }

  const receitas = relatoriosRepo.receitaPorPeriodo(agrupamento, limite);
  const despesas = relatoriosRepo.despesasPorPeriodo(agrupamento, limite);

  // Junta as duas listas num mapa por período (um período pode ter só receita,
  // só despesa, ou as duas coisas).
  const porPeriodo = new Map();

  for (const linha of receitas) {
    porPeriodo.set(linha.periodo, {
      periodo: linha.periodo,
      rotulo: rotularPeriodo(linha.periodo, agrupamento),
      receitaCentavos: linha.receita,
      despesasCentavos: 0,
      pedidos: linha.pedidos,
      compras: 0,
    });
  }

  for (const linha of despesas) {
    const atual = porPeriodo.get(linha.periodo) ?? {
      periodo: linha.periodo,
      rotulo: rotularPeriodo(linha.periodo, agrupamento),
      receitaCentavos: 0,
      despesasCentavos: 0,
      pedidos: 0,
      compras: 0,
    };

    atual.despesasCentavos = linha.despesas;
    atual.compras = linha.compras;
    porPeriodo.set(linha.periodo, atual);
  }

  const periodos = [...porPeriodo.values()]
    .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)))
    .map((linha) => {
      const saldoCentavos = linha.receitaCentavos - linha.despesasCentavos;

      return {
        periodo: linha.periodo,
        rotulo: linha.rotulo,
        receita: centavosParaReais(linha.receitaCentavos),
        despesas: centavosParaReais(linha.despesasCentavos),
        saldo: centavosParaReais(saldoCentavos),
        positivo: saldoCentavos >= 0,
        pedidos: linha.pedidos,
        compras: linha.compras,
      };
    });

  const resumoBruto = relatoriosRepo.resumoGeral();
  const saldoCentavos = resumoBruto.receitaCentavos - resumoBruto.despesasCentavos;
  const ticketMedioCentavos = resumoBruto.pedidosPagos > 0
    ? Math.round(resumoBruto.receitaCentavos / resumoBruto.pedidosPagos)
    : 0;

  return {
    agrupamento,
    resumo: {
      receita: centavosParaReais(resumoBruto.receitaCentavos),
      despesas: centavosParaReais(resumoBruto.despesasCentavos),
      saldo: centavosParaReais(saldoCentavos),
      positivo: saldoCentavos >= 0,
      pedidosPagos: resumoBruto.pedidosPagos,
      compras: resumoBruto.compras,
      descontosDados: centavosParaReais(resumoBruto.descontosCentavos),
      ticketMedio: centavosParaReais(ticketMedioCentavos),
      aguardandoPagamento: resumoBruto.aguardandoPagamento,
    },
    periodos,
  };
}

export function extratoDoCaixa({ limite = 40 } = {}) {
  const linhas = relatoriosRepo.extrato({ limite });

  return {
    movimentacoes: linhas.map((linha) => ({
      tipo: linha.tipo,                                  // entrada | saida
      referenciaId: linha.referencia_id,
      descricao: linha.descricao,
      valor: centavosParaReais(linha.valor),
      entrada: linha.valor > 0,
      quando: linha.quando,
    })),
  };
}

/**
 * Margem por produto: cruza o que foi vendido com o custo ATUAL de cada produto.
 *
 * ⚠️ Observação honesta: o custo usado é o de HOJE (não o da data da venda). Como
 * o custo muda com as compras, o lucro mostrado é uma boa estimativa gerencial,
 * não contabilidade de custo histórico exato. Para isso, o custo do item também
 * precisaria ser congelado no pedido (fica como evolução futura).
 */
export function margemPorProduto() {
  const vendas = relatoriosRepo.vendasPorProduto();
  const promocoesVigentes = new Map(promocoesRepo.listarVigentes().map((promocao) => [promocao.produtoId, promocao]));

  return vendas.map((venda) => {
    const produto = produtosRepo.buscarPorId(venda.produtoId);

    const custoCentavos = !produto
      ? 0
      : produto.tipo === 'bebida'
        ? (produto.custoCompraCentavos ?? 0)
        : Math.round(produto.custoFichaCentavos);

    const custoTotalCentavos = Math.round(custoCentavos * venda.quantidade);
    const lucroCentavos = venda.receita - custoTotalCentavos;
    const preco = produto ? precoVigente(produto, promocoesVigentes.get(produto.id) ?? null) : null;

    return {
      produtoId: venda.produtoId,
      nome: venda.nome,
      tipo: venda.tipo,
      aindaNoCardapio: Boolean(produto?.ativo),
      quantidadeVendida: venda.quantidade,
      receita: centavosParaReais(venda.receita),
      receitaSemPromocao: centavosParaReais(venda.receitaSemPromocao ?? venda.receita),
      descontoDado: centavosParaReais((venda.receitaSemPromocao ?? venda.receita) - venda.receita),
      custoUnitario: centavosParaReais(custoCentavos),
      custoTotal: centavosParaReais(custoTotalCentavos),
      lucro: centavosParaReais(lucroCentavos),
      lucroPercentual: venda.receita > 0 ? Number(((lucroCentavos / venda.receita) * 100).toFixed(2)) : null,
      promocaoAtiva: Boolean(preco?.percentual),
    };
  });
}
