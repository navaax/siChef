// src/app/loading-splash/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoadingSplashPage() {
  const router = useRouter();

  useEffect(() => {
    console.log('[LoadingSplashPage] Splash screen mounted.');
    const timer = setTimeout(() => {
      console.log('[LoadingSplashPage] Splash timeout, redirecting to /');
      router.replace('/'); // Redirect to root, page.tsx will handle next step
    }, 2800); // Increased duration slightly to match animation better

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground overflow-hidden">
      <div className="text-center">
        {/* Using a div for the animation context to avoid issues with h1 opacity directly */}
        <div className="animate-fadeInUp opacity-0" style={{ animationFillMode: 'forwards', animationDelay: '0.2s' }}>
          <h1 className="text-7xl font-bold text-primary sm:text-8xl md:text-9xl">
            siChef
            <span className="ml-1 align-super text-lg font-semibold text-accent opacity-80 sm:text-xl md:text-2xl">
              POS <span className="text-xs">&copy;</span>
            </span>
          </h1>
        </div>
      </div>
    </main>
  );
}
