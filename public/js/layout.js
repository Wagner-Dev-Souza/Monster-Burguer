/* =====================================================================
   layout.js — pedaços de interface COMPARTILHADOS entre as páginas.

   Por quê um arquivo só? O cabeçalho (navegação) é o mesmo no painel e na
   loja. Se cada página montasse o seu, qualquer mudança viraria duas
   alterações diferentes — e uma delas esquecida. Aqui é uma fonte da verdade.
   ===================================================================== */

/**
 * Ajusta a navegação conforme o PAPEL do usuário.
 *
 * Como funciona: no HTML, os elementos administrativos nascem com
 * `data-somente-admin` + `hidden`; os exclusivos de cliente com
 * `data-somente-cliente` + `hidden`. Aqui revelamos só o que faz sentido.
 *
 * ⚠️ Isto é apenas experiência de uso. A segurança de verdade está no servidor
 * (guard das páginas /admin/* e o middleware somenteAdmin nas APIs).
 */
function ajustarNavegacao(usuario) {
  const ehAdmin = usuario.papel === 'admin';

  document.querySelectorAll('[data-somente-admin]').forEach((el) => {
    el.hidden = !ehAdmin;
  });

  document.querySelectorAll('[data-somente-cliente]').forEach((el) => {
    el.hidden = ehAdmin;
  });
}

/** Preenche nome, primeiro nome, selo do topo e avisos contextuais. */
function exibirUsuario(usuario) {
  document.querySelectorAll('[data-nome-usuario]').forEach((el) => {
    el.textContent = usuario.nome;
  });

  document.querySelectorAll('[data-primeiro-nome]').forEach((el) => {
    el.textContent = usuario.nome.split(' ')[0];
  });

  // O selo no canto superior direito mostra o NOME da pessoa (com o ícone do
  // papel) e o ID simples dela (#0001, #0002...), para identificar na conversa
  // quem fez cada coisa no sistema.
  document.querySelectorAll('[data-papel-usuario]').forEach((el) => {
    const icone = usuario.papel === 'admin' ? '👑' : '🙋';
    el.textContent = `${icone} ${usuario.nome} · ${usuario.codigo}`;
    el.className = `selo ${usuario.papel}`;
    el.title = usuario.papel === 'admin'
      ? `Administrador da loja (${usuario.codigo})`
      : `Cliente ${usuario.codigo}`;
  });

  // Onde aparecer só o código (ex.: "Minha conta")
  document.querySelectorAll('[data-codigo-usuario]').forEach((el) => {
    el.textContent = usuario.codigo;
  });

  // Avisos que só fazem sentido para admin (ex.: regra de exclusão de conta).
  document.querySelectorAll('[data-aviso-admin]').forEach((el) => {
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
