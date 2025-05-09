// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function RootPage() {
  useEffect(() => {
    let storedUsername: string | null = null;
    try {
      storedUsername = localStorage.getItem('siChefUsername');
      console.log('RootPage: localStorage siChefUsername =', storedUsername);
    } catch (e) {
      console.error("RootPage: Error accessing localStorage:", e);
      // Default to redirecting to login if localStorage is inaccessible
      storedUsername = null;
    }

    const timer = setTimeout(() => {
      if (storedUsername) {
        console.log("RootPage: User found in localStorage, redirecting to /dashboard/home...");
        redirect('/dashboard/home');
      } else {
        console.log("RootPage: No user in localStorage or error accessing, redirecting to /login...");
        redirect('/login');
      }
    }, 2500); // Adjusted delay to allow animation to play

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, []);

  return (
    <main className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-7xl sm:text-8xl md:text-9xl font-bold text-primary opacity-0 animate-fadeInUp">
          siChef
          <span className="align-super text-lg sm:text-xl md:text-2xl font-semibold text-accent opacity-80 ml-1">
            POS <span className="text-xs">&copy;</span>
          </span>
        </h1>
        {/* Optional: a subtle loading spinner or message below if desired */}
        {/* <p className="mt-4 text-muted-foreground animate-pulse">Cargando...</p> */}
      </div>
    </main>
  );
}
