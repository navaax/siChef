'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogOverlay } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { DenominationInputForm } from './denomination-input-form';
import { startCashSession } from '@/services/cash-register-service';
import type { StartCashFormData } from '@/types/cash-register-types';

interface StartingCashDialogProps {
  isOpen: boolean;
  onSessionStarted: () => void; // Callback cuando la sesión se inicia correctamente
}

export const StartingCashDialog: React.FC<StartingCashDialogProps> = ({ isOpen, onSessionStarted }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();

  const handleStartSession = async (formData: StartCashFormData) => {
    setIsLoading(true);
    try {
      console.log("Iniciando sesión de caja con:", formData);
      // TODO: Obtener userId si es necesario (ej. from useAuth)
      await startCashSession(formData);
      toast({ title: "Sesión de Caja Iniciada", description: `Caja abierta con ${formData.total}.` });
      onSessionStarted(); // Llama al callback para cerrar el diálogo o refrescar estado
    } catch (error) {
      console.error("Error al iniciar sesión de caja:", error);
      toast({
        variant: 'destructive',
        title: 'Error al Iniciar Caja',
        description: error instanceof Error ? error.message : 'Ocurrió un error desconocido.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open}> {/* Evitar que se cierre al hacer clic fuera */}
      {/* <DialogOverlay className="bg-black/70 backdrop-blur-sm" /> */}
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Iniciar Caja</DialogTitle>
          <DialogDescription>
            Ingresa la cantidad de cada denominación para el fondo de caja inicial.
          </DialogDescription>
        </DialogHeader>
        <DenominationInputForm
          onSubmit={handleStartSession}
          isLoading={isLoading}
          submitButtonText="Confirmar Fondo Inicial"
        />
      </DialogContent>
    </Dialog>
  );
};
