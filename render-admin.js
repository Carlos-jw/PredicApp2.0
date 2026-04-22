/**
 * render-admin.js — Listas del panel de administración.
 */

import { ROLES } from './config.js';           // ← sin ?v=4.2
import { USER_STATUS } from './user-status.js'; // ← sin ?v=1
import { DB } from './db.js';
import { canManagePoints, canUseAppData, isAdmin, isSubadmin } from './permissions.js';
import { state } from './state.js';
import { confirm, toast } from './toast.js';

// ─── Lista de puntos ──────────────────────────────────────────────────────────

export function renderAdminLists() {
  const pointsList = document.getElementById('list-points');
  if (!pointsList) return;

  pointsList.innerHTML = '';

  if (!state.points.length) {
    const empty = document.createElement('li');
    empty.className  = 'list-empty';
    empty.textContent = 'Sin puntos.';
    pointsList.appendChild(empty);
    return;
  }

  state.points.forEach((point) => {
    const item  = document.createElement('li');
    item.className = 'admin-list-item';

    const label = document.createElement('span');
    label.textContent = point.name;
    const meta = document.createElement('small');
    meta.textContent = ` (${point.id})`;
    label.appendChild(meta);
    item.appendChild(label);

    if (canManagePoints(state.profile)) {
      const button = document.createElement('button');
      button.type       = 'button';
      button.className  = 'btn-delete-item';
      button.dataset.id = point.id;
      button.textContent = 'Eliminar';
      button.addEventListener('click', async () => {
        const ok = await confirm(`¿Eliminar el punto "${point.name}" y todos sus datos?`);
        if (!ok) return;
        try {
          await DB.deletePoint(point.id);
          toast('Punto eliminado.', 'success');
        } catch (error) {
          console.error(error);
          toast('No se pudo eliminar el punto.', 'error');
        }
      });
      item.appendChild(button);
    }

    pointsList.appendChild(item);
  });
}

// ─── Cuentas pendientes de acceso (admin ve adminApproved === false) ──────────

export function renderPendingApprovalAdminList() {
  const pend = document.getElementById('list-pending-approval');
  if (!pend || !canManagePoints(state.profile)) return;

  pend.innerHTML = '';
  const pending  = state.users.filter(
    (u) => u.adminApproved === false && u.role !== ROLES.ADMIN
  );

  if (!pending.length) {
    const li = document.createElement('li');
    li.className  = 'list-empty';
    li.textContent = 'No hay cuentas pendientes de aprobación.';
    pend.appendChild(li);
    return;
  }

  pending.forEach((u) => {
    const item = document.createElement('li');
    item.className = 'admin-list-item';

    const label = document.createElement('span');
    label.textContent = `${String(u.email ?? '').trim() || u.id} (${u.id})`;
    item.appendChild(label);

    const button = document.createElement('button');
    button.type       = 'button';
    button.className  = 'btn-primary';
    button.textContent = 'Aprobar acceso';
    button.addEventListener('click', async () => {
      try {
        const autoReserve = await DB.approveUserAndTryAutoReserve(u.id, {
          uid: state.authUser?.uid ?? '',
          role: state.profile?.role ?? ROLES.ADMIN,
          assignedPointIds: state.profile?.assignedPointIds ?? []
        });
        notifyApprovalOutcome(autoReserve);
      } catch (error) {
        console.error(error);
        toast('No se pudo aprobar.', 'error');
      }
    });
    item.appendChild(button);
    pend.appendChild(item);
  });
}

// ─── Publicadores pendientes de capitán ──────────────────────────────────────

function getPendingApprovalRows() {
  if (!state.profile) return [];
  if (isAdmin(state.profile))    return state.users.filter((u) => u.role === ROLES.USER && u.status === USER_STATUS.PENDIENTE);
  if (isSubadmin(state.profile)) return state.pendingUsersCaptain;
  return [];
}

export function renderPendingApprovalList() {
  const section = document.getElementById('captain-pending-approval');
  const list    = document.getElementById('captain-pending-users-list');
  if (!section || !list) return;

  const show = Boolean(
    state.authUser &&
    canUseAppData(state.profile) &&
    (isAdmin(state.profile) || isSubadmin(state.profile))
  );
  section.style.display = show ? '' : 'none';
  if (!show) return;

  const rows = getPendingApprovalRows();
  list.innerHTML = '';

  if (!rows.length) {
    const empty = document.createElement('li');
    empty.className  = 'list-empty';
    empty.textContent = 'No hay cuentas pendientes.';
    list.appendChild(empty);
    return;
  }

  rows.forEach((u) => {
    const item = document.createElement('li');
    item.className = 'admin-list-item';

    const main = document.createElement('div');
    main.className = 'admin-list-item__main';

    const label = document.createElement('span');
    label.textContent = `${String(u.displayName ?? '').trim() || '—'} · ${u.email || u.id}`;
    main.appendChild(label);

    const meta = document.createElement('span');
    meta.className       = 'view-muted';
    meta.style.fontSize  = '.8rem';
    const pids = Array.isArray(u.assignedPointIds) ? u.assignedPointIds.filter(Boolean).join(', ') : '';
    meta.textContent = pids ? `Puntos: ${pids}` : 'Sin punto asignado';
    main.appendChild(meta);
    item.appendChild(main);

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'btn-secondary';
    btn.textContent = 'Aprobar';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const autoReserve = await DB.approveUserAndTryAutoReserve(u.id, {
          uid: state.authUser?.uid ?? '',
          role: state.profile?.role ?? ROLES.ADMIN,
          assignedPointIds: state.profile?.assignedPointIds ?? []
        });
        notifyApprovalOutcome(autoReserve);
      } catch (error) {
        console.error(error);
        toast(error?.message || 'No se pudo aprobar.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
    item.appendChild(btn);
    list.appendChild(item);
  });
}

function notifyApprovalOutcome(result) {
  if (!result?.approved) {
    toast('No se pudo aprobar.', 'error');
    return;
  }

  if (result.autoReserved) {
    toast(
      `Usuario aprobado y reserva automática creada (${result.day} ${result.time}).`,
      'success'
    );
    return;
  }

  const reason = String(result.reason ?? '').trim();
  if (reason === 'no-assigned-point') {
    toast('Usuario aprobado. Falta punto asignado para reserva automática.', 'warning');
    return;
  }
  if (reason === 'participant-not-found') {
    toast('Usuario aprobado. No se encontró inscripción para reserva automática.', 'warning');
    return;
  }
  if (reason === 'preferred-slot-missing') {
    toast('Usuario aprobado. La inscripción no tiene día/hora preferidos válidos.', 'warning');
    return;
  }
  if (reason === 'already-has-slot') {
    toast('Usuario aprobado. Ya tenía una reserva en ese horario.', 'info');
    return;
  }
  if (reason === 'reservation-failed') {
    toast(
      `Usuario aprobado. Falló la reserva automática: ${result.error ?? 'turno no disponible'}.`,
      'warning'
    );
    return;
  }

  toast('Usuario aprobado.', 'success');
}
