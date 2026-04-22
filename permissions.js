/**
 * permissions.js — Lógica de permisos por rol.
 * Todas las funciones son puras (no acceden al estado directamente).
 */

import { ROLES, RESERVATION_APPROVAL } from './config.js';
import { USER_STATUS } from './user-status.js';

export function isAdmin(profile) {
  return profile?.role === ROLES.ADMIN;
}

export function isSubadmin(profile) {
  return profile?.role === ROLES.SUBADMIN;
}

export function isUser(profile) {
  return profile?.role === ROLES.USER;
}

/**
 * El usuario puede usar los datos de la app:
 * admin, subadmin, o publicador con status aprobado y adminApproved no false.
 */
export function canUseAppData(profile) {
  if (!profile) return false;
  if (isAdmin(profile) || isSubadmin(profile)) return true;
  const notPending  = profile.status !== USER_STATUS.PENDIENTE;
  const notBlocked  = profile.adminApproved !== false;
  return notPending && notBlocked;
}

/**
 * El perfil está en espera de aprobación del admin.
 */
export function isPendingUserApproval(profile) {
  if (!profile) return false;
  if (isAdmin(profile) || isSubadmin(profile)) return false;
  return profile.status === USER_STATUS.PENDIENTE || profile.adminApproved === false;
}

/**
 * Puede gestionar puntos (crear/eliminar): solo admin.
 */
export function canManagePoints(profile) {
  return isAdmin(profile);
}

/**
 * Puede crear subadmins (capitanes): solo admin.
 */
export function canCreateSubadmin(profile) {
  return isAdmin(profile);
}

/**
 * Puede gestionar slots de un punto concreto:
 * admin → todos; subadmin → solo su punto asignado.
 */
export function canManageSlots(profile, pointId) {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  if (isSubadmin(profile)) {
    return (profile.assignedPointIds ?? []).includes(pointId);
  }
  return false;
}

/**
 * El usuario tiene acceso (asignado) a un punto.
 */
export function hasPointAccess(profile, pointId) {
  if (!profile || !pointId) return false;
  if (isAdmin(profile)) return true;
  return (profile.assignedPointIds ?? []).includes(pointId);
}

/**
 * Puede editar participantes del punto: admin o capitán del punto.
 */
export function canEditParticipants(profile, pointId) {
  return canManageSlots(profile, pointId);
}

/**
 * Puede gestionar una reserva individual:
 * admin, capitán del punto, o el propio usuario dueño de la reserva.
 */
export function canManageReservation(profile, pointId, reservation, authUser) {
  if (canManageSlots(profile, pointId)) return true;
  return reservation?.userId === authUser?.uid;
}
