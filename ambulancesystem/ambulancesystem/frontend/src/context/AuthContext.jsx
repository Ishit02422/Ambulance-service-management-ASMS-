import { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../utils/storage';
import { api, updateCachedUser } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const storedUser = await storage.getUser();
      if (storedUser) {
        setUser(storedUser);
        updateCachedUser(storedUser);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const register = async (userData) => {
    try {
      const data = await api.register(userData);
      if (data.requiresOtp) {
        return data;
      }
      setUser(data);
      await storage.setUser(data);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const verifyOtp = async (email, otp, role) => {
    try {
      const data = await api.verifyOtp(email, otp, role);
      setUser(data);
      await storage.setUser(data);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const data = await api.login(email, password);
      setUser(data);
      await storage.setUser(data);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    storage.clearUser();
    api.logout();
  };

  const updateProfile = async (updates) => {
    const users = await storage.getUsers();
    const userIndex = users.findIndex(u => u.id === user.id);

    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updates };
      await storage.setUsers(users);

      const updatedUser = { ...users[userIndex] };
      delete updatedUser.password;

      setUser(updatedUser);
      await storage.setUser(updatedUser);
    }
  };

  const value = {
    user,
    loading,
    register,
    verifyOtp,
    login,
    logout,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
