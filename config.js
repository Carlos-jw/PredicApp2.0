/**
 * config.js — Constantes globales de la aplicación.
 */

export const DAYS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const TIMES = [
  '07:00-09:00',
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
  '19:00-21:00'
];

export const MAX_RESERVATIONS_PER_SLOT = 3;
export const MIN_RESERVATIONS_PER_SLOT = 2;

export const SLOT_STATUS = Object.freeze({
  FREE:     'free',
  PARTIAL:  'partial',
  READY:    'ready',
  COMPLETE: 'complete'
});

export const ROLES = Object.freeze({
  ADMIN:    'admin',
  SUBADMIN: 'subadmin',
  USER:     'usuario'
});

export const RESERVATION_APPROVAL = Object.freeze({
  APPROVED: 'approved',
  PENDING:  'pending',
  REJECTED: 'rejected'
});

const ROLE_LABELS = {
  [ROLES.ADMIN]:    'Super de servicio',
  [ROLES.SUBADMIN]: 'Capitán de punto',
  [ROLES.USER]:     'Publicador'
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? 'Participante';
}

export function normalizePointId(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
