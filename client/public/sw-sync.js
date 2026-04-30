/**
 * Background Sync Service Worker for FAST Check PWA
 * 
 * Handles:
 * - Periodic background sync for hospital data
 * - IndexedDB storage with version checking
 * - Offline caching for app shell and hospital data
 * - Service worker lifecycle management
 * 
 * Note: This runs in a separate global context and cannot import ES modules.
 * All necessary code is inlined.
 */

// ============================================
// Constants
// ============================================

const CACHE_NAME = 'fastcheck-v1';
const HOSPITALS_CACHE_NAME = 'hospitals-data-v1';
const API_CACHE_NAME = 'fastcheck-api-v1';

const HOSPITALS_DB_NAME = 'fastcheck-hospitals';
const HOSPITALS_STORE_NAME = 'data';
const HOSPITALS_VERSION_KEY = 'version';
const HOSPITALS_DATA_KEY = 'hospitals';
const HOSPITALS_TIMESTAMP_KEY = 'timestamp';

const SYNC_TAG = 'hospital-data-sync';
const MIN_SYNC_INTERVAL_HOURS = 6;

// API endpoints
const HOSPITALS_API_ENDPOINT = '/api/hospitals/data';
const HOSPITALS_VERSION_ENDPOINT = '/api/hospitals/version';
const HOSPITALS_FALLBACK = '/hospitals.json';

// ============================================
// IndexedDB Helper Functions
// ============================================

/**
 * Opens the IndexedDB database for hospital data
 */
function openHospitalsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HOSPITALS_DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(HOSPITALS_STORE_NAME)) {
        db.createObjectStore(HOSPITALS_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Stores hospital data in IndexedDB with version metadata
 */
async function storeHospitalsData(hospitals, version, timestamp) {
  const db = await openHospitalsDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HOSPITALS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(HOSPITALS_STORE_NAME);
    
    // Clear existing data and store new
    store.clear();
    
    // Store each hospital
    hospitals.forEach(hospital => {
      store.put(hospital);
    });
    
    // Store metadata
    store.put({ key: HOSPITALS_VERSION_KEY, value: version });
    store.put({ key: HOSPITALS_TIMESTAMP_KEY, value: timestamp });
    store.put({ key: HOSPITALS_DATA_KEY, value: hospitals });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Gets hospital data from IndexedDB
 */
async function getHospitalsFromDB() {
  const db = await openHospitalsDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HOSPITALS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(HOSPITALS_STORE_NAME);
    const request = store.get(HOSPITALS_DATA_KEY);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets version metadata from IndexedDB
 */
async function getHospitalVersionFromDB() {
  const db = await openHospitalsDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HOSPITALS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(HOSPITALS_STORE_NAME);
    const request = store.get(HOSPITALS_VERSION_KEY);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets timestamp metadata from IndexedDB
 */
async function getHospitalTimestampFromDB() {
  const db = await openHospitalsDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HOSPITALS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(HOSPITALS_STORE_NAME);
    const request = store.get(HOSPITALS_TIMESTAMP_KEY);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Checks if cached data is stale (older than MIN_SYNC_INTERVAL_HOURS)
 */
async function isDataStale() {
  const timestamp = await getHospitalTimestampFromDB();
  if (!timestamp) return true;
  
  const hoursSinceUpdate = (Date.now() - timestamp) / (1000 * 60 * 60);
  return hoursSinceUpdate >= MIN_SYNC_INTERVAL_HOURS;
}

// ============================================
// Fetch Functions
// ============================================

/**
 * Fetches hospital data from the server with ETag support
 */
async function fetchHospitalData(etag = null) {
  const headers = {};
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  
  const response = await fetch(HOSPITALS_API_ENDPOINT, { headers });
  
  if (response.status === 304) {
    // Not modified, return null to indicate no update needed
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch hospitals: ${response.status}`);
  }
  
  const data = await response.json();
  const newEtag = response.headers.get('ETag');
  
  return { hospitals: data.hospitals, version: data.version, etag: newEtag };
}

/**
 * Fetches hospital version from server
 */
async function fetchHospitalVersion() {
  const response = await fetch(HOSPITALS_VERSION_ENDPOINT);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch version: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetches hospitals from fallback endpoint
 */
async function fetchHospitalsFromFallback() {
  const response = await fetch(HOSPITALS_FALLBACK);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch fallback: ${response.status}`);
  }
  
  return response.json();
}

// ============================================
// Sync Functions
// ============================================

/**
 * Performs the actual sync operation
 */
async function performSync() {
  console.log('[SW-Sync] Starting hospital data sync...');
  
  try {
    // Get current version from IndexedDB
    const currentVersion = await getHospitalVersionFromDB();
    
    // Try to fetch version first (lightweight check)
    let serverVersion;
    try {
      const versionData = await fetchHospitalVersion();
      serverVersion = versionData.version;
    } catch (e) {
      console.log('[SW-Sync] Could not fetch version, fetching full data');
      serverVersion = null;
    }
    
    // Check if update is needed
    if (currentVersion && serverVersion && currentVersion >= serverVersion) {
      console.log('[SW-Sync] Data is up to date', { currentVersion, serverVersion });
      
      // Still check if data is stale based on time
      if (!(await isDataStale())) {
        return { success: true, updated: false, reason: 'up_to_date' };
      }
    }
    
    // Fetch latest hospital data
    let hospitalData;
    try {
      const result = await fetchHospitalData();
      if (result) {
        hospitalData = result;
      } else {
        console.log('[SW-Sync] Server data not modified');
        return { success: true, updated: false, reason: 'not_modified' };
      }
    } catch (e) {
      console.log('[SW-Sync] API fetch failed, trying fallback', e);
      const fallbackData = await fetchHospitalsFromFallback();
      hospitalData = {
        hospitals: fallbackData,
        version: Date.now(),
        etag: null
      };
    }
    
    // Store in IndexedDB
    const timestamp = Date.now();
    await storeHospitalsData(
      hospitalData.hospitals,
      hospitalData.version,
      timestamp
    );
    
    // Also update browser cache
    const cache = await caches.open(HOSPITALS_CACHE_NAME);
    const response = new Response(JSON.stringify(hospitalData.hospitals), {
      headers: {
        'Content-Type': 'application/json',
        'X-Hospital-Version': String(hospitalData.version),
        'X-Timestamp': String(timestamp)
      }
    });
    await cache.put(HOSPITALS_FALLBACK, response);
    
    console.log('[SW-Sync] Hospital data synced successfully', {
      count: hospitalData.hospitals.length,
      version: hospitalData.version,
      timestamp
    });
    
    return { success: true, updated: true, count: hospitalData.hospitals.length };
    
  } catch (error) {
    console.error('[SW-Sync] Sync failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registers for periodic background sync
 */
async function registerPeriodicSync() {
  if ('periodicSync' in registration) {
    try {
      // Check permission status
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync',
      });
      
      if (status.state === 'granted') {
        await registration.periodicSync.register(SYNC_TAG, {
          minInterval: MIN_SYNC_INTERVAL_HOURS * 60 * 60 * 1000, // Convert hours to ms
        });
        console.log('[SW-Sync] Periodic sync registered successfully');
        return true;
      } else {
        console.log('[SW-Sync] Periodic sync permission not granted:', status.state);
      }
    } catch (error) {
      console.log('[SW-Sync] Periodic sync not supported or failed:', error);
    }
  } else {
    console.log('[SW-Sync] Periodic sync not supported in this browser');
  }
  
  return false;
}

/**
 * Registers for one-time background sync (fallback)
 */
async function registerBackgroundSync() {
  if ('sync' in registration) {
    try {
      await registration.sync.register(SYNC_TAG);
      console.log('[SW-Sync] Background sync registered successfully');
      return true;
    } catch (error) {
      console.log('[SW-Sync] Background sync registration failed:', error);
    }
  } else {
    console.log('[SW-Sync] Background sync not supported');
  }
  
  return false;
}

// ============================================
// Service Worker Event Handlers
// ============================================

/**
 * Install event - cache app shell
 */
self.addEventListener('install', (event) => {
  console.log('[SW-Sync] Service worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW-Sync] Caching app shell');
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
      ]);
    }).then(() => {
      console.log('[SW-Sync] App shell cached, skipping waiting');
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW-Sync] Service worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== HOSPITALS_CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => {
            console.log('[SW-Sync] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW-Sync] Service worker activated');
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - handle requests with appropriate caching strategy
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle hospital data requests
  if (url.pathname === '/hospitals.json' || url.pathname.endsWith('/hospitals.json')) {
    event.respondWith(handleHospitalsRequest(event.request));
    return;
  }
  
  // Handle API requests - NetworkFirst
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }
  
  // Handle static assets - CacheFirst
  event.respondWith(handleStaticRequest(event.request));
});

/**
 * Handles hospital data requests with StaleWhileRevalidate
 */
async function handleHospitalsRequest(request) {
  const cache = await caches.open(HOSPITALS_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Return cached response immediately
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const responseClone = response.clone();
        cache.put(request, responseClone);
      }
      return response;
    })
    .catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

/**
 * Handles API requests with NetworkFirst
 */
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }
    
    return response;
  } catch (error) {
    console.log('[SW-Sync] Network failed, trying cache for:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline error for API calls
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Network unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handles static asset requests with CacheFirst
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }
    
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/') || new Response('Offline', { status: 503 });
    }
    throw error;
  }
}

