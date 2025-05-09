// src/app/page.tsx
'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react'; // Import useEffect

export default function RootPage() {
  // Esta página es principalmente para la carga inicial o redirección.
  // En una aplicación real, esta verificación y redirección podrían manejarse mejor en middleware o componentes de servidor.

  useEffect(() => {
    // Retrasar la redirección para permitir que se muestre la animación
    const timer = setTimeout(() => {
      redirect('/login');
    }, 2500); // Retraso de 2.5 segundos (ajustar según sea necesario)

    // Limpiar el temporizador si el componente se desmonta antes de que se complete
    return () => clearTimeout(timer);
  }, []); // El array de dependencias vacío asegura que esto se ejecute solo una vez al montar

  return (
    <main className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-7xl sm:text-8xl md:text-9xl font-bold text-primary opacity-0 animate-fadeInUp">
          siChef
          <span className="align-super text-lg sm:text-xl md:text-2xl font-semibold text-accent opacity-80 ml-1">
            POS <span className="text-xs">&copy;</span>
          </span>
        </h1>
        {/* Opcional: un sutil spinner de carga o mensaje debajo si se desea */}
        {/* <p className="mt-4 text-muted-foreground animate-pulse">Cargando...</p> */}
      </div>
    </main>
  );
}
