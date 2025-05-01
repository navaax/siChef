"use client";

import * as React from 'react';
import { Home, ShoppingCart, BarChart2, Settings, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/auth-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const navItems = [
  { href: '/dashboard/home', label: 'Inicio', icon: Home },
  { href: '/dashboard/create-order', label: 'Crear Pedidos', icon: ShoppingCart },
  { href: '/dashboard/reports', label: 'Reporte de Ventas', icon: BarChart2 },
  { href: '/dashboard/settings', label: 'Configuraciones', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { username, logout } = useAuth();
  const router = useRouter();
  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);

  React.useEffect(() => {
    // Redirect to login if not authenticated
    if (!username) {
      router.replace('/login');
    }
  }, [username, router]);

  const handleLogout = () => {
    logout();
    // No need to redirect here, useEffect will handle it
    setIsLogoutAlertOpen(false); // Close the dialog
  };

  // Prevent rendering the layout if not authenticated (avoids flash of content)
  if (!username) {
    return null; // Or a loading spinner
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full bg-muted/40">
        {/* Vertical Navbar */}
        <aside className="fixed inset-y-0 left-0 z-10 flex w-14 flex-col border-r bg-background sm:flex"> {/* Reduced width */}
          <nav className="flex flex-col items-center gap-4 px-2 py-4 flex-grow">
            {/* Placeholder for Logo/Brand */}
             <Link
              href="/dashboard/home"
              className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-10 md:w-10 md:text-base mb-4" /* Adjusted size */
            >
               {/* You can add an SVG logo here */}
              <span className="text-lg font-bold">SC</span> {/* Adjusted size */}
              <span className="sr-only">siChef POS</span>
            </Link>
            {navItems.map((item) => (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                      pathname === item.href ? 'bg-accent text-accent-foreground' : ''
                    )}
                    prefetch={false}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </nav>
          <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-4">
             <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground md:h-8 md:w-8">
                   <User className="h-5 w-5" />
                   <span className="sr-only">{username}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{username}</TooltipContent>
            </Tooltip>
            <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <AlertDialogTrigger asChild>
                     <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground md:h-8 md:w-8">
                       <LogOut className="h-5 w-5" />
                       <span className="sr-only">Logout</span>
                     </Button>
                   </AlertDialogTrigger>
                 </TooltipTrigger>
                 <TooltipContent side="right">Logout</TooltipContent>
               </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will be returned to the login screen.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 pl-14"> {/* Adjusted pl for navbar width */}
           {/* Header can be added here if needed */}
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
