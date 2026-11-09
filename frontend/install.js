(() => {
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
  let prompt;
  const button = document.createElement('button');
  button.className = 'install-app'; button.textContent = 'Instalar AlertaBairro'; button.hidden = true;
  document.body.append(button);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; button.hidden = false; });
  button.addEventListener('click', async () => { if (!prompt) return; await prompt.prompt(); await prompt.userChoice; prompt = null; button.hidden = true; });
  window.addEventListener('appinstalled', () => { button.hidden = true; prompt = null; });
})();
