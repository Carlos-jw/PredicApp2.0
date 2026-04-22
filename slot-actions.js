/**
 * slot-actions.js — Acciones sobre slots del tablero:
 * vaciar, editar (eliminar reserva), aprobar y rechazar solicitudes.
 */

import { DB } from './db.js';
import { canManageReservation, canManageSlots } from './permissions.js';
import { cancelSlot, computeStatus } from './reservations.js';
import { render } from './render-queue.js';
import { state } from './state.js';
import { normalizeName } from './utils.js';
import { confirm, promptInput, toast } from './toast.js';

// ─── Vaciar turno ─────────────────────────────────────────────────────────────

export async function emptySlot(day, slot) {
  if (!canManageSlots(state.profile, state.selectedPointId)) {
    toast('No puedes editar turnos de este punto.', 'error'); return;
  }

  const ok = await confirm(`Vaciar turno ${day} ${slot.time}?`);
  if (!ok) return;

  const target = state.slots[day]?.find((item) => item.id === slot.id);
  if (!target) return;

  const slotsBefore = structuredClone(state.slots);
  cancelSlot(target);

  try {
    const result = await DB.setSlots(state.selectedPointId, state.slots);
    if (!result.ok) {
      state.slots = slotsBefore;
      toast('No se pudo vaciar el turno.', 'error'); return;
    }
    toast('Turno vaciado.', result.offline ? 'warning' : 'success');
  } catch (error) {
    console.error(error);
    state.slots = slotsBefore;
    toast('No se pudo vaciar el turno.', 'error');
  }
}

// ─── Editar / cancelar reserva individual ────────────────────────────────────

export async function editSlot(day, slot) {
  const canManageSelectedPoint = canManageSlots(state.profile, state.selectedPointId);
  const ownReservation = slot.reservations.find((r) =>
    canManageReservation(state.profile, state.selectedPointId, r, state.authUser)
  );

  if (!canManageSelectedPoint && !ownReservation) {
    toast('No puedes editar turnos de este punto.', 'error'); return;
  }

  // Publicador: solo puede cancelar su propia reserva
  if (!canManageSelectedPoint) {
    const ok = await confirm(`Cancelar tu reserva de ${day} ${slot.time}?`);
    if (!ok) return;

    const result = await DB.cancelOwnReservation({
      pointId: state.selectedPointId,
      day,
      time:  slot.time,
      actor: { uid: state.authUser?.uid ?? '' }
    });

    if (!result.ok) {
      toast(result.error ?? 'No se pudo cancelar la reserva.', 'error'); return;
    }
    toast('Tu reserva fue cancelada.', result.offline ? 'warning' : 'success');
    return;
  }

  // Capitán / admin: elimina reserva por nombre
  const names = slot.reservations.map((r) => r.name).filter(Boolean);
  if (!names.length) return;

  const target = state.slots[day]?.find((item) => item.id === slot.id);
  if (!target) return;

  const selectedName = await promptInput(
    `Reserva actual: ${names.join(', ')}. Escribe el nombre principal a eliminar:`
  );
  if (!selectedName) return;

  const targetName = normalizeName(selectedName);
  const matchingIndices = target.reservations
    .map((r, index) => ({ index, r }))
    .filter(({ r }) => normalizeName(r.name) === targetName)
    .map(({ index }) => index);

  if (!matchingIndices.length) {
    toast('No se encontro esa reserva principal.', 'error'); return;
  }

  // Desambiguar si hay varios con el mismo nombre
  let reservationIndex = matchingIndices[0];
  if (matchingIndices.length > 1) {
    const lines = matchingIndices.map((idx, k) => {
      const r   = target.reservations[idx];
      const uid = String(r.userId ?? '').trim();
      const hint = uid ? ` · id ${uid.slice(0, 8)}…` : '';
      return `${k + 1}) ${r.name}${hint}`;
    });
    const pick = await promptInput(
      `Hay varias reservas con ese nombre. Escribe el numero (1-${matchingIndices.length}):\n${lines.join('\n')}`
    );
    const n = Number.parseInt(String(pick ?? '').trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > matchingIndices.length) {
      toast('Numero invalido.', 'error'); return;
    }
    reservationIndex = matchingIndices[n - 1];
  }

  const slotsBefore = structuredClone(state.slots);
  const targetMut   = state.slots[day]?.find((item) => item.id === slot.id);
  if (!targetMut) return;

  targetMut.reservations.splice(reservationIndex, 1);
  targetMut.status = computeStatus(targetMut);

  try {
    const result = await DB.setSlots(state.selectedPointId, state.slots);
    if (!result.ok) {
      state.slots = slotsBefore;
      toast('No se pudo eliminar la reserva.', 'error'); return;
    }
    toast('Reserva eliminada.', result.offline ? 'warning' : 'success');
  } catch (error) {
    console.error(error);
    state.slots = slotsBefore;
    toast('No se pudo eliminar la reserva.', 'error');
  }
}

// ─── Aprobar / rechazar solicitud de turno ────────────────────────────────────

export async function handleApproveReservationRequest(day, slot, targetUserId) {
  if (!state.authUser || !canManageSlots(state.profile, state.selectedPointId)) return;

  const result = await DB.setReservationRequestDecision({
    pointId:      state.selectedPointId,
    day,
    time:         slot.time,
    targetUserId,
    approve:      true,
    actor: {
      uid:              state.authUser.uid,
      role:             state.profile?.role,
      assignedPointIds: state.profile?.assignedPointIds ?? []
    }
  });

  if (!result.ok) { toast(result.error ?? 'No se pudo aprobar.', 'error'); return; }
  toast('Solicitud aprobada; ya figura en el tablero.', result.offline ? 'warning' : 'success');
  render();
}

export async function handleRejectReservationRequest(day, slot, targetUserId) {
  if (!state.authUser || !canManageSlots(state.profile, state.selectedPointId)) return;

  const ok = await confirm('Rechazar esta solicitud de turno?');
  if (!ok) return;

  const result = await DB.setReservationRequestDecision({
    pointId:      state.selectedPointId,
    day,
    time:         slot.time,
    targetUserId,
    approve:      false,
    actor: {
      uid:              state.authUser.uid,
      role:             state.profile?.role,
      assignedPointIds: state.profile?.assignedPointIds ?? []
    }
  });

  if (!result.ok) { toast(result.error ?? 'No se pudo rechazar.', 'error'); return; }
  toast('Solicitud rechazada.', result.offline ? 'warning' : 'success');
  render();
}
