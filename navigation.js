/**
 * navigation.js — Gestión de tabs y vistas de la aplicación.
 */
 
import { state } from './state.js';
 
const VIEWS = ['home', 'reserve', 'board', 'people', 'profile', 'admin', 'my-reservations'];
 
/**
 * Activa una vista de la aplicación (oculta las demás).
 */
export function activateAppView(viewId) {
  state.currentView = viewId;
 
  VIEWS.forEach((id) => {
    const el = document.getElementById(`view-${id}`);
    if (el) el.style.display = id === viewId ? 'block' : 'none';
  });
 
  // Sincronizar tab activa en la barra de navegación
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === viewId);
  });
}
 
/**
 * Alias semántico para abrir un tab desde otros módulos.
 */
export function openTab(viewId) {
  activateAppView(viewId);
}
 
/**
 * Configura los event listeners de la barra de navegación.
 */
export function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      if (view) activateAppView(view);
    });
  });
}
