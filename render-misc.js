/**
 * render-misc.js — Funciones de render misceláneas.
 */

import { getRoleLabel, ROLES } from './config.js';   // ← sin ?v=4.2
import { canEditParticipants, canUseAppData, isAdmin, isSubadmin, isPendingUserApproval } from './permissions.js';
import { state } from './state.js';
import { setText } from './dom-helpers.js';

// ─── Estadísticas en el header ────────────────────────────────────────────────

export function updateStats() {
  let partial  = 0;
  let complete = 0;

  Object.values(state.slots).forEach((daySlots) => {
    daySlots?.forEach((slot) => {
      if (slot.status === 'partial' || slot.status === 'ready') partial  += 1;
      if (slot.status === 'complete')                           complete += 1;
    });
  });

  setText('count-part',  String(state.participants.length));
  setText('count-point', String(state.visiblePoints.length));
  setText('count-parti', String(partial));
  setText('count-comp',  String(complete));
}

// ─── Badges de sesión y rol ───────────────────────────────────────────────────

export function syncAccessBadges() {
  const roleBadge    = document.getElementById('role-badge');
  const emailBadge   = document.getElementById('session-email');
  const logoutButton = document.getElementById('btn-logout');
  const authButton   = document.getElementById('btn-open-auth');

  if (roleBadge) {
    if (!state.authUser) {
      roleBadge.textContent = 'Participante';
    } else if (isAdmin(state.profile)) {
      roleBadge.textContent = getRoleLabel(ROLES.ADMIN);
    } else if (isSubadmin(state.profile)) {
      roleBadge.textContent = getRoleLabel(ROLES.SUBADMIN);
    } else {
      roleBadge.textContent = getRoleLabel(ROLES.USER);
    }
  }

  if (emailBadge)   emailBadge.textContent    = state.authUser?.email ?? 'Sin sesión';
  if (logoutButton) logoutButton.style.display = state.authUser ? '' : 'none';
  if (authButton)   authButton.textContent     = state.authUser ? 'Cuenta' : 'Entrar';
}

// ─── Banner de acceso pendiente ───────────────────────────────────────────────

export function syncAccessGateBanner() {
  const el = document.getElementById('access-gate-banner');
  if (!el) return;

  if (!state.authUser || isAdmin(state.profile)) {
    el.style.display = 'none';
    el.textContent   = '';
    return;
  }

  if (state.profile?.adminApproved === false) {
    el.style.display = '';
    el.textContent   =
      'Tu cuenta está pendiente de activación por el super de servicio. Cuando te active, podrás usar tablero, reservas y participantes.';
    return;
  }

  el.style.display = 'none';
  el.textContent   = '';
}

// ─── Paneles de inicio ────────────────────────────────────────────────────────

function profileNeedsAssignedPoint(profile) {
  if (!profile) return false;
  const id = String(profile.assignedPointId ?? '').trim();
  if (id) return false;
  const ids = profile.assignedPointIds;
  if (Array.isArray(ids) && ids.some((x) => String(x ?? '').trim() !== '')) return false;
  return true;
}

export function syncHomePendingPanels() {
  const wait  = document.getElementById('home-pending-wait');
  const main  = document.getElementById('home-main-content');
  const guest = document.getElementById('guest-enroll-panel');
  if (!wait || !main) return;

  const usuarioPendiente = Boolean(
    state.authUser && state.profile && isPendingUserApproval(state.profile)
  );

  if (guest) guest.style.display = state.authUser ? 'none' : '';

  const needsPoint              = Boolean(state.profile && profileNeedsAssignedPoint(state.profile));
  const canShowMainWhilePending = Boolean(usuarioPendiente && needsPoint);

  if (usuarioPendiente) {
    wait.style.display = '';
    main.style.display = canShowMainWhilePending ? '' : 'none';
    const sub = document.getElementById('logged-pick-point-subtitle');
    if (sub) {
      sub.textContent = needsPoint
        ? 'Selecciona el punto donde participas para que el capitán pueda aprobarte.'
        : 'Tu cuenta está en espera de aprobación del capitán.';
    }
  } else {
    wait.style.display = 'none';
    main.style.display = '';
  }
}

// ─── Hint de permisos de participantes ───────────────────────────────────────

export function renderPermissionHints() {
  const hint = document.getElementById('participants-permission-hint');
  if (hint) {
    hint.textContent = canEditParticipants(state.profile, state.selectedPointId)
      ? 'Puedes agregar y eliminar participantes del punto seleccionado.'
      : 'Modo lectura: los publicadores no pueden agregar participantes.';
  }
}
