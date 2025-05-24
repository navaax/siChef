// src/app/dashboard/layout.tsx
'use client';

import * as React from 'react';
import { Home, ShoppingCart, BarChart2, Settings, LogOut, User, Archive, PackagePlus, PiggyBank, Users } from 'lucide-react'; // Added Users
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/auth-context';
import { useCashRegister } from '@/contexts/cash-register-context'; // Importar hook de caja
import { StartingCashDialog } from '@/components/cash-register/starting-cash-dialog'; // Importar diálogo
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
import { Skeleton } from '@/components/ui/skeleton'; // Para estado de carga

const navItems = [
  { href: '/dashboard/home', label: 'Inicio', icon: Home },
  { href: '/dashboard/create-order', label: 'Crear Pedidos', icon: ShoppingCart },
  { href: '/dashboard/inventory', label: 'Inventario', icon: Archive },
  { href: '/dashboard/product-settings', label: 'Ajustes Productos', icon: PackagePlus },
  { href: '/dashboard/reports', label: 'Reporte de Ventas', icon: BarChart2 },
  { href: '/dashboard/cash-register', label: 'Gestión de Caja', icon: PiggyBank },
  { href: '/dashboard/user-management', label: 'Gestión de Usuarios', icon: Users }, // Nueva sección
  { href: '/dashboard/settings', label: 'Configuraciones', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { username, logout } = useAuth();
  const { currentSession, isSessionLoading, refreshSession } = useCashRegister(); // Obtener estado de caja
  const router = useRouter();
  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);
  const [isStartingCashDialogOpen, setIsStartingCashDialogOpen] = React.useState(false);

  // Verificar autenticación
  React.useEffect(() => {
    if (!username) {
      router.replace('/login');
    }
  }, [username, router]);

  // Verificar sesión de caja activa
  React.useEffect(() => {
    // Solo mostrar el diálogo si la sesión ha terminado de cargar y NO hay sesión activa
    if (!isSessionLoading && !currentSession) {
       console.log("[DashboardLayout] No hay sesión de caja activa, mostrando diálogo.");
       setIsStartingCashDialogOpen(true);
    } else if (currentSession) {
       console.log("[DashboardLayout] Sesión de caja activa encontrada:", currentSession.id);
       setIsStartingCashDialogOpen(false); // Asegurarse de que esté cerrado si hay sesión
    }
  }, [currentSession, isSessionLoading]);

  const handleLogout = () => {
    logout();
    // No es necesario redirigir aquí, useEffect se encargará
    setIsLogoutAlertOpen(false); // Cerrar el diálogo
  };

  const handleSessionStarted = () => {
    setIsStartingCashDialogOpen(false);
    refreshSession(); // Refrescar el estado del contexto de caja
  };

  // Prevenir renderizado si no está autenticado o la sesión de caja está cargando (estado inicial)
  if (!username || (isSessionLoading && !currentSession)) {
     // Mostrar un esqueleto o spinner mientras carga la sesión de caja por primera vez
     return (
        <div className="flex min-h-screen w-full bg-muted/40">
            <aside className="fixed inset-y-0 left-0 z-10 flex w-14 flex-col border-r bg-background sm:flex">
                <Skeleton className="h-10 w-10 rounded-full mt-4 mb-4 mx-auto" />
                <div className="flex flex-col items-center gap-4 px-2 py-4 flex-grow">
                     {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-8 rounded-lg" />)} {/* Ajustado a 6 por el nuevo item */}
                </div>
                <Skeleton className="h-8 w-8 rounded-lg mt-auto mb-4 mx-auto" />
            </aside>
             <div className="flex flex-col flex-1 pl-14 items-center justify-center">
                <p className="text-muted-foreground">Cargando...</p>
            </div>
        </div>
     );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full bg-muted/40">
        {/* Navbar Vertical */}
        <aside className="fixed inset-y-0 left-0 z-10 flex w-14 flex-col border-r bg-background sm:flex">
          <nav className="flex flex-col items-center gap-4 px-2 py-4 flex-grow">
             <Link
              href="/dashboard/home"
              className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-10 md:w-10 md:text-base mb-4" /* Tamaño ajustado */
            >
              <span className="text-lg font-bold">SC</span> {/* Tamaño ajustado */}
              <span className="sr-only">siChef POS</span>
            </Link>
            {navItems.map((item) => (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                      pathname.startsWith(item.href) ? 'bg-accent text-accent-foreground' : '' // Usar startsWith para estado activo
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
                       <span className="sr-only">Cerrar sesión</span>
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

        {/* Área de Contenido Principal */}
        <div className="flex flex-col flex-1 pl-14"> {/* pl ajustado para ancho de navbar */}
           {/* Se puede añadir Header aquí si se necesita */}
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>

      {/* Diálogo para Iniciar Caja */}
      <StartingCashDialog
        isOpen={isStartingCashDialogOpen}
        onSessionStarted={handleSessionStarted}
      />
    </TooltipProvider>
  );
}
