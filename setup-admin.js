/**
 * setup-admin.js — Panel de administración: crear puntos y asignar capitanes.
 */

import { ROLES, normalizePointId } from './config.js';
import { DB } from './db.js';
import { canManagePoints, canCreateSubadmin } from './permissions.js';
import { state } from './state.js';
import { setValue } from './dom-helpers.js';
import { promptInput, toast } from './toast.js';
import { isValidEmail } from './utils.js';

export function setupAdmin() {
  // ── Crear punto ──
  document.getElementById('btn-add-point')?.addEventListener('click', async () => {
    if (!canManagePoints(state.profile)) {
      toast('Solo el super de servicio puede crear puntos.', 'error'); return;
    }

    const pointNameInput = await promptInput('Nombre del nuevo punto:');
    const pointName = pointNameInput?.trim() ?? '';
    if (!pointName) return;

    const pointId = normalizePointId(pointName);
    if (state.points.some((p) => p.id === pointId)) {
      toast('Ese punto ya existe.', 'error'); return;
    }

    try {
      await DB.createPoint({
        pointId,
        name:      pointName.slice(0, 80),
        createdBy: state.authUser?.uid ?? ''
      });
      toast('Punto creado.', 'success');
    } catch (error) {
      console.error(error);
      if (error?.code === 'permission-denied') {
        toast(
          'Firestore denegó crear el punto: despliega las reglas (firebase deploy --only firestore:rules), '
          + 'confirma en users/{tuUid} el campo role exactamente "admin", y recarga sin caché (Ctrl+Shift+R).',
          'error',
          14000
        );
      } else {
        toast(String(error?.message ?? '').trim() || 'No se pudo crear el punto.', 'error');
      }
    }
  });

  // ── Asignar capitán ──
  document.getElementById('btn-create-subadmin')?.addEventListener('click', async () => {
    if (!canCreateSubadmin(state.profile)) {
      toast('Solo el super de servicio puede asignar capitanes.', 'error'); return;
    }

    const uidRaw         = document.getElementById('subadmin-uid')?.value.trim()   ?? '';
    const emailRaw       = document.getElementById('subadmin-email')?.value.trim() ?? '';
    const displayNameRaw = document.getElementById('subadmin-name')?.value.trim()  ?? '';
    const pointId        = document.getElementById('subadmin-point')?.value;

    if (!pointId) { toast('Elige el punto asignado al capitán.', 'error'); return; }
    if (!emailRaw) {
      toast('Ingresa el correo del capitán. El UID ya no es obligatorio.', 'error'); return;
    }
    if (!isValidEmail(emailRaw)) {
      toast('Ingresa un correo válido para el capitán.', 'error'); return;
    }

    const email = emailRaw.toLowerCase();
    const point = state.points.find((p) => p.id === pointId);
    const pointName = String(point?.name ?? pointId).trim() || pointId;
    let captain = state.users.find((u) =>
      String(u.email ?? '').trim().toLowerCase() === email
    ) ?? null;

    // Fallback por lectura directa, útil si la lista de users aún no llegó al estado.
    if (!captain) {
      try {
        captain = await DB.getUserByEmail(email);
      } catch (error) {
        console.error(error);
      }
    }

    // Flujo por correo: si no existe aún perfil de usuario, crear invitación.
    if (!captain && !uidRaw) {
      try {
        await DB.createCaptainInvite({
          email,
          displayName: displayNameRaw || email,
          pointId,
          pointName,
          createdBy: state.authUser?.uid ?? ''
        });
        setValue('subadmin-email', '');
        setValue('subadmin-name',  '');
        setValue('subadmin-point', '');
        toast(
          'Invitación de capitán creada. Cuando ese correo inicie sesión se asignará automáticamente al punto.',
          'success',
          9000
        );
      } catch (error) {
        console.error(error);
        toast('No se pudo crear la invitación del capitán.', 'error');
      }
      return;
    }

    const uid = captain?.id || uidRaw;
    if (!uid) {
      toast(
        'No existe un usuario registrado con ese correo. ' +
        'El capitán debe iniciar sesión al menos una vez para crear su perfil.',
        'error',
        9000
      );
      return;
    }

    const displayName = displayNameRaw || String(captain?.displayName ?? '').trim() || email;

    try {
      await DB.saveUserProfile(uid, {
        email,
        displayName,
        role:             ROLES.SUBADMIN,
        assignedPointIds: [pointId],
        adminApproved:    true
      });
      await DB.assignSubadminToPoint(pointId, { id: uid, displayName, email });

      setValue('subadmin-uid',   '');
      setValue('subadmin-email', '');
      setValue('subadmin-name',  '');
      toast('Capitán asignado al punto.', 'success');
    } catch (error) {
      console.error(error);
      toast('No se pudo asignar el capitán.', 'error');
    }
  });
}
