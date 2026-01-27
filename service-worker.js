// Akwa-Connect Service Worker
const CACHE_NAME = 'akwa-connect-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/signup.html',
  '/profile.html',
  '/matches.html',
  '/messages.html',
  '/styles/style.css',
  '/styles/materialize.min.css',
  '/scripts/main.js',
  '/scripts/auth.js',
  '/scripts/matching.js',
  '/scripts/matches.js',
  '/scripts/profile.js',
  '/scripts/messages.js',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests and backend API calls
  if (event.request.method !== 'GET' || 
      event.request.url.includes('/api/') ||
      event.request.url.includes('/ws/')) {
    return;
  }
  
  // For HTML pages, try network first, then cache
  if (event.request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh version
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => cachedResponse || caches.match('/index.html'));
        })
    );
    return;
  }
  
  // For static assets, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache if not a successful response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cache the new resource
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));
            
            return response;
          });
      })
  );
});

// Handle push notifications for new matches/messages
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'Akwa-Connect',
      body: 'You have a new notification!'
    };
  }
  
  const options = {
    body: data.body || 'Click to see your notification',
    icon: 'icons/icon-192x192.png',
    badge: 'icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      matchId: data.matchId
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Akwa-Connect', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open the app to the relevant page
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise open a new window
        if (clients.openWindow) {
          const url = event.notification.data.url || '/';
          return clients.openWindow(url);
        }
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncLikes());
  }
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Sync likes that were made offline
async function syncLikes() {
  try {
    const db = await openDatabase();
    const offlineLikes = await getAllOfflineLikes(db);
    
    for (const like of offlineLikes) {
      await fetch('http://localhost:3000/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(like)
      });
      
      // Remove from IndexedDB after successful sync
      await deleteOfflineLike(db, like.id);
    }
    
    console.log('[Service Worker] Offline likes synced');
  } catch (error) {
    console.error('[Service Worker] Sync likes error:', error);
  }
}

// Sync messages that were sent offline
async function syncMessages() {
  try {
    const db = await openDatabase();
    const offlineMessages = await getAllOfflineMessages(db);
    
    for (const message of offlineMessages) {
      await fetch('http://localhost:3000/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      
      // Remove from IndexedDB after successful sync
      await deleteOfflineMessage(db, message.id);
    }
    
    console.log('[Service Worker] Offline messages synced');
  } catch (error) {
    console.error('[Service Worker] Sync messages error:', error);
  }
}

// IndexedDB helper functions
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('akwaConnectOffline', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store for offline likes
      if (!db.objectStoreNames.contains('offlineLikes')) {
        const likesStore = db.createObjectStore('offlineLikes', { keyPath: 'id' });
        likesStore.createIndex('timestamp', 'timestamp');
      }
      
      // Create object store for offline messages
      if (!db.objectStoreNames.contains('offlineMessages')) {
        const messagesStore = db.createObjectStore('offlineMessages', { keyPath: 'id' });
        messagesStore.createIndex('timestamp', 'timestamp');
      }
      
      // Create object store for user data
      if (!db.objectStoreNames.contains('userData')) {
        const userStore = db.createObjectStore('userData', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// IndexedDB operations (simplified - you'd implement these fully)
async function getAllOfflineLikes(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineLikes'], 'readonly');
    const store = transaction.objectStore('offlineLikes');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteOfflineLike(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineLikes'], 'readwrite');
    const store = transaction.objectStore('offlineLikes');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}



