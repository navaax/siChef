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
      router.replace('/loading-splash');
      return; 
    }

    // If splash has been seen, wait for auth to load
    if (isLoadingAuth) {
      // console.log("Auth is loading, waiting...");
      return; // Wait for auth to finish loading
    }

    // Auth has loaded, now make decision
    // console.log("Auth loaded. Username:", username);
    if (username) {
      router.replace('/dashboard/home');
    } else {
      router.replace('/auth/login');
    }
  }, [router, username, isLoadingAuth]);

  // Render a simple loading indicator while checks/redirection happen
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Cargando aplicación...</p>
    </div>
  );
}
