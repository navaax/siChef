
// src/app/dashboard/layout.tsx
'use client';

import * as React from 'react';
import { Home, ShoppingCart, BarChart2, Settings, LogOut, User, Archive, PackagePlus, PiggyBank, Users, Contact, Gift, MoreHorizontal, Loader2 } from 'lucide-react'; // Added Users, Contact, Gift, MoreHorizontal, Loader2
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/auth-context';
import { useCashRegister } from '@/contexts/cash-register-context';
import { StartingCashDialog } from '@/components/cash-register/starting-cash-dialog';
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
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile'; // Importar hook useIsMobile

const mainNavItems = [
  { href: '/dashboard/home', label: 'Inicio', icon: Home },
  { href: '/dashboard/create-order', label: 'Crear Pedido', icon: ShoppingCart },
  { href: '/dashboard/reports', label: 'Reporte de Ventas', icon: BarChart2 },
];

const moreNavItems = [
  { href: '/dashboard/inventory', label: 'Inventario', icon: Archive },
  { href: '/dashboard/product-settings', label: 'Ajustes Productos', icon: PackagePlus },
  { href: '/dashboard/cash-register', label: 'Gestión de Caja', icon: PiggyBank },
  { href: '/dashboard/clients', label: 'Clientes', icon: Contact },
  { href: '/dashboard/promotions', label: 'Promociones', icon: Gift },
  { href: '/dashboard/user-management', label: 'Gestión de Usuarios', icon: Users },
  { href: '/dashboard/settings', label: 'Configuraciones', icon: Settings },
];

const allNavItems = [...mainNavItems, ...moreNavItems];


interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface BottomNavBarProps {
  navItems: NavItem[];
  moreNavItems: NavItem[];
  pathname: string;
  username: string | null;
  onLogoutClick: () => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ navItems, moreNavItems, pathname, username, onLogoutClick }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
      <nav className="flex h-16 items-center justify-around">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center p-2 rounded-md text-muted-foreground transition-colors hover:text-primary',
              pathname === item.href ? 'text-primary font-semibold' : ''
            )}
            prefetch={false}
          >
            <item.icon className="h-6 w-6" />
            <span className="text-xs mt-0.5">{item.label}</span>
          </Link>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="flex flex-col items-center justify-center p-2 h-full text-muted-foreground hover:text-primary"
            >
              <span className="flex flex-col items-center justify-center">
                <MoreHorizontal className="h-6 w-6" />
                <span className="text-xs mt-0.5">Más</span>
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 mb-2" side="top" align="end">
            <div className="space-y-1">
              {username && (
                <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b mb-1">
                  <User className="inline-block mr-2 h-4 w-4" /> {username}
                </div>
              )}
              {moreNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    pathname.startsWith(item.href) ? 'bg-accent text-accent-foreground' : ''
                  )}
                  prefetch={false}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 font-normal gap-2">
                  <span className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </span>
                </Button>
              </AlertDialogTrigger>
            </div>
          </PopoverContent>
        </Popover>
      </nav>
    </div>
  );
};


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { username, logout, isLoadingAuth } = useAuth();
  const { currentSession, isSessionLoading, refreshSession } = useCashRegister();
  const router = useRouter();
  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);
  const [isStartingCashDialogOpen, setIsStartingCashDialogOpen] = React.useState(false);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!isLoadingAuth && !username) {
      router.replace('/login');
    }
  }, [username, isLoadingAuth, router]);

  React.useEffect(() => {
    if (!isLoadingAuth && username && !isSessionLoading && !currentSession) {
      console.log("[DashboardLayout] No hay sesión de caja activa, mostrando diálogo.");
      setIsStartingCashDialogOpen(true);
    } else if (currentSession) {
      console.log("[DashboardLayout] Sesión de caja activa encontrada:", currentSession.id);
      setIsStartingCashDialogOpen(false);
    }
  }, [currentSession, isSessionLoading, username, isLoadingAuth]);

  const handleLogout = () => {
    logout();
    setIsLogoutAlertOpen(false);
  };

  const handleSessionStarted = () => {
    setIsStartingCashDialogOpen(false);
    refreshSession();
  };

  if (isLoadingAuth || (!currentSession && isSessionLoading && username)) {
     return (
        <div className="flex min-h-screen w-full bg-muted/40">
            {!isMobile && (
                <aside className="fixed inset-y-0 left-0 z-10 flex w-14 flex-col border-r bg-background sm:flex">
                    <Skeleton className="h-10 w-10 rounded-full mt-4 mb-4 mx-auto" />
                    <div className="flex flex-col items-center gap-4 px-2 py-4 flex-grow">
                        {[...Array(allNavItems.length)].map((_, i) => <Skeleton key={i} className="h-8 w-8 rounded-lg" />)}
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg mt-auto mb-4 mx-auto" />
                </aside>
            )}
             <div className={cn("flex flex-col flex-1 items-center justify-center", !isMobile && "pl-14")}>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground mt-2">Cargando...</p>
            </div>
        </div>
     );
  }

  if (!username) {
    // Si no está autenticado, no mostrar nada o un loader simple antes de la redirección
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full bg-muted/40">
        {!isMobile && (
          <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
            <nav className="flex flex-col items-center gap-4 px-2 py-4 flex-grow">
              <Link
                href="/dashboard/home"
                className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-10 md:w-10 md:text-base mb-4"
              >
                <span className="text-lg font-bold">SC</span>
                <span className="sr-only">siChef POS</span>
              </Link>
              {allNavItems.map((item) => (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                        pathname.startsWith(item.href) ? 'bg-accent text-accent-foreground' : ''
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
                        <span>
                          <LogOut className="h-5 w-5" />
                          <span className="sr-only">Cerrar sesión</span>
                        </span>
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">Cerrar sesión</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro que deseas cerrar sesión?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Serás redirigido a la pantalla de inicio de sesión.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout}>Cerrar sesión</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </nav>
          </aside>
        )}

        <div className={cn(
          "flex flex-col flex-1",
          !isMobile && "pl-14", // Padding para barra lateral en escritorio
          isMobile && "pb-16"  // Padding para barra inferior en móvil
        )}>
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>

        {isMobile && (
          <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
            {/* AlertDialogTrigger is now part of the Popover in BottomNavBar */}
            <BottomNavBar
              navItems={mainNavItems}
              moreNavItems={moreNavItems}
              pathname={pathname}
              username={username}
              onLogoutClick={() => setIsLogoutAlertOpen(true)}
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro que deseas cerrar sesión?</AlertDialogTitle>
                <AlertDialogDescription>
                  Serás redirigido a la pantalla de inicio de sesión.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>Cerrar sesión</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <StartingCashDialog
        isOpen={isStartingCashDialogOpen}
        onSessionStarted={handleSessionStarted}
      />
    </TooltipProvider>
  );
}
