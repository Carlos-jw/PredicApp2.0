/**
 * modals.js — Control de apertura y cierre de modales.
 */

/**
 * Abre un modal por su ID.
 * Añade la clase 'modal-open' al body para bloquear scroll.
 */
export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  // Cerrar al hacer clic en el backdrop
  modal.addEventListener('click', _backdropClose, { once: false });
}

/**
 * Cierra un modal por su ID.
 */
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  modal.removeEventListener('click', _backdropClose);

  // Quitar clase body si no quedan modales abiertos
  if (!document.querySelector('.modal[style*="flex"]')) {
    document.body.classList.remove('modal-open');
  }
}

/**
 * Cierra todos los modales abiertos.
 */
export function closeAllModals() {
  document.querySelectorAll('.modal').forEach((m) => {
    m.style.display = 'none';
    m.setAttribute('aria-hidden', 'true');
    m.removeEventListener('click', _backdropClose);
  });
  document.body.classList.remove('modal-open');
}

/**
 * Muestra el modal de reasignación de punto y devuelve Promise<boolean>.
 * @param {{ from, to, affectedReservations }} payload
 */
export function showReassignModal(payload) {
  return new Promise((resolve) => {
    const modal   = document.getElementById('modal-reassign');
    if (!modal) { resolve(false); return; }

    const fromEl  = document.getElementById('reassign-from-point');
    const toEl    = document.getElementById('reassign-to-point');
    const countEl = document.getElementById('reassign-affected-count');
    const btnOk   = document.getElementById('btn-reassign-confirm');
    const btnCancel = document.getElementById('btn-reassign-cancel');

    if (fromEl)  fromEl.textContent  = payload.from?.pointName  ?? '—';
    if (toEl)    toEl.textContent    = payload.to?.pointName    ?? '—';
    if (countEl) countEl.textContent = String(payload.affectedReservations?.length ?? 0);

    const finish = (confirmed) => {
      closeModal('modal-reassign');
      btnOk?.removeEventListener('click', onOk);
      btnCancel?.removeEventListener('click', onCancel);
      resolve(confirmed);
    };

    const onOk     = () => finish(true);
    const onCancel = () => finish(false);

    btnOk?.addEventListener('click',    onOk,    { once: true });
    btnCancel?.addEventListener('click', onCancel, { once: true });

    openModal('modal-reassign');
  });
}

// ─── Cierre por backdrop ──────────────────────────────────────────────────────

function _backdropClose(event) {
  if (event.target === event.currentTarget) {
    closeModal(event.currentTarget.id);
  }
}

// ─── Inicialización global de botones de cierre ───────────────────────────────

export function initModalCloseButtons() {
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.closeModal;
      if (id) closeModal(id);
      else    closeAllModals();
    });
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}
