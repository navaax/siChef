'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { getActiveCashSession } from '@/services/cash-register-service';
import type { CashSession } from '@/types/cash-register-types';
import { useToast } from '@/hooks/use-toast';

interface CashRegisterContextType {
  currentSession: CashSession | null;
  isSessionLoading: boolean;
  refreshSession: () => Promise<void>;
  clearSession: () => void; // Para cuando se cierra
}

const CashRegisterContext = createContext<CashRegisterContextType | undefined>(undefined);

export const CashRegisterProvider = ({ children }: { children: ReactNode }) => {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const { toast } = useToast();

  const refreshSession = useCallback(async () => {
    console.log("[CashRegisterContext] Refrescando sesión...");
    setIsSessionLoading(true);
    try {
      const session = await getActiveCashSession();
      setCurrentSession(session);
      console.log("[CashRegisterContext] Sesión obtenida:", session ? session.id : 'Ninguna');
    } catch (error) {
      console.error("[CashRegisterContext] Error refrescando sesión:", error);
      // No mostramos toast aquí para no ser molestos, pero sí en el componente que lo llama si es necesario
      setCurrentSession(null); // Asegurarse de que esté null si hay error
    } finally {
      setIsSessionLoading(false);
    }
  }, []);

  const clearSession = useCallback(() => {
    setCurrentSession(null);
     console.log("[CashRegisterContext] Sesión local limpiada.");
  }, []);

  // Cargar sesión activa al montar
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return (
    <CashRegisterContext.Provider value={{ currentSession, isSessionLoading, refreshSession, clearSession }}>
      {children}
    </CashRegisterContext.Provider>
  );
};

export const useCashRegister = (): CashRegisterContextType => {
  const context = useContext(CashRegisterContext);
  if (context === undefined) {
    throw new Error('useCashRegister debe usarse dentro de un CashRegisterProvider');
  }
  return context;
};
