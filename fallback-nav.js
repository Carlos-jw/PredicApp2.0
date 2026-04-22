/**
 * fallback-nav.js — Navegación mínima de respaldo.
 * Mantiene funcionales las pestañas aunque falle app.js.
 */
 
(function () {
  const VIEWS = ['home', 'reserve', 'board', 'people', 'profile', 'admin', 'my-reservations'];
 
  function activateView(viewId) {
    if (!VIEWS.includes(viewId)) return;
 
    VIEWS.forEach((id) => {
      const el = document.getElementById(`view-${id}`);
      if (el) el.style.display = id === viewId ? 'block' : 'none';
    });
 
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.view === viewId);
    });
  }
 
  function handleEvent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
 
    const tab = target.closest('.nav-tab');
    if (!tab) return;
 
    const viewId = tab.dataset.view;
    if (!viewId) return;
    activateView(viewId);
  }
 
  document.addEventListener('click', handleEvent, true);
  document.addEventListener('pointerup', handleEvent, true);
 
  window.__predicappFallbackActivateView = activateView;
 
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => activateView('home'), { once: true });
  } else {
    activateView('home');
  }
})();
