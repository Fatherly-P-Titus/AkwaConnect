// PWA Installation Handler
class PWAInstallHandler {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  }
  
  init() {
    this.setupInstallPrompt();
    this.setupInstallButton();
    this.checkPWAStatus();
    this.registerServiceWorker();
  }
  
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] Before install prompt fired');
      
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      
      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
      
      // Show install button
      this.showInstallButton();
    });
    
    // Track standalone mode changes
    window.matchMedia('(display-mode: standalone)').addListener((e) => {
      this.isStandalone = e.matches;
      this.updateUIForPWAStatus();
    });
  }
  
  setupInstallButton() {
    // Create install button if it doesn't exist
    if (!document.getElementById('pwa-install-button')) {
      this.installButton = document.createElement('button');
      this.installButton.id = 'pwa-install-button';
      this.installButton.className = 'btn-floating btn-large pulse';
      this.installButton.style.position = 'fixed';
      this.installButton.style.bottom = '20px';
      this.installButton.style.right = '20px';
      this.installButton.style.zIndex = '9999';
      this.installButton.style.background = 'linear-gradient(135deg, #10b981 0%, #f59e0b 100%)';
      this.installButton.innerHTML = '<i class="material-icons">get_app</i>';
      this.installButton.title = 'Install Akwa-Connect App';
      
      document.body.appendChild(this.installButton);
      
      this.installButton.addEventListener('click', () => this.promptInstall());
    } else {
      this.installButton = document.getElementById('pwa-install-button');
    }
  }
  
  showInstallButton() {
    if (this.installButton && !this.isStandalone) {
      this.installButton.style.display = 'block';
    }
  }
  
  hideInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
  }
  
  promptInstall() {
    if (!this.deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return;
    }
    
    console.log('[PWA] Showing install prompt');
    
    // Show the install prompt
    this.deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    this.deferredPrompt.userChoice.then((choiceResult) => {
      console.log('[PWA] User choice:', choiceResult.outcome);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        M.toast({html: 'Akwa-Connect is installing...'});
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
      
      // Clear the deferredPrompt variable
      this.deferredPrompt = null;
      
      // Hide the install button
      this.hideInstallButton();
    });
  }
  
  checkPWAStatus() {
    // Check if app is running as PWA
    if (this.isStandalone) {
      console.log('[PWA] Running as standalone app');
      this.updateUIForPWAStatus();
    } else if (navigator.standalone) {
      // iOS Safari
      this.isStandalone = true;
      this.updateUIForPWAStatus();
    }
  }
  
  updateUIForPWAStatus() {
    if (this.isStandalone) {
      // Add standalone class to body for specific styling
      document.body.classList.add('pwa-standalone');
      
      // Hide browser UI elements
      this.hideInstallButton();
      
      // Add standalone-specific features
      this.enablePWAFeatures();
    }
  }
  
  enablePWAFeatures() {
    // Enable vibration if available
    if ('vibrate' in navigator) {
      window.vibrate = function(pattern = 200) {
        navigator.vibrate(pattern);
      };
    }
    
    // Enable wake lock for keeping screen on during chat
    if ('wakeLock' in navigator) {
      let wakeLock = null;
      
      window.enableWakeLock = async function() {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('[PWA] Wake lock acquired');
        } catch (err) {
          console.error('[PWA] Wake lock error:', err);
        }
      };
      
      window.disableWakeLock = function() {
        if (wakeLock) {
          wakeLock.release();
          wakeLock = null;
          console.log('[PWA] Wake lock released');
        }
      };
    }
    
    // Request notification permission
    this.requestNotificationPermission();
  }
  
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log('[PWA] Notification permission:', permission);
        
        if (permission === 'granted') {
          this.subscribeToPushNotifications();
        }
      } catch (error) {
        console.error('[PWA] Notification permission error:', error);
      }
    }
  }
  
  async subscribeToPushNotifications() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        // Check current subscription
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
          // Subscribe to push notifications
          const publicKey = 'BPWkI8B5Z-5P9mKjX7VQ2cR1tY3uH6nL0xG4sD8fJ9hM1qC3vA7wE5zT4yB6uN2oP9rX1'; // You'd get this from your backend
          const convertedKey = this.urlBase64ToUint8Array(publicKey);
          
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });
          
          console.log('[PWA] Push subscription successful');
          
          // Send subscription to your server
          await this.sendSubscriptionToServer(subscription);
        }
      } catch (error) {
        console.error('[PWA] Push subscription error:', error);
      }
    }
  }
  
  async sendSubscriptionToServer(subscription) {
    // Send to your backend to save for push notifications
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    
    try {
      await fetch('http://localhost:3000/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: JSON.stringify(subscription)
        })
      });
    } catch (error) {
      console.error('[PWA] Error sending subscription to server:', error);
    }
  }
  
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }
  
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        console.log('[PWA] Registering service worker...');
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('[PWA] Service Worker registered:', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('[PWA] Service Worker update found:', newWorker.state);
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              this.showUpdateNotification();
            }
          });
        });
        
        // Check if there's a waiting service worker
        if (registration.waiting) {
          this.showUpdateNotification();
        }
        
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    }
  }
  
  showUpdateNotification() {
    // Show a toast notification about the update
    const toastHTML = `
      <span>New version available!</span>
      <button class="btn-flat toast-action" onclick="window.location.reload()">UPDATE</button>
    `;
    
    M.toast({
      html: toastHTML,
      displayLength: 10000,
      classes: 'rounded'
    });
  }
  
  // Offline functionality
  setupOfflineDetection() {
    // Update UI based on online/offline status
    window.addEventListener('online', () => {
      console.log('[PWA] App is online');
      document.body.classList.remove('offline');
      M.toast({html: 'Back online! Syncing data...', classes: 'green'});
      
      // Trigger background sync
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          registration.sync.register('sync-likes');
          registration.sync.register('sync-messages');
        });
      }
    });
    
    window.addEventListener('offline', () => {
      console.log('[PWA] App is offline');
      document.body.classList.add('offline');
      M.toast({html: 'You are offline. Some features may be limited.', classes: 'orange'});
    });
    
    // Initial check
    if (!navigator.onLine) {
      document.body.classList.add('offline');
    }
  }
}

// Initialize PWA features
document.addEventListener('DOMContentLoaded', () => {
  const pwaHandler = new PWAInstallHandler();
  pwaHandler.init();
  pwaHandler.setupOfflineDetection();
  
  // Make available globally
  window.pwaHandler = pwaHandler;
});

