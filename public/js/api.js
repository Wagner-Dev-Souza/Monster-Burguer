/* =====================================================================
   api.js — cliente HTTP do front-end
   Centraliza TODA chamada à API num só lugar:
     * envia o cookie de sessão (credentials: 'include')
     * transforma erro HTTP em exceção com mensagem legível
     * cuida do redirecionamento por papel (cliente x admin)
   ===================================================================== */

const API = {
  async requisitar(caminho, opcoes = {}) {
    const resposta = await fetch(caminho, {
      credentials: 'include', // sem isso o cookie do JWT não viaja
      headers: { 'Content-Type': 'application/json', ...(opcoes.headers ?? {}) },
      ...opcoes,
    });

    const temCorpo = resposta.status !== 204;
    const dados = temCorpo ? await resposta.json().catch(() => ({})) : {};

    if (!resposta.ok) {
      const erro = new Error(dados.erro ?? 'Não foi possível completar a operação.');
      erro.status = resposta.status;
      erro.codigo = dados.codigo;
      throw erro;
    }

    return dados;
  },

  get(caminho) {
    return this.requisitar(caminho);
  },

  post(caminho, corpo) {
    return this.requisitar(caminho, { method: 'POST', body: JSON.stringify(corpo ?? {}) });
  },

  patch(caminho, corpo) {
    return this.requisitar(caminho, { method: 'PATCH', body: JSON.stringify(corpo ?? {}) });
  },

  delete(caminho) {
    return this.requisitar(caminho, { method: 'DELETE' });
  },
};

/**
 * Protege uma página: garante que existe sessão e, se for exigido, que o
 * usuário é admin. Caso contrário, manda para o lugar certo.
 * Retorna o usuário logado ou null (quando redireciona).
 */
async function protegerPagina(papelNecessario) {
  try {
    const { usuario } = await API.get('/api/auth/eu');

    if (papelNecessario === 'admin' && usuario.papel !== 'admin') {
      window.location.href = '/loja.html'; // cliente não entra no painel
      return null;
    }
    return usuario;
  } catch {
    window.location.href = '/login.html'; // sem sessão válida
    return null;
  }
}

/** Mostra uma faixa de aviso (sucesso/erro) dentro da página. */
function mostrarMensagem(elemento, texto, tipo = 'erro') {
  elemento.textContent = texto;
  elemento.className = `mensagem visivel ${tipo}`;
}

/** Formata CPF para exibição: 11144477735 -> 111.444.777-35 */
function formatarCPF(cpf) {
  const digitos = String(cpf ?? '').replace(/\D/g, '');
  if (digitos.length !== 11) return digitos;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/** Só os dígitos (o que a API espera). */
function apenasDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

async function sair() {
  await API.post('/api/auth/logout');
  window.location.href = '/login.html';
}
