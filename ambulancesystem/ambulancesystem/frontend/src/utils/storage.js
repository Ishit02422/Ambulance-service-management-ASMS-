import { encrypt, decrypt, clearEncryptionKey } from './encryption';

const STORAGE_KEYS = {
  USER: 'ambulance_user',
  USERS: 'ambulance_users',
  DRIVERS: 'ambulance_drivers',
  BOOKINGS: 'ambulance_bookings',
  AMBULANCES: 'ambulance_ambulances',
  NOTIFICATIONS: 'ambulance_notifications'
};

export const storage = {
  getUser: async () => {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? await decrypt(user) : null;
  },

  setUser: async (user) => {
    const encrypted = await encrypt(user);
    localStorage.setItem(STORAGE_KEYS.USER, encrypted);
  },

  clearUser: () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    clearEncryptionKey();
  },

  getUsers: async () => {
    const users = localStorage.getItem(STORAGE_KEYS.USERS);
    return users ? await decrypt(users) : [];
  },

  setUsers: async (users) => {
    const encrypted = await encrypt(users);
    localStorage.setItem(STORAGE_KEYS.USERS, encrypted);
  },

  getDrivers: async () => {
    const drivers = localStorage.getItem(STORAGE_KEYS.DRIVERS);
    return drivers ? await decrypt(drivers) : [];
  },

  setDrivers: async (drivers) => {
    const encrypted = await encrypt(drivers);
    localStorage.setItem(STORAGE_KEYS.DRIVERS, encrypted);
  },

  getBookings: async () => {
    const bookings = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    return bookings ? await decrypt(bookings) : [];
  },

  setBookings: async (bookings) => {
    const encrypted = await encrypt(bookings);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, encrypted);
  },

  getAmbulances: async () => {
    const ambulances = localStorage.getItem(STORAGE_KEYS.AMBULANCES);
    return ambulances ? await decrypt(ambulances) : [];
  },

  setAmbulances: async (ambulances) => {
    const encrypted = await encrypt(ambulances);
    localStorage.setItem(STORAGE_KEYS.AMBULANCES, encrypted);
  },

  getNotifications: async () => {
    const notifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return notifications ? await decrypt(notifications) : [];
  },

  setNotifications: async (notifications) => {
    const encrypted = await encrypt(notifications);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, encrypted);
  }
};

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
