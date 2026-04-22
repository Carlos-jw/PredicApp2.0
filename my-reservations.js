/**
 * my-reservations.js — Vista de reservas propias del usuario.
 */

import { DB } from './db.js';
import { state } from './state.js';
import { RESERVATION_APPROVAL } from './config.js';
import { toast } from './toast.js';

/**
 * Carga y renderiza la lista de reservas del usuario autenticado.
 */
export async function loadMyReservationsList() {
  const list = document.getElementById('my-reservations-list');
  if (!list) return;

  if (!state.authUser) {
    list.innerHTML = '<li class="list-empty">Inicia sesión para ver tus reservas.</li>';
    return;
  }

  list.innerHTML = '<li class="list-empty">Cargando…</li>';

  try {
    const reservations = await DB.getUserReservationsAcrossPoints(state.authUser.uid);

    list.innerHTML = '';

    if (!reservations.length) {
      list.innerHTML = '<li class="list-empty">No tienes reservas activas.</li>';
      return;
    }

    reservations.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'admin-list-item';

      const main  = document.createElement('div');
      main.className = 'admin-list-item__main';

      const label = document.createElement('span');
      label.textContent = `${r.day} ${r.time} · ${r.pointName}`;
      main.appendChild(label);

      li.appendChild(main);
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    toast('No se pudieron cargar tus reservas.', 'error');
    list.innerHTML = '<li class="list-empty">Error al cargar reservas.</li>';
  }
}
