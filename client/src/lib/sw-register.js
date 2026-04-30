/**
 * Service Worker Registration and Sync Management
 * 
 * Handles:
 * - Service worker registration
 * - Periodic background sync registration
 * - Manual sync triggering
 * - Sync status checking
 * 
 * This module provides the client-side interface to the sw-sync.js service worker.
 */

const SW_SYNC_PATH = '/sw-sync.js';

/**
 * Registers the background sync service worker
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW-Register] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_SYNC_PATH, {
      scope: '/'
    });

    console.log('[SW-Register] Service worker registered:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW-Register] New service worker available');
            // Notify user or auto-update
            if (confirm('A new version is available. Reload to update?')) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[SW-Register] Registration failed:', error);
    return null;
  }
}

/**
 * Registers for periodic background sync
 * @param {ServiceWorkerRegistration} registration
 * @returns {Promise<boolean>}
 */
export async function registerPeriodicSync(registration) {
  if (!registration) {
    console.warn('[SW-Register] No registration provided');
    return false;
  }

  // Try periodic sync first (Chrome)
  if ('periodicSync' in registration) {
    try {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync',
      });

      if (status.state === 'granted') {
        await registration.periodicSync.register('hospital-data-sync', {
          minInterval: 6 * 60 * 60 * 1000, // 6 hours in ms
        });
        console.log('[SW-Register] Periodic sync registered');
        return true;
      } else if (status.state === 'prompt') {
        // Request permission
        await registration.periodicSync.register('hospital-data-sync', {
          minInterval: 6 * 60 * 60 * 1000,
        });
        console.log('[SW-Register] Periodic sync registered (prompted)');
        return true;
      }
    } catch (error) {
      console.log('[SW-Register] Periodic sync not available:', error);
    }
  }

  // Fall back to one-time background sync
  if ('sync' in registration) {
    try {
      await registration.sync.register('hospital-data-sync');
      console.log('[SW-Register] Background sync registered (fallback)');
      return true;
    } catch (error) {
      console.log('[SW-Register] Background sync not available:', error);
    }
  }

  console.log('[SW-Register] No background sync available, will sync on app open');
  return false;
}

/**
 * Triggers an immediate sync of hospital data
 * @returns {Promise<{success: boolean, updated?: boolean, count?: number, error?: string}>}
 */
export async function triggerSync() {
  if (!navigator.serviceWorker.controller) {
    console.warn('[SW-Register] No service worker controller');
    return { success: false, error: 'no_service_worker' };
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      resolve(event.data);
    };
    
    navigator.serviceWorker.controller.postMessage(
      { type: 'PERFORM_SYNC' },
      [channel.port2]
    );
  });
}

/**
 * Gets the current sync status
 * @returns {Promise<{version: number|null, timestamp: number|null, count: number, isStale: boolean}>}
 */
export async function getSyncStatus() {
  if (!navigator.serviceWorker.controller) {
    console.warn('[SW-Register] No service worker controller');
    return { version: null, timestamp: null, count: 0, isStale: true };
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      resolve(event.data);
    };
    
    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_SYNC_STATUS' },
      [channel.port2]
    );
  });
}

/**
 * Initializes the service worker and sync on app startup
 * Should be called from the main app component
 * @param {Object} options
 * @param {boolean} options.autoSync - Whether to trigger sync on startup (default: true)
 * @param {boolean} options.registerPeriodic - Whether to register periodic sync (default: true)
 * @returns {Promise<{registration: ServiceWorkerRegistration|null, syncEnabled: boolean}>}
 */
export async function initializeSync(options = {}) {
  const { autoSync = true, registerPeriodic = true } = options;

  console.log('[SW-Register] Initializing sync...');

  // Register service worker
  const registration = await registerServiceWorker();
  
  if (!registration) {
    console.warn('[SW-Register] Service worker not available');
    return { registration: null, syncEnabled: false };
  }

  let syncEnabled = false;

  // Register for periodic/background sync
  if (registerPeriodic) {
    syncEnabled = await registerPeriodicSync(registration);
  }

  // Trigger initial sync if enabled
  if (autoSync && !syncEnabled) {
    // If no background sync, do a manual sync on app open
    console.log('[SW-Register] Triggering manual sync on app open');
    const result = await triggerSync();
    console.log('[SW-Register] Manual sync result:', result);
  }

  // Listen for online events to trigger sync
  window.addEventListener('online', () => {
    console.log('[SW-Register] Network restored, triggering sync');
    triggerSync();
  });

  return { registration, syncEnabled };
}

/**
 * Gets hospital data from IndexedDB via service worker
 * This is used by the routing module as a fallback
 * @returns {Promise<Array|null>}
 */
export async function getHospitalsFromCache() {
  const status = await getSyncStatus();
  
  if (status.count > 0) {
    // Data is available in IndexedDB
    // The actual data retrieval happens through the service worker's cached response
    const response = await fetch('/hospitals.json');
    if (response.ok) {
      return response.json();
    }
  }
  
  return null;
}

export default {
  registerServiceWorker,
  registerPeriodicSync,
  triggerSync,
  getSyncStatus,
  initializeSync,
  getHospitalsFromCache
};