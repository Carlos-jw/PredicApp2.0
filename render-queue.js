/**
 * render-queue.js — Cola de renderizado con debounce.
 * Evita renders múltiples síncronos en el mismo frame.
 */
 
import { updateStats, syncAccessBadges, syncAccessGateBanner, syncHomePendingPanels, renderPermissionHints } from './render-misc.js';
import { renderProfilePanel } from './render-profile.js';
import { renderAdminLists, renderPendingApprovalAdminList, renderPendingApprovalList } from './render-admin.js';
import { renderHomeDirectory } from './render-home.js';
import { renderParticipantsList } from './setup-participants.js';
import { updateLoggedPickPointPanel } from './enroll-form.js';
import { renderSelectOptions } from './dom-helpers.js';
import { state } from './state.js';
import { isAdmin, isSubadmin } from './permissions.js';
 
let _scheduled = false;
 
/**
 * Programa un render en el próximo frame de animación (debounced).
 */
export function render() {
  if (_scheduled) return;
  _scheduled = true;
  requestAnimationFrame(() => {
    _scheduled = false;
    _doRender();
  });
}
 
function _doRender() {
  try {
    syncAccessBadges();
    syncAccessGateBanner();
    syncHomePendingPanels();
    updateLoggedPickPointPanel();
    updateStats();
    renderPermissionHints();
    renderProfilePanel();
    renderHomeDirectory();
    renderParticipantsList();
    renderBoardTable();
 
    // Panel admin: solo visible para admin o subadmin
    const adminView = document.getElementById('view-admin');
    if (adminView) {
      const showAdmin = Boolean(state.authUser && (isAdmin(state.profile) || isSubadmin(state.profile)));
      adminView.style.display = state.currentView === 'admin' && showAdmin ? 'block' : 'none';
    }
 
    if (isAdmin(state.profile) || isSubadmin(state.profile)) {
      renderAdminLists();
      renderPendingApprovalAdminList();
      renderPendingApprovalList();
    }
 
    // Sync selectores
    _syncPointSelector();
    _syncReserveFormSelects();
    _syncSubadminPointSelect();
  } catch (err) {
    console.error('Error en render:', err);
  }
}
 
// ─── Tabla del tablero ────────────────────────────────────────────────────────
 
function renderBoardTable() {
  const tbody = document.getElementById('board-tbody');
  if (!tbody) return;
 
  tbody.innerHTML = '';
 
  const { DAYS, TIMES } = _getConfig();
 
  TIMES.forEach((time) => {
    const tr = document.createElement('tr');
 
    const tdTime = document.createElement('td');
    tdTime.className   = 'board-time';
    tdTime.textContent = time;
    tr.appendChild(tdTime);
 
    DAYS.forEach((day) => {
      const td   = document.createElement('td');
      const slot = (state.slots[day] ?? []).find((s) => s.time === time);
 
      if (!slot || slot.status === 'free') {
        td.className = 'board-cell free';
        td.innerHTML = `<span class="board-status">Libre</span>`;
        if (state.authUser) {
          const btn = document.createElement('button');
          btn.type      = 'button';
          btn.className = 'btn-board-reserve';
          btn.textContent   = 'Reservar';
          btn.dataset.day  = day;
          btn.dataset.time = time;
          td.appendChild(btn);
        }
      } else {
        td.className = `board-cell ${slot.status}`;
        const names = (slot.reservations ?? [])
          .filter((r) => r.approvalStatus === 'approved')
          .map((r) => r.name)
          .join(', ');
        td.innerHTML = `<span class="board-names">${names || '—'}</span>`;
 
        const actions = document.createElement('div');
        actions.className = 'board-cell-actions';
 
        if (slot.status !== 'complete') {
          const btnR = document.createElement('button');
          btnR.type        = 'button';
          btnR.className   = 'btn-board-reserve';
          btnR.textContent = 'Reservar';
          btnR.dataset.day  = day;
          btnR.dataset.time = time;
          actions.appendChild(btnR);
        }
 
        const hasReport = state.reports.some((r) => r.slotId === slot.id);
        const btnRep    = document.createElement('button');
        btnRep.type        = 'button';
        btnRep.className   = 'btn-board-report';
        btnRep.textContent = hasReport ? '📋 Ver reporte' : '📋 Registrar';
        btnRep.dataset.day  = day;
        btnRep.dataset.time = time;
        actions.appendChild(btnRep);
 
        td.appendChild(actions);
      }
 
      tr.appendChild(td);
    });
 
    tbody.appendChild(tr);
  });
}
 
// ─── Sync selectores ─────────────────────────────────────────────────────────
 
function _syncPointSelector() {
  const sel = document.getElementById('select-point');
  if (!sel) return;
 
  const current = sel.value;
  renderSelectOptions(sel, [
    { value: '', label: 'Selecciona un punto…' },
    ...state.visiblePoints.map((p) => ({ value: p.id, label: p.name }))
  ]);
  sel.value = state.selectedPointId || current || '';
}
 
function _syncReserveFormSelects() {
  const { DAYS, TIMES } = _getConfig();
 
  const daySel  = document.getElementById('select-day');
  const timeSel = document.getElementById('select-time');
  const partSel = document.getElementById('sel-participant');
  const comp1   = document.getElementById('sel-companion1');
  const comp2   = document.getElementById('sel-companion2');
 
  if (daySel && !daySel.options.length) {
    renderSelectOptions(daySel, [
      { value: '', label: 'Día…' },
      ...DAYS.map((d) => ({ value: d, label: d }))
    ]);
  }
  if (timeSel && !timeSel.options.length) {
    renderSelectOptions(timeSel, [
      { value: '', label: 'Horario…' },
      ...TIMES.map((t) => ({ value: t, label: t }))
    ]);
  }
 
  const nameOpts = [
    { value: '', label: 'Selecciona participante…' },
    ...state.participants.map((p) => ({ value: p.name, label: p.name }))
  ];
  const compOpts = [
    { value: '', label: '(ninguno)' },
    ...state.participants.map((p) => ({ value: p.name, label: p.name }))
  ];
 
  if (partSel) renderSelectOptions(partSel, nameOpts);
  if (comp1)   renderSelectOptions(comp1, compOpts);
  if (comp2)   renderSelectOptions(comp2, compOpts);
 
  if (state.pendingReserveParticipantName && partSel) {
    partSel.value = state.pendingReserveParticipantName;
  }
}
 
function _syncSubadminPointSelect() {
  const sel = document.getElementById('subadmin-point');
  if (!sel) return;
  renderSelectOptions(sel, [
    { value: '', label: 'Punto…' },
    ...state.points.map((p) => ({ value: p.id, label: p.name }))
  ]);
}
 
// ─── Helper lazy config ───────────────────────────────────────────────────────
 
let _configCache = null;
function _getConfig() {
  if (!_configCache) {
    const c = /** @type {any} */ (window.__predicappConfig);
    _configCache = c ?? { DAYS: [], TIMES: [] };
  }
  return _configCache;
}
