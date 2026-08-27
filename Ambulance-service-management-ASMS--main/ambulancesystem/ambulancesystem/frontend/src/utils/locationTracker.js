/**
 * GPS Location Tracking Utility
 * Handles continuous GPS tracking with background support
 */

class LocationTracker {
  constructor() {
    this.watchId = null;
    this.isTracking = false;
    this.onLocationUpdate = null;
    this.onError = null;
    this.lastLocation = null;
    this.updateInterval = 5000; // 5 seconds default
    this.backgroundInterval = null;
    this.options = {
      enableHighAccuracy: false, // Use network location (faster, less battery)
      timeout: 30000, // 30 seconds - very generous timeout
      maximumAge: 300000 // Accept positions up to 5 minutes old
    };
  }

  /**
   * Start tracking GPS location
   * @param {Function} onLocationUpdate - Callback when location updates
   * @param {Function} onError - Callback when error occurs
   * @param {Number} interval - Update interval in milliseconds (default: 5000ms)
   */
  startTracking(onLocationUpdate, onError, interval = 5000) {
    if (this.isTracking) {
      console.warn('Location tracking already started');
      return;
    }

    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser');
      if (onError) onError(error);
      return;
    }

    this.onLocationUpdate = onLocationUpdate;
    this.onError = onError;
    this.updateInterval = interval;
    this.isTracking = true;

    // Use watchPosition for continuous tracking
    this.watchId = navigator.geolocation.watchPosition(
      this.handleLocationSuccess.bind(this),
      this.handleLocationError.bind(this),
      this.options
    );

    // Setup background tracking
    this.setupBackgroundTracking();

    console.log('📍 GPS tracking started with', interval / 1000, 'second interval');
  }

  /**
   * Handle successful location update
   */
  handleLocationSuccess(position) {
    const locationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed ? position.coords.speed * 3.6 : 0, // Convert m/s to km/h
      timestamp: new Date(position.timestamp)
    };

    this.lastLocation = locationData;

    if (this.onLocationUpdate) {
      this.onLocationUpdate(locationData);
    }
  }

  /**
   * Handle location error
   */
  handleLocationError(error) {
    // Silent error handling - don't show browser alerts
    console.warn('GPS error (silent):', error.code);
    
    // Don't call onError callback to prevent showing error dialogs
    // Just silently continue with fallback location
  }

  /**
   * Setup background tracking using Page Visibility API
   */
  setupBackgroundTracking() {
    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('📱 App minimized - switching to background tracking');
        this.switchToBackgroundMode();
      } else {
        console.log('📱 App visible - switching to foreground tracking');
        this.switchToForegroundMode();
      }
    });

    // Listen for app going to background (mobile)
    window.addEventListener('blur', () => {
      console.log('📱 App lost focus');
      this.switchToBackgroundMode();
    });

    window.addEventListener('focus', () => {
      console.log('📱 App gained focus');
      this.switchToForegroundMode();
    });
  }

  /**
   * Switch to background mode (less frequent updates to save battery)
   */
  switchToBackgroundMode() {
    if (!this.isTracking) return;

    // In background, update every 10 seconds instead of 5
    const backgroundInterval = this.updateInterval * 2;

    // Clear existing watch
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Set up interval-based tracking for background
    this.backgroundInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        this.handleLocationSuccess.bind(this),
        this.handleLocationError.bind(this),
        this.options
      );
    }, backgroundInterval);

    console.log(`📍 Background tracking: ${backgroundInterval / 1000}s interval`);
  }

  /**
   * Switch to foreground mode (more frequent updates)
   */
  switchToForegroundMode() {
    if (!this.isTracking) return;

    // Clear background interval
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    // Resume watchPosition for better accuracy
    this.watchId = navigator.geolocation.watchPosition(
      this.handleLocationSuccess.bind(this),
      this.handleLocationError.bind(this),
      this.options
    );

    console.log(`📍 Foreground tracking: ${this.updateInterval / 1000}s interval`);
  }

  /**
   * Stop tracking
   */
  stopTracking() {
    if (!this.isTracking) {
      console.warn('Location tracking not started');
      return;
    }

    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    this.isTracking = false;
    this.lastLocation = null;

    console.log('📍 GPS tracking stopped');
  }

  /**
   * Get current location once
   */
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed ? position.coords.speed * 3.6 : 0,
            timestamp: new Date(position.timestamp)
          };
          resolve(locationData);
        },
        (error) => {
          reject(error);
        },
        this.options
      );
    });
  }

  /**
   * Check if geolocation is supported
   */
  static isSupported() {
    return 'geolocation' in navigator;
  }

  /**
   * Request location permission
   */
  static async requestPermission() {
    if (!LocationTracker.isSupported()) {
      throw new Error('Geolocation is not supported by this browser');
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      return true;
    } catch (error) {
      if (error.code === error.PERMISSION_DENIED) {
        throw new Error('Location permission denied');
      }
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  /**
   * Get last known location
   */
  getLastLocation() {
    return this.lastLocation;
  }

  /**
   * Check if currently tracking
   */
  isCurrentlyTracking() {
    return this.isTracking;
  }
}

export default LocationTracker;
