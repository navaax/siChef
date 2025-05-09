// src/contexts/auth-context.tsx
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

interface AuthContextType {
  username: string | null;
  isLoadingAuth: boolean; // To indicate if auth status is being loaded
  login: (user: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Start as true

  // Load username from localStorage on initial mount
  useEffect(() => {
    try {
      const storedUsername = localStorage.getItem('siChefUsername');
      if (storedUsername) {
        setUsername(storedUsername);
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      // Handle cases where localStorage might be unavailable (e.g., SSR, private browsing)
    } finally {
      setIsLoadingAuth(false); // Finished loading attempt
    }
  }, []);

  const login = useCallback((user: string) => {
    setUsername(user);
    try {
      localStorage.setItem('siChefUsername', user); // Persist username
    } catch (error) {
      console.error("Error setting localStorage:", error);
    }
  }, []);

  const logout = useCallback(() => {
    setUsername(null);
    try {
      localStorage.removeItem('siChefUsername'); // Clear username
      localStorage.removeItem('hasSeenSiChefSplash'); // Also clear splash flag on logout
    } catch (error) {
      console.error("Error removing from localStorage:", error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ username, isLoadingAuth, login, logout }}>
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
