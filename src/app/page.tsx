// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function RootPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      redirect('/login');
    }, 2500); // Adjusted delay to allow animation to play
    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, []);

  return (
    <main className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-7xl sm:text-8xl md:text-9xl font-bold text-primary">
          siChef
          <span className="align-super text-lg sm:text-xl md:text-2xl font-semibold text-accent opacity-80 ml-1">
            pos c
          </span>
        </h1>
        {/* Optional: a subtle loading spinner or message below if desired */}
        {/* <p className="mt-4 text-muted-foreground animate-pulse">Cargando...</p> */}
      </div>
    </main>
  );
}
