const APP_URL = 'https://seculoca.vercel.app';
function injectButton() {
  if (document.getElementById('lv-btn')) return;
  const btn = document.createElement('div');
  btn.id = 'lv-btn';
  btn.innerHTML = '<div id="lv-widget"><div id="lv-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 5L10.5 6.5V9.5L8 11L5.5 9.5V6.5L8 5Z" fill="white"/></svg></div><span>Vérifier avec Seculoca</span></div>';
  document.body.appendChild(btn);
  btn.addEventListener('click', () => window.open(APP_URL + '/analyser?url=' + encodeURIComponent(window.location.href), '_blank'));
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', injectButton) : injectButton();
