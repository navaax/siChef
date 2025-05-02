// src/app/dashboard/cash-register/page.tsx
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useCashRegister } from '@/contexts/cash-register-context';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

// Esta página es opcional, puede servir para ver el estado actual de la caja
// o para realizar acciones manuales si es necesario.

export default function CashRegisterPage() {
  const { currentSession, isSessionLoading } = useCashRegister();

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Caja</CardTitle>
          <CardDescription>Ver estado actual de la caja o realizar ajustes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSessionLoading ? (
            <p className="text-muted-foreground">Cargando estado de caja...</p>
          ) : currentSession ? (
            <div>
              <h3 className="text-lg font-semibold mb-2">Sesión Activa</h3>
              <p><span className="font-medium">ID Sesión:</span> {currentSession.id}</p>
              <p><span className="font-medium">Iniciada:</span> {format(new Date(currentSession.start_time), 'Pp')}</p>
              <p><span className="font-medium">Fondo Inicial:</span> {formatCurrency(currentSession.starting_cash)}</p>
              <p><span className="font-medium">Usuario:</span> {currentSession.user_id || 'N/A'}</p>
              <p><span className="font-medium">Estado:</span> <span className="capitalize text-green-600 font-semibold">{currentSession.status}</span></p>
              {/* Añadir botón para Cierre de Día si es apropiado aquí */}
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground mb-4">No hay ninguna sesión de caja activa.</p>
              <p>Se te pedirá iniciar una nueva sesión al realizar la próxima acción que la requiera (ej. crear pedido).</p>
              {/* O añadir botón para iniciar sesión manualmente */}
              {/* <Button>Iniciar Nueva Sesión de Caja</Button> */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
