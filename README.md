# PredicApp

Aplicación web PWA para gestión de turnos de predicación por punto.
Construida con HTML/JS vanilla + Firebase (Auth + Firestore) + Vercel.

---

## Stack

- **Frontend:** HTML5, CSS3, JavaScript ESModules (sin bundler)
- **Auth:** Firebase Authentication (Email/Password + Google)
- **DB:** Cloud Firestore con caché offline
- **Deploy:** Vercel (static hosting)
- **PWA:** Service Worker + Web App Manifest

---

## Variables de entorno

Copia `.env.example` como `.env` y rellena los valores de tu proyecto Firebase:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Los valores los encuentras en:
**Firebase Console → Configuración del proyecto → Tus aplicaciones → SDK snippet**

---

## Despliegue en Vercel

1. Importar repositorio en [vercel.com](https://vercel.com)
2. Framework Preset: **Other**
3. Build Command: *(vacío)*
4. Output Directory: `.`
5. Agregar las variables de entorno `VITE_FIREBASE_*` en Settings
6. Deploy

**Post-deploy:**
- Firebase Console → Authentication → Authorized domains → agregar dominio Vercel
- Firebase Console → Authentication → Sign-in method → activar Google y Email/Password
- Desplegar reglas Firestore: `firebase deploy --only firestore:rules`

---

## Estructura de roles

| Rol | Label | Permisos |
|---|---|---|
| `admin` | Super de servicio | Todo |
| `subadmin` | Capitán de punto | Su punto |
| `usuario` | Publicador | Lectura + reservar en su punto |

---

## Primer uso

1. Registrarse con correo → rol `usuario`, estado `pendiente`
2. Admin aprueba la cuenta en Panel Admin → Cuentas pendientes
3. Usuario ya puede reservar turnos

Para crear el primer admin: en Firestore Console, crear documento `users/{uid}` con `role: "admin"`.

---

## Reglas Firestore (mínimas recomendadas)

Este repo incluye `firestore.rules` con una base segura para:

- lectura pública de `points/*` y `points/*/data/participants` (necesaria para inscripción pública)
- escritura pública de `points/{pointId}/data/participants` (alta de participante sin login)
- administración total para `admin`
- gestión de su(s) punto(s) para `subadmin`
- acceso de cada usuario a su propio documento `users/{uid}`

### Desplegar reglas

```bash
firebase deploy --only firestore:rules
```

### Nota importante

Si prefieres restringir completamente la inscripción pública, mueve ese flujo a una Cloud Function
y elimina el permiso público de escritura en `points/{pointId}/data/participants`.
