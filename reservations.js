/**
 * reservations.js — Lógica de negocio de turnos.
 */

import { SLOT_STATUS, MIN_RESERVATIONS_PER_SLOT, MAX_RESERVATIONS_PER_SLOT, RESERVATION_APPROVAL } from './config.js';

/**
 * Calcula el estado del slot según las reservas confirmadas.
 */
export function computeStatus(slot) {
  const confirmed = (slot.reservations ?? []).filter(
    (r) => r.approvalStatus === RESERVATION_APPROVAL.APPROVED
  ).length;

  if (confirmed === 0)                        return SLOT_STATUS.FREE;
  if (confirmed >= MAX_RESERVATIONS_PER_SLOT) return SLOT_STATUS.COMPLETE;
  if (confirmed >= MIN_RESERVATIONS_PER_SLOT) return SLOT_STATUS.READY;
  return SLOT_STATUS.PARTIAL;
}

/**
 * Cuenta las personas confirmadas en un slot.
 */
export function countPeople(slot) {
  return (slot.reservations ?? []).filter(
    (r) => r.approvalStatus === RESERVATION_APPROVAL.APPROVED
  ).length;
}

/**
 * Devuelve los nombres de los participantes confirmados.
 * @param {object} slot
 * @param {boolean} [includePending] - Incluir nombres con estado pendiente.
 */
export function getPeopleNames(slot, includePending = false) {
  return (slot.reservations ?? [])
    .filter((r) =>
      r.approvalStatus === RESERVATION_APPROVAL.APPROVED ||
      (includePending && r.approvalStatus === RESERVATION_APPROVAL.PENDING)
    )
    .map((r) => r.name)
    .filter(Boolean);
}

/**
 * Limpia todas las reservas de un slot (vaciar turno).
 * Muta el objeto slot.
 */
export function cancelSlot(slot) {
  slot.reservations = [];
  slot.status       = SLOT_STATUS.FREE;
}

/**
 * Detecta si el usuario ya tiene una reserva en otro punto para el mismo día/hora.
 *
 * @param {Array}  existingReservations - De DB.getUserReservationsAcrossPoints
 * @param {string} day
 * @param {string} time
 * @param {string} targetPointId
 * @param {object} targetPointMeta - { pointName, subadminName }
 * @returns {{ status: 'ok'|'warn'|'blocked', conflictingSlot?, from?, to?, affectedReservations? }}
 */
export function detectConflict(existingReservations, day, time, targetPointId, targetPointMeta) {
  const sameSlot = existingReservations.filter(
    (r) => r.day === day && r.time === time
  );

  const samePoint  = sameSlot.filter((r) => r.pointId === targetPointId);
  const otherPoint = sameSlot.filter((r) => r.pointId !== targetPointId);

  // Ya tiene reserva en el mismo punto/slot: update silencioso
  if (samePoint.length) return { status: 'ok' };

  // Tiene reserva en otro punto para ese mismo horario
  if (otherPoint.length) {
    const conflict = otherPoint[0];

    // Si ya tiene reservas en ese otro punto para más días, solo avisar (warn)
    const otherPointAll = existingReservations.filter(
      (r) => r.pointId === conflict.pointId
    );

    if (otherPointAll.length > 1) {
      return {
        status:               'blocked',
        conflictingSlot:      conflict,
        affectedReservations: otherPointAll
      };
    }

    return {
      status: 'warn',
      conflictingSlot: conflict,
      from: {
        pointId:     conflict.pointId,
        pointName:   conflict.pointName,
        subadminName: ''
      },
      to: {
        pointId:     targetPointId,
        pointName:   targetPointMeta.pointName,
        subadminName: targetPointMeta.subadminName
      },
      affectedReservations: otherPointAll
    };
  }

  return { status: 'ok' };
}
