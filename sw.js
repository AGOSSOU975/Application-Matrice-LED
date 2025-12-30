const CACHE_NAME = 'led-display-v1.1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './images/logo.png',
  './images/logoPerso.png'
];

// Ressources CDN à mettre en cache séparément
const cdnUrls = [
  'https://cdn.tailwindcss.com'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation en cours...');
  
  event.waitUntil(
    Promise.all([
      // Cache des fichiers locaux
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Service Worker: Mise en cache des fichiers locaux');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('Certains fichiers locaux n\'ont pas pu être mis en cache:', err);
        });
      }),
      // Cache des CDN
      caches.open(CACHE_NAME + '-cdn').then((cache) => {
        console.log('Service Worker: Mise en cache des CDN');
        return Promise.all(
          cdnUrls.map(url => 
            cache.add(url).catch(err => {
              console.warn(`Impossible de mettre en cache ${url}:`, err);
            })
          )
        );
      })
    ]).then(() => {
      console.log('Service Worker: Installation terminée');
      return self.skipWaiting();
    })
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation en cours...');
  
  const cacheWhitelist = [CACHE_NAME, CACHE_NAME + '-cdn'];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Service Worker: Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation terminée');
      return self.clients.claim();
    })
  );
});

// Gestion des requêtes réseau
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ne pas intercepter les requêtes vers l'ESP32
  if (isESP32Request(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Stratégie Cache First pour les fichiers statiques
  if (isStaticAsset(event.request)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Stratégie Network First pour les CDN
  if (isCDNRequest(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Stratégie par défaut: Cache First avec fallback
  event.respondWith(cacheFirst(event.request));
});

// Message handler pour forcer la mise à jour
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Activation forcée');
    self.skipWaiting();
  }
});

// ============= FONCTIONS UTILITAIRES =============

// Vérifier si la requête est vers l'ESP32 (IP locale)
function isESP32Request(url) {
  return (
    url.hostname.startsWith('192.168') ||
    url.hostname.startsWith('10.') ||
    url.hostname.startsWith('172.16.') ||
    url.hostname.startsWith('172.17.') ||
    url.hostname.startsWith('172.18.') ||
    url.hostname.startsWith('172.19.') ||
    url.hostname.startsWith('172.20.') ||
    url.hostname.startsWith('172.21.') ||
    url.hostname.startsWith('172.22.') ||
    url.hostname.startsWith('172.23.') ||
    url.hostname.startsWith('172.24.') ||
    url.hostname.startsWith('172.25.') ||
    url.hostname.startsWith('172.26.') ||
    url.hostname.startsWith('172.27.') ||
    url.hostname.startsWith('172.28.') ||
    url.hostname.startsWith('172.29.') ||
    url.hostname.startsWith('172.30.') ||
    url.hostname.startsWith('172.31.')
  );
}

// Vérifier si c'est une ressource CDN
function isCDNRequest(url) {
  return url.hostname.includes('cdn.') || 
         url.hostname.includes('unpkg.com') ||
         url.hostname.includes('jsdelivr.net');
}

// Vérifier si c'est un fichier statique
function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    request.method === 'GET' && (
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.json') ||
      url.pathname === '/'
    )
  );
}

// Stratégie Cache First: Priorité au cache, fallback réseau
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Erreur fetch:', error);
    
    // Fallback vers index.html pour les pages HTML
    if (request.destination === 'document') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    
    throw error;
  }
}

// Stratégie Network First: Priorité réseau, fallback cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME + '-cdn');
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.warn('Service Worker: Réseau indisponible, utilisation du cache:', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}