/**
 * Periodic sync event handler
 */
self.addEventListener('periodicsync', (event) => {
  console.log('[SW-Sync] Periodic sync event:', event.tag);
  
  if (event.tag === SYNC_TAG) {
    event.waitUntil(performSync());
  }
});

/**
 * Background sync event handler (fallback)
 */
self.addEventListener('sync', (event) => {
  console.log('[SW-Sync] Sync event:', event.tag);
  
  if (event.tag === SYNC_TAG) {
    event.waitUntil(performSync());
  }
});

/**
 * Message handler for client communication
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'PERFORM_SYNC':
      event.waitUntil(
        performSync().then((result) => {
          event.ports[0].postMessage(result);
        })
      );
      break;
      
    case 'GET_SYNC_STATUS':
      event.waitUntil(
        (async () => {
          const version = await getHospitalVersionFromDB();
          const timestamp = await getHospitalTimestampFromDB();
          const hospitals = await getHospitalsFromDB();
          
          event.ports[0].postMessage({
            version,
            timestamp,
            count: hospitals ? hospitals.length : 0,
            isStale: await isDataStale()
          });
        })()
      );
      break;
      
    case 'REGISTER_SYNC':
      event.waitUntil(
        (async () => {
          const periodicResult = await registerPeriodicSync();
          if (!periodicResult) {
            await registerBackgroundSync();
          }
          event.ports[0].postMessage({ success: true });
        })()
      );
      break;
      
    default:
      console.log('[SW-Sync] Unknown message type:', type);
  }
});

console.log('[SW-Sync] Service worker loaded');