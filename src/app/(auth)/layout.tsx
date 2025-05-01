import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      {/* This simple layout centers the content */}
      {children}
    </div>
  );
}
