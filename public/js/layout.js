/* =====================================================================
   layout.js — pedaços de interface COMPARTILHADOS entre as páginas.

   Por quê um arquivo só? O cabeçalho (navegação) é o mesmo no painel e na
   loja. Se cada página montasse o seu, qualquer mudança viraria três
   alterações diferentes — e uma delas esquecida. Aqui é uma fonte da verdade.
   ===================================================================== */

/**
 * Ajusta a navegação conforme o PAPEL do usuário.
 *
 * Como funciona: no HTML, os links administrativos nascem marcados com
 * `data-somente-admin` e com o atributo `hidden`. Para admins, removemos o
 * `hidden`; para clientes, o link simplesmente NÃO aparece.
 *
 * ⚠️ Isto é apenas experiência de uso. A segurança de verdade está no servidor
 * (guard das páginas /admin/* e o middleware somenteAdmin nas APIs).
 */
function ajustarNavegacao(usuario) {
  const linksAdmin = document.querySelectorAll('[data-somente-admin]');

  linksAdmin.forEach((link) => {
    if (usuario.papel === 'admin') {
      link.removeAttribute('hidden');
    } else {
      link.setAttribute('hidden', '');
    }
  });
}

/** Preenche nome, primeiro nome e o selo de papel (admin/cliente). */
function exibirUsuario(usuario) {
  document.querySelectorAll('[data-nome-usuario]').forEach((el) => {
    el.textContent = usuario.nome;
  });

  document.querySelectorAll('[data-primeiro-nome]').forEach((el) => {
    el.textContent = usuario.nome.split(' ')[0];
  });

  document.querySelectorAll('[data-papel-usuario]').forEach((el) => {
    el.textContent = usuario.papel === 'admin' ? '👑 admin' : '🙋 cliente';
    el.className = `selo ${usuario.papel}`;
  });

  // Faixa explicativa: admin vê um aviso de que pode navegar nas duas áreas.
  document.querySelectorAll('[data-aviso-papel]').forEach((el) => {
    el.hidden = usuario.papel !== 'admin';
  });
}

/** Atalho: protege a página e já desenha a interface do usuário. */
async function iniciarPagina(papelNecessario) {
  const usuario = await protegerPagina(papelNecessario);
  if (!usuario) return null; // redirecionou

  exibirUsuario(usuario);
  ajustarNavegacao(usuario);
  return usuario;
}
