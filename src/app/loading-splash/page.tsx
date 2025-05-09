// src/app/loading-splash/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoadingSplashPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main page after the animation duration
    const timer = setTimeout(() => {
      router.replace('/'); // Redirect to root, which will then handle auth logic
    }, 2500); // Match original delay

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="animate-fadeInUp text-7xl font-bold text-primary opacity-0 sm:text-8xl md:text-9xl">
          siChef
          <span className="ml-1 align-super text-lg font-semibold text-accent opacity-80 sm:text-xl md:text-2xl">
            POS <span className="text-xs">&copy;</span>
          </span>
        </h1>
      </div>
    </main>
  );
}
