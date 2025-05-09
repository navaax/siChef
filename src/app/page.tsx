// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { username, isLoadingAuth } = useAuth();

  useEffect(() => {
    const splashSeen = localStorage.getItem('hasSeenSiChefSplash') === 'true';

    if (!splashSeen) {
      // console.log("Splash not seen, setting flag and redirecting to /loading-splash");
      localStorage.setItem('hasSeenSiChefSplash', 'true');
      router.replace('/loading-splash'); // Redirige a /loading-splash
      return; 
    }

    // Si ya se vio el splash, esperar a que cargue la autenticación
    if (isLoadingAuth) {
      // console.log("Auth is loading, waiting...");
      return; // Esperar a que termine de cargar la autenticación
    }

    // La autenticación ha cargado, ahora tomar decisión
    // console.log("Auth loaded. Username:", username);
    if (username) {
      router.replace('/dashboard/home'); // Redirige a /dashboard/home
    } else {
      router.replace('/login'); // Corregido: Redirige a /login (antes /auth/login)
    }
  }, [router, username, isLoadingAuth]);

  // Renderizar un indicador de carga simple mientras ocurren las verificaciones/redirecciones
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Cargando aplicación...</p>
    </div>
  );
}
