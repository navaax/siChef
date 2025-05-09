// src/components/dashboard/home/OrderKanbanCard.tsx
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Timer, PackageIcon, User, DollarSign, AlertTriangle } from 'lucide-react';
import type { SavedOrder } from '@/types/product-types';
import { formatDistanceToNowStrict, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale'; // Import Spanish locale for date-fns
import { cn } from '@/lib/utils';

const PREPARATION_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutos en milisegundos

export interface OrderKanbanCardProps {
  order: SavedOrder;
  onCardClick: () => void;
  onMoveToDelayed?: (orderId: string) => void; // Callback para mover a demorado
  isDelayed?: boolean; // Estado para saber si ya está demorado (controlado por el padre)
}

// Helper para formatear moneda
const formatCurrency = (amount: number | null | undefined): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function OrderKanbanCard({ order, onCardClick, onMoveToDelayed, isDelayed: initiallyDelayed }: OrderKanbanCardProps) {
  const [elapsedTime, setElapsedTime] = React.useState<string>('00:00');
  const [isTimerDelayed, setIsTimerDelayed] = React.useState(false); // Estado interno para el timer
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const isPreparing = order.status === 'pending';

  React.useEffect(() => {
    if (isPreparing) {
      const calculateTime = () => {
        const now = Date.now();
        const createdAt = new Date(order.createdAt).getTime();
        const diff = now - createdAt;

        if (diff >= 0) {
          const duration = intervalToDuration({ start: 0, end: diff });
          const minutes = String(duration.minutes || 0).padStart(2, '0');
          const seconds = String(duration.seconds || 0).padStart(2, '0');
          setElapsedTime(`${minutes}:${seconds}`);

          if (diff > PREPARATION_TIME_LIMIT_MS) {
            setIsTimerDelayed(true);
            if (onMoveToDelayed && !initiallyDelayed) { // Solo llamar si no está ya marcado como demorado por el padre
              onMoveToDelayed(order.id);
            }
          } else {
            setIsTimerDelayed(false);
          }
        }
      };

      calculateTime(); // Calcular inmediatamente
      intervalRef.current = setInterval(calculateTime, 1000); // Actualizar cada segundo

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      // Limpiar intervalo si el pedido no está en preparación
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setElapsedTime('--:--'); // Resetear tiempo si no está en preparación
      setIsTimerDelayed(false); // Resetear estado de demora
    }
  }, [order.createdAt, order.status, order.id, onMoveToDelayed, isPreparing, initiallyDelayed]);

  const displayDelayed = initiallyDelayed || isTimerDelayed;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-lg transition-shadow duration-200",
        displayDelayed && order.status === 'pending' && "border-destructive ring-2 ring-destructive/80",
        order.status === 'completed' && "opacity-80 bg-green-50 border-green-200",
        order.status === 'cancelled' && "opacity-60 bg-red-50 border-red-200 line-through"
      )}
      onClick={onCardClick}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-semibold">Pedido #{order.orderNumber}</CardTitle>
          {isPreparing && (
            <Badge variant={displayDelayed ? "destructive" : "outline"} className="text-xs px-1.5 py-0.5">
              {displayDelayed ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Timer className="h-3 w-3 mr-1" />}
              {elapsedTime}
            </Badge>
          )}
           {order.status === 'completed' && <Badge variant="secondary" className="text-xs">Completado</Badge>}
           {order.status === 'cancelled' && <Badge variant="destructive" className="text-xs">Cancelado</Badge>}
        </div>
        <CardDescription className="text-xs">
           {format(new Date(order.createdAt), 'Pp', { locale: es })}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-2 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          <User className="h-3.5 w-3.5" />
          <span>{order.customerName}</span>
        </div>
        <div className="mb-1.5">
          {order.items.slice(0, 2).map((item, index) => ( // Mostrar hasta 2 items
            <div key={index} className="flex items-center text-xs text-muted-foreground gap-1">
              {item.components?.some(c => c.slotLabel === 'Contenido') && <PackageIcon className="h-3 w-3 text-accent flex-shrink-0" />}
              <span>{item.quantity}x {item.name}</span>
            </div>
          ))}
          {order.items.length > 2 && <p className="text-xs text-muted-foreground ml-1">... y {order.items.length - 2} más</p>}
        </div>
      </CardContent>
      <CardFooter className="px-3 pb-3 pt-1 flex justify-between items-center border-t mt-1">
        <div className="flex items-center gap-1 text-sm font-medium text-accent">
          <DollarSign className="h-4 w-4" />
          <span>{formatCurrency(order.total)}</span>
        </div>
        <Badge variant={order.paymentMethod === 'cash' ? 'outline' : 'secondary'} className="text-xs capitalize">
          {order.paymentMethod}
        </Badge>
      </CardFooter>
    </Card>
  );
}
