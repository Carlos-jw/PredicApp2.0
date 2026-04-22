/**
 * service-worker.js — Registro del Service Worker con limpieza automática
 * de caché cuando cambia el build tag del HTML.
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const buildTag  = document.body?.dataset?.build || 'predicapp-v16';
      const key       = 'predicapp-build-tag';
      const prevBuild = localStorage.getItem(key);

      // Al cambiar de build, desregistrar el SW y limpiar los caches
      // para evitar mezcla de assets de versiones distintas.
      if (prevBuild && prevBuild !== buildTag) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));

        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((k) => k.startsWith('predicapp-'))
              .map((k) => caches.delete(k))
          );
        }

        localStorage.setItem(key, buildTag);
        window.location.reload();
        return;
      }

      localStorage.setItem(key, buildTag);
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      });
      await registration.update();
    } catch (error) {
      console.warn('No se pudo registrar el service worker.', error);
    }
  });
}
