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
    console.log('[RootPage] useEffect triggered. isLoadingAuth:', isLoadingAuth, 'Username:', username);
    const splashSeen = localStorage.getItem('hasSeenSiChefSplash') === 'true';
    console.log('[RootPage] Splash seen:', splashSeen);

    if (isLoadingAuth) {
      console.log('[RootPage] Auth is loading, waiting...');
      return; // Wait for auth to load
    }

    // Auth has loaded
    if (!splashSeen) {
      console.log('[RootPage] Splash not seen, setting flag and redirecting to /loading-splash');
      localStorage.setItem('hasSeenSiChefSplash', 'true');
      router.replace('/loading-splash');
    } else {
      // Splash has been seen, route based on auth
      console.log('[RootPage] Splash seen. Auth loaded. Username:', username);
      if (username) {
        console.log('[RootPage] User authenticated, redirecting to /dashboard/home');
        router.replace('/dashboard/home');
      } else {
        console.log('[RootPage] User not authenticated, redirecting to /login');
        router.replace('/login');
      }
    }
  }, [router, username, isLoadingAuth]);

  // Render a loading indicator while useEffect runs and decides where to redirect
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Cargando aplicación...</p>
    </div>
  );
}
