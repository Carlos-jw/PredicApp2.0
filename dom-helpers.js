/**
 * dom-helpers.js — Helpers para manipulación del DOM.
 */

/**
 * Establece el textContent de un elemento por su ID.
 */
export function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? '');
}

/**
 * Establece el value de un input/select por su ID.
 */
export function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = String(value ?? '');
}

/**
 * Renderiza un array de opciones en un <select>.
 * @param {HTMLSelectElement} selectEl
 * @param {Array<{value: string, label: string}>} options
 */
export function renderSelectOptions(selectEl, options) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  options.forEach(({ value, label }) => {
    const opt   = document.createElement('option');
    opt.value   = value;
    opt.textContent = label;
    selectEl.appendChild(opt);
  });
}
