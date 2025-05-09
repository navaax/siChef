// src/components/dashboard/home/OrderKanbanColumn.tsx
'use client';

import * as React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OrderKanbanCard, type OrderKanbanCardProps } from './OrderKanbanCard';
import { cn } from '@/lib/utils';

interface OrderKanbanColumnProps {
  title: string;
  icon: React.ElementType;
  orders: OrderKanbanCardProps[];
  columnId: 'preparing' | 'delayed' | 'delivered';
}

export function OrderKanbanColumn({ title, icon: Icon, orders, columnId }: OrderKanbanColumnProps) {
  return (
    <div className={cn(
      "flex flex-col w-80 min-w-80 h-full bg-muted/60 rounded-lg shadow",
      columnId === 'delayed' && "border-2 border-destructive/50"
    )}>
      <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-muted/80 backdrop-blur-sm rounded-t-lg z-10">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            "h-5 w-5",
            columnId === 'preparing' && "text-blue-500",
            columnId === 'delayed' && "text-destructive",
            columnId === 'delivered' && "text-green-500"
          )} />
          <h3 className="font-semibold text-md">{title}</h3>
        </div>
        <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-background text-foreground shadow-sm">
          {orders.length}
        </span>
      </div>
      <ScrollArea className="flex-grow p-3">
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No hay pedidos en esta sección.
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map(cardProps => (
              <OrderKanbanCard
                key={cardProps.order.id}
                order={cardProps.order}
                onCardClick={cardProps.onCardClick}
                onMoveToDelayed={cardProps.onMoveToDelayed}
                isDelayed={cardProps.isDelayed}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
