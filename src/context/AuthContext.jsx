import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // 1. Initialize state with data from localStorage (if it exists)
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('motionx_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Failed to parse user from local storage", error);
      return null;
    }
  });

  // 2. Login: Save to State AND LocalStorage
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('motionx_user', JSON.stringify(userData));
  };

  // 3. Logout: Clear State AND LocalStorage
  const logout = () => {
    setUser(null);
    localStorage.removeItem('motionx_user');
  };

  // 4. (Optional) Check token validity with backend on mount
  // If you have a token, you might want to verify it here via an API call.
  // For now, simple localStorage persistence works for UI state.

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);