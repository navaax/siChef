"use client";

import type { ReactNode } from 'react';
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

interface AuthContextType {
  username: string | null;
  login: (user: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [username, setUsername] = useState<string | null>(null);

  // Load username from localStorage on initial mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('siChefUsername');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const login = useCallback((user: string) => {
    setUsername(user);
    localStorage.setItem('siChefUsername', user); // Persist username
  }, []);

  const logout = useCallback(() => {
    setUsername(null);
    localStorage.removeItem('siChefUsername'); // Clear username
  }, []);

  return (
    <AuthContext.Provider value={{ username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
