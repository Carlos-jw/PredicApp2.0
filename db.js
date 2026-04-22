/**
 * db.js — Capa de datos Firestore.
 * Exporta `DB` (objeto con todos los métodos de acceso a datos) y `auth`.
 */
 
import { firebaseApp, auth } from './auth.js';
import { ROLES, SLOT_STATUS, MIN_RESERVATIONS_PER_SLOT, MAX_RESERVATIONS_PER_SLOT, RESERVATION_APPROVAL } from './config.js';
import { USER_STATUS } from './user-status.js';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
 
export { auth };
 
// Inicializa Firestore con cache persistente multi-tab (API moderna de Firebase 10)
let db;
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  // Si ya fue inicializado (e.g. HMR), reusar la instancia existente
  db = getFirestore(firebaseApp);
}
 
// --- Helpers internos ---------------------------------------------------------
 
function dataRef(pointId, docId) {
  return doc(db, 'points', pointId, 'data', docId);
}
 
function isOfflineError(err) {
  return err?.code === 'unavailable' || err?.message?.includes('offline');
}
 
function offlineResult() {
  return { ok: true, offline: true };
}

function normalizeLoose(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function resolveAssignedPointId(profile) {
  const direct = String(profile?.assignedPointId ?? '').trim();
  if (direct) return direct;
  const first = Array.isArray(profile?.assignedPointIds)
    ? profile.assignedPointIds.find((id) => String(id ?? '').trim())
    : '';
  return String(first ?? '').trim();
}

function findPreferredParticipantForUser(participants, profile, uid) {
  const byUid = participants.find((p) => String(p.userId ?? '').trim() === uid);
  if (byUid) return byUid;

  const displayNameNorm = normalizeLoose(profile?.displayName);
  if (displayNameNorm) {
    const byDisplayName = participants.find(
      (p) => normalizeLoose(p.name) === displayNameNorm
    );
    if (byDisplayName) return byDisplayName;
  }

  const emailLocalNorm = normalizeLoose(String(profile?.email ?? '').split('@')[0]);
  if (emailLocalNorm) {
    const byEmailLocal = participants.find(
      (p) => normalizeLoose(p.name) === emailLocalNorm
    );
    if (byEmailLocal) return byEmailLocal;
  }

  return null;
}
 
// --- DB Object ----------------------------------------------------------------
 
export const DB = {
  // -- Perfil de usuario -------------------------------------------------------
 
  async ensureUserProfile(user) {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        role: ROLES.USER,
        adminApproved: false,
        status: USER_STATUS.PENDIENTE,
        assignedPointIds: [],
        createdAt: Date.now()
      });
    }
  },
 
  async saveUserProfile(uid, fields) {
    const ref = doc(db, 'users', uid);
    await setDoc(ref, { ...fields, updatedAt: Date.now() }, { merge: true });
  },
 
  subscribeUserProfile(uid, callback, onError) {
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      },
      (error) => {
        onError?.(error);
      }
    );
  },
 
  subscribeUsers(callback, onError) {
    return onSnapshot(
      collection(db, 'users'),
      (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        onError?.(error);
      }
    );
  },

  async getUserByEmail(email) {
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized) return null;

    const q = query(collection(db, 'users'), where('email', '==', normalized));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const first = snap.docs[0];
    return { id: first.id, ...first.data() };
  },

  async createCaptainInvite({ email, displayName, pointId, pointName, createdBy }) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Correo de capitán inválido.');
    }
    if (!pointId) {
      throw new Error('Punto de capitán inválido.');
    }

    await setDoc(doc(db, 'captainInvites', normalizedEmail), {
      email: normalizedEmail,
      displayName: String(displayName ?? '').trim(),
      pointId: String(pointId).trim(),
      pointName: String(pointName ?? pointId).trim(),
      createdBy: String(createdBy ?? '').trim(),
      createdAt: Date.now()
    });
  },

  async claimCaptainInvite(user) {
    const email = String(user?.email ?? '').trim().toLowerCase();
    if (!email) return { claimed: false, reason: 'no-email' };

    const inviteRef = doc(db, 'captainInvites', email);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) return { claimed: false, reason: 'no-invite' };

    const invite = inviteSnap.data() ?? {};
    const pointId = String(invite.pointId ?? '').trim();
    if (!pointId) return { claimed: false, reason: 'invite-without-point' };

    const pointSnap = await getDoc(doc(db, 'points', pointId));
    const pointName = pointSnap.exists()
      ? String(pointSnap.data().name ?? pointId).trim()
      : String(invite.pointName ?? pointId).trim();

    const displayName = String(invite.displayName ?? '').trim()
      || String(user?.displayName ?? '').trim()
      || email;

    await DB.saveUserProfile(user.uid, {
      email,
      displayName,
      role: ROLES.SUBADMIN,
      status: USER_STATUS.APROBADO,
      adminApproved: true,
      assignedPointId: pointId,
      assignedPointName: pointName,
      assignedPointIds: [pointId]
    });

    await deleteDoc(inviteRef);

    return { claimed: true, pointId, pointName, email };
  },
 
  async aprobarUsuario(uid) {
    await setDoc(
      doc(db, 'users', uid),
      { status: USER_STATUS.APROBADO, adminApproved: true, updatedAt: Date.now() },
      { merge: true }
    );
  },

  async approveUserAndTryAutoReserve(uid, actor = {}) {
    await DB.aprobarUsuario(uid);

    const profileSnap = await getDoc(doc(db, 'users', uid));
    if (!profileSnap.exists()) {
      return { approved: true, autoReserved: false, reason: 'user-not-found' };
    }

    const profile = profileSnap.data();
    const pointId = resolveAssignedPointId(profile);
    if (!pointId) {
      return { approved: true, autoReserved: false, reason: 'no-assigned-point' };
    }

    const participantsSnap = await getDoc(dataRef(pointId, 'participants'));
    const participants = participantsSnap.exists() ? (participantsSnap.data().items ?? []) : [];
    const participant = findPreferredParticipantForUser(participants, profile, uid);

    if (!participant) {
      return { approved: true, autoReserved: false, reason: 'participant-not-found' };
    }

    const preferredDay = String(participant.preferredDay ?? '').trim();
    const preferredTime = String(participant.preferredTime ?? '').trim();
    if (!preferredDay || !preferredTime) {
      return { approved: true, autoReserved: false, reason: 'preferred-slot-missing' };
    }

    const existing = await DB.getUserReservationsAcrossPoints(uid);
    const alreadyHasSameSlot = existing.some(
      (r) => r.day === preferredDay && r.time === preferredTime
    );
    if (alreadyHasSameSlot) {
      return { approved: true, autoReserved: false, reason: 'already-has-slot' };
    }

    const pointSnap = await getDoc(doc(db, 'points', pointId));
    const pointName = pointSnap.exists() ? (pointSnap.data().name ?? pointId) : pointId;
    const reservation = {
      userId: uid,
      name: String(participant.name ?? '').trim() || String(profile.displayName ?? '').trim() || String(profile.email ?? '').trim(),
      point: pointName,
      companions: []
    };

    const actorRole = String(actor.role ?? '').trim() || ROLES.ADMIN;
    const actorUid = String(actor.uid ?? '').trim() || uid;
    const actorAssigned = Array.isArray(actor.assignedPointIds) ? actor.assignedPointIds : [pointId];
    const saveResult = await DB.upsertReservation({
      pointId,
      day: preferredDay,
      time: preferredTime,
      reservation,
      actor: {
        uid: actorUid,
        role: actorRole,
        assignedPointIds: actorAssigned
      }
    });

    if (!saveResult?.ok) {
      return {
        approved: true,
        autoReserved: false,
        reason: 'reservation-failed',
        error: saveResult?.error ?? 'No se pudo crear la reserva automática.'
      };
    }

    return {
      approved: true,
      autoReserved: true,
      pointId,
      pointName,
      day: preferredDay,
      time: preferredTime,
      mode: saveResult.mode
    };
  },
 
  // -- Puntos ------------------------------------------------------------------
 
  subscribePoints(callback, onError) {
    return onSnapshot(
      collection(db, 'points'),
      (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        onError?.(error);
      }
    );
  },
 
  async listPointDocumentsPublic() {
    const snap = await getDocs(collection(db, 'points'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
 
  async createPoint({ pointId, name, createdBy }) {
    await setDoc(doc(db, 'points', pointId), {
      name,
      createdBy,
      createdAt: Date.now(),
      subadminId: '',
      subadminName: ''
    });
  },
 
  async deletePoint(pointId) {
    const batch = writeBatch(db);
    for (const docId of ['participants', 'slots', 'reports']) {
      batch.delete(dataRef(pointId, docId));
    }
    batch.delete(doc(db, 'points', pointId));
    await batch.commit();
  },
 
  async assignSubadminToPoint(pointId, { id, displayName, email }) {
    await setDoc(
      doc(db, 'points', pointId),
      { subadminId: id, subadminName: displayName || email || id, updatedAt: Date.now() },
      { merge: true }
    );
  },
 
  async bootstrapDefaults(uid) {
    const pSnap = await getDoc(dataRef('__bootstrap__', 'slots')).catch(() => null);
    if (pSnap) return;
    await setDoc(doc(db, 'users', uid), { role: ROLES.ADMIN }, { merge: true });
  },
 
  // -- Participantes -----------------------------------------------------------
 
  subscribeParticipants(pointId, callback, onError) {
    return onSnapshot(
      dataRef(pointId, 'participants'),
      (snap) => {
        const items = snap.exists() ? (snap.data().items ?? []) : [];
        callback(items);
      },
      (error) => {
        onError?.(error);
      }
    );
  },
 
  async setParticipants(pointId, participants) {
    try {
      await setDoc(dataRef(pointId, 'participants'), { items: participants, updatedAt: Date.now() });
      return { ok: true };
    } catch (err) {
      if (isOfflineError(err)) return offlineResult();
      return { ok: false, error: err.message };
    }
  },
 
  async addParticipant(pointId, { name, phone = '' }) {
    try {
      const ref = dataRef(pointId, 'participants');
      const snap = await getDoc(ref);
      const items = snap.exists() ? (snap.data().items ?? []) : [];
 
      const duplicate = items.some(
        (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) return { ok: false, error: 'Ese participante ya existe en este punto.' };
 
      const newParticipant = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(),
        phone: phone.trim()
      };
 
      await setDoc(ref, { items: [...items, newParticipant], updatedAt: Date.now() });
      return { ok: true };
    } catch (err) {
      if (isOfflineError(err)) return offlineResult();
      return { ok: false, error: err.message };
    }
  },
 
  async enrollParticipantPublic({ pointId, name, phone, preferredDay, preferredTime }) {
    const ref = dataRef(pointId, 'participants');
    const snap = await getDoc(ref);
    const items = snap.exists() ? (snap.data().items ?? []) : [];
 
    const alreadyExists = items.some(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (alreadyExists) return { alreadyExists: true };
 
    const newParticipant = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      phone: phone.trim(),
      preferredDay: preferredDay,
      preferredTime: preferredTime
    };
 
    await setDoc(ref, { items: [...items, newParticipant], updatedAt: Date.now() });
    return { ok: true, alreadyExists: false };
  },
 
  subscribeParticipantsDirectory(pointIds, pointsMap, callback, onError) {
    if (!pointIds.length) {
      callback([]);
      return () => {};
    }
 
    const unsubs = [];
    const results = {};
 
    pointIds.forEach((pointId) => {
      const unsub = onSnapshot(
        dataRef(pointId, 'participants'),
        (snap) => {
          const items = snap.exists() ? (snap.data().items ?? []) : [];
          results[pointId] = items.map((p) => ({
            ...p,
            pointId,
            pointName: pointsMap[pointId] ?? pointId
          }));
          const all = Object.values(results).flat();
          all.sort((a, b) => a.name.localeCompare(b.name, 'es'));
          callback(all);
        },
        (error) => {
          onError?.(error);
        }
      );
      unsubs.push(unsub);
    });
 
    return () => unsubs.forEach((u) => u());
  },
 
  // -- Slots -------------------------------------------------------------------
 
  subscribeSlots(pointId, callback, onError) {
    return onSnapshot(
      dataRef(pointId, 'slots'),
      (snap) => {
        const items = snap.exists() ? (snap.data().items ?? {}) : {};
        callback(items);
      },
      (error) => {
        onError?.(error);
      }
    );
  },
 
  async setSlots(pointId, slots) {
    try {
      await setDoc(dataRef(pointId, 'slots'), { items: slots, updatedAt: Date.now() });
      return { ok: true };
    } catch (err) {
      if (isOfflineError(err)) return offlineResult();
      return { ok: false, error: err.message };
    }
  },
 
  async upsertReservation({ pointId, day, time, reservation, actor }) {
    try {
      const ref = dataRef(pointId, 'slots');
      const snap = await getDoc(ref);
      const items = snap.exists() ? (snap.data().items ?? {}) : {};
 
      const daySlots = items[day] ?? [];
      let slot = daySlots.find((s) => s.time === time);
      let mode = 'created';
 
      if (!slot) {
        slot = { id: `${day}-${time}`, time, day, reservations: [], status: SLOT_STATUS.FREE };
        daySlots.push(slot);
        items[day] = daySlots;
      }
 
      const existingIndex = slot.reservations.findIndex((r) => r.userId === reservation.userId);
 
      const needsApproval =
        actor.role === ROLES.USER &&
        !actor.assignedPointIds?.includes(pointId);
 
      const approvalStatus =
        (actor.role === ROLES.ADMIN || actor.role === ROLES.SUBADMIN || !needsApproval)
          ? RESERVATION_APPROVAL.APPROVED
          : RESERVATION_APPROVAL.PENDING;
 
      const entry = { ...reservation, approvalStatus, savedAt: Date.now() };
 
      if (existingIndex >= 0) {
        slot.reservations[existingIndex] = entry;
        mode = 'updated';
      } else {
        const confirmed = slot.reservations.filter(
          (r) => r.approvalStatus !== RESERVATION_APPROVAL.REJECTED
        );
        if (confirmed.length >= MAX_RESERVATIONS_PER_SLOT) {
          return { ok: false, error: 'El turno ya esta completo.' };
        }
        slot.reservations.push(entry);
      }
 
      slot.status = computeSlotStatus(slot);
 
      await setDoc(ref, { items, updatedAt: Date.now() });
      return { ok: true, mode };
    } catch (err) {
      if (isOfflineError(err)) return offlineResult();
      return { ok: false, error: err.message };
    }
  },
 
  async cancelOwnReservation({ pointId, day, time, actor }) {
    try {
      const ref = dataRef(pointId, 'slots');
      const snap = await getDoc(ref);
      if (!snap.exists()) return { ok: false, error: 'No se encontro el slot.' };
 
      const items = snap.data().items ?? {};
      const daySlots = items[day] ?? [];
      const slot = daySlots.find((s) => s.time === time);
      if (!slot) return { ok: false, error: 'No se encontro el turno.' };
 
      const before = slot.reservations.length;
      slot.reservations = slot.reservations.filter((r) => r.userId !== actor.uid);
 
      if (slot.reservations.length === before) {
        return { ok: false, error: 'No tienes reserva en este turno.' };
      }
 
      slot.status = computeSlotStatus(slot);
      await setDoc(ref, { items, updatedAt: Date.now() });
      return { ok: true };
    } catch (err) {
      if (isOfflineError(err)) return offlineResult();
      return { ok: false, error: err.message };
    }
  },
 
  async setReservationRequestDecision({ pointId, day, time, targetUserId, approve, actor }) {
    try {
      const ref = dataRef(pointId, 'slots');
      const snap = await getDoc(ref);
      if (!snap.exists()) return { ok: false, error: 'No existe el slot.' };
 
      const items = snap.data().items ?? {};
      const daySlots = items[day] ?? [];
      const slot = daySlots.find((s) => s.time === time);
      if (!slot) return { ok: false, error: 'Turno no encontrado.' };
 
      const r = slot.reservations.find((res) => res.userId === targetUserId);
      if (!r) return { ok: false, error: 'Solicitud no encontrada.' };
 
      r.approvalStatus = approve ? RESERVATION_APPROVAL.APPROVED : RESERVATION_APPROVAL.REJECTED;
      slot.status = computeSlotStatus(slot);
 
      await setDoc(ref, { items, updatedAt: Date.now() });
      return { ok: true };
    } catch (err) {
      if (isOfflineError(err)) return offlineResult();
      return { ok: false, error: err.message };
    }
  },
 
  async getUserReservationsAcrossPoints(uid) {
    const pointsSnap = await getDocs(collection(db, 'points'));
    const results = [];
 
    await Promise.all(
      pointsSnap.docs.map(async (pointDoc) => {
        const pointId = pointDoc.id;
        const pointName = pointDoc.data().name ?? pointId;
        try {
          const snap = await getDoc(dataRef(pointId, 'slots'));
          const items = snap.exists() ? (snap.data().items ?? {}) : {};
          Object.entries(items).forEach(([day, slots]) => {
            (slots ?? []).forEach((slot) => {
              const r = slot.reservations?.find(
                (res) => res.userId === uid && res.approvalStatus !== RESERVATION_APPROVAL.REJECTED
              );
              if (r) results.push({ pointId, pointName, day, time: slot.time, slotId: slot.id });
            });
          });
        } catch {
          // Ignorar puntos sin acceso
        }
      })
    );
 
    return results;
  },
 
  async reassignUserToPoint(uid, newPointId, { day, time, name, point, companions, userId }) {
    try {
      const existing = await DB.getUserReservationsAcrossPoints(uid);
 
      for (const r of existing) {
        if (r.pointId === newPointId) continue;
        await DB.cancelOwnReservation({
          pointId: r.pointId,
          day: r.day,
          time: r.time,
          actor: { uid }
        });
      }
 
      const pointSnap = await getDoc(doc(db, 'points', newPointId));
      const pointData = pointSnap.exists() ? pointSnap.data() : {};
      await DB.saveUserProfile(uid, {
        assignedPointId: newPointId,
        assignedPointName: pointData.name ?? newPointId,
        assignedSubadminId: pointData.subadminId ?? '',
        assignedSubadminName: pointData.subadminName ?? '',
        assignedPointIds: [newPointId]
      });
 
      const result = await DB.upsertReservation({
        pointId: newPointId,
        day,
        time,
        reservation: { userId, name, point, companions },
        actor: { uid, role: ROLES.USER, assignedPointIds: [newPointId] }
      });
 
      return { ...result, removedReservations: existing.filter((r) => r.pointId !== newPointId).length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
 
  // -- Reportes ----------------------------------------------------------------
 
  subscribeReports(pointId, callback, onError) {
    return onSnapshot(
      dataRef(pointId, 'reports'),
      (snap) => {
        const items = snap.exists() ? (snap.data().items ?? []) : [];
        callback(items);
      },
      (error) => {
        onError?.(error);
      }
    );
  },
 
  async setReports(pointId, reports) {
    try {
      await setDoc(dataRef(pointId, 'reports'), { items: reports, updatedAt: Date.now() });
      return { ok: true };
    } catch (err) {
      if (isOfflineError(err)) return offlineResult();
      return { ok: false, error: err.message };
    }
  },
 
  // -- Usuarios pendientes (capitan) ------------------------------------------
 
  subscribePendingUsersForCaptain(pointId, callback, onError) {
    const q = query(
      collection(db, 'users'),
      where('status', '==', USER_STATUS.PENDIENTE),
      where('role', '==', ROLES.USER)
    );
    return onSnapshot(
      q,
      (snap) => {
        const users = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => (u.assignedPointIds ?? []).includes(pointId));
        callback(users);
      },
      (error) => {
        onError?.(error);
      }
    );
  }
};
 
// --- Helper local: calcular status del slot -----------------------------------
 
function computeSlotStatus(slot) {
  const confirmed = (slot.reservations ?? []).filter(
    (r) => r.approvalStatus === RESERVATION_APPROVAL.APPROVED
  ).length;
 
  if (confirmed === 0) return SLOT_STATUS.FREE;
  if (confirmed === 1) return SLOT_STATUS.PARTIAL;
  if (confirmed >= MAX_RESERVATIONS_PER_SLOT) return SLOT_STATUS.COMPLETE;
  if (confirmed >= MIN_RESERVATIONS_PER_SLOT) return SLOT_STATUS.READY;
  return SLOT_STATUS.PARTIAL;
}
