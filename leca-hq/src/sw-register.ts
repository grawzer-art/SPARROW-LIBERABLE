/** Enregistre le service worker (hors ligne) en production uniquement. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* hors ligne non disponible : l'appli reste utilisable en ligne */
    });
  });
}
