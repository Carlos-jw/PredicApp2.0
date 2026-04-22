/**
 * toast.js — Notificaciones, confirm y prompt no bloqueantes.
 */

// ─── Toast ─────────────────────────────────────────────────────────────────────

let _container = null;

function getContainer() {
  if (!_container) {
    _container = document.createElement('div');
    _container.id = 'toast-container';
    Object.assign(_container.style, {
      position:      'fixed',
      bottom:        '24px',
      right:         '16px',
      zIndex:        '9999',
      display:       'flex',
      flexDirection: 'column',
      gap:           '8px',
      maxWidth:      '360px',
      pointerEvents: 'none'
    });
    document.body.appendChild(_container);
  }
  return _container;
}

const TYPE_COLORS = {
  success: '#2e7d32',
  error:   '#b00020',
  warning: '#b45309',
  info:    '#1a3a5c'
};

/**
 * Muestra un toast.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type]
 * @param {number} [duration] ms
 */
export function toast(message, type = 'info', duration = 4000) {
  const container = getContainer();
  const el        = document.createElement('div');

  Object.assign(el.style, {
    background:   TYPE_COLORS[type] ?? TYPE_COLORS.info,
    color:        '#fff',
    padding:      '10px 16px',
    borderRadius: '8px',
    fontSize:     '14px',
    lineHeight:   '1.4',
    boxShadow:    '0 2px 8px rgba(0,0,0,.25)',
    pointerEvents:'auto',
    cursor:       'pointer',
    opacity:      '0',
    transition:   'opacity .2s'
  });

  el.textContent = message;
  el.addEventListener('click', () => el.remove());
  container.appendChild(el);

  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, duration);
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

/**
 * Confirmación no bloqueante. Devuelve Promise<boolean>.
 */
export function confirm(message) {
  return new Promise((resolve) => {
    const overlay = _buildOverlay();
    const box     = document.createElement('div');
    Object.assign(box.style, {
      background:   '#fff',
      borderRadius: '12px',
      padding:      '24px',
      maxWidth:     '360px',
      width:        '90%',
      boxShadow:    '0 8px 32px rgba(0,0,0,.2)',
      fontFamily:   'system-ui, sans-serif'
    });

    const msg = document.createElement('p');
    msg.textContent = message;
    Object.assign(msg.style, { margin: '0 0 20px', fontSize: '15px', lineHeight: '1.5' });

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });

    const btnCancel = _btn('Cancelar', '#e2e8f0', '#1a202c');
    const btnOk     = _btn('Aceptar',  '#1a3a5c', '#fff');

    btnCancel.addEventListener('click', () => { overlay.remove(); resolve(false); });
    btnOk.addEventListener('click',     () => { overlay.remove(); resolve(true);  });

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnOk);
    box.appendChild(msg);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    btnOk.focus();
  });
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

/**
 * Prompt no bloqueante. Devuelve Promise<string|null>.
 */
export function promptInput(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = _buildOverlay();
    const box     = document.createElement('div');
    Object.assign(box.style, {
      background:   '#fff',
      borderRadius: '12px',
      padding:      '24px',
      maxWidth:     '360px',
      width:        '90%',
      boxShadow:    '0 8px 32px rgba(0,0,0,.2)',
      fontFamily:   'system-ui, sans-serif'
    });

    const msg = document.createElement('p');
    msg.textContent = message;
    Object.assign(msg.style, { margin: '0 0 12px', fontSize: '15px', lineHeight: '1.5', whiteSpace: 'pre-wrap' });

    const input = document.createElement('input');
    input.type  = 'text';
    input.value = defaultValue;
    Object.assign(input.style, {
      width:        '100%',
      padding:      '8px 10px',
      fontSize:     '14px',
      border:       '1.5px solid #cbd5e0',
      borderRadius: '6px',
      boxSizing:    'border-box',
      marginBottom: '16px',
      outline:      'none'
    });

    const btnRow  = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });

    const btnCancel = _btn('Cancelar', '#e2e8f0', '#1a202c');
    const btnOk     = _btn('Aceptar',  '#1a3a5c', '#fff');

    const finish = (value) => { overlay.remove(); resolve(value); };

    btnCancel.addEventListener('click', () => finish(null));
    btnOk.addEventListener('click',     () => finish(input.value || null));
    input.addEventListener('keydown',   (e) => {
      if (e.key === 'Enter')  finish(input.value || null);
      if (e.key === 'Escape') finish(null);
    });

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnOk);
    box.appendChild(msg);
    box.appendChild(input);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();
  });
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function _buildOverlay() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position:       'fixed',
    inset:          '0',
    background:     'rgba(0,0,0,.45)',
    zIndex:         '10000',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center'
  });
  return el;
}

function _btn(label, bg, color) {
  const b = document.createElement('button');
  b.type  = 'button';
  b.textContent = label;
  Object.assign(b.style, {
    padding:      '8px 18px',
    border:       'none',
    borderRadius: '6px',
    background:   bg,
    color,
    fontSize:     '14px',
    cursor:       'pointer',
    fontWeight:   '500'
  });
  return b;
}
