// src/app/dashboard/home/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Pencil, XCircle, PackageIcon, TimerIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { SavedOrder, SavedOrderItem, SavedOrderItemComponent } from '@/types/product-types';
import { useToast } from '@/hooks/use-toast';
import { OrderKanbanColumn } from '@/components/dashboard/home/OrderKanbanColumn';
import type { OrderKanbanCardProps } from '@/components/dashboard/home/OrderKanbanCard'; // Import type

// Helper to format currency
const formatCurrency = (amount: number | null | undefined): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

// Helper to get status badge variant
const getStatusVariant = (status: SavedOrder['status']): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
  switch (status) {
    case 'completed': return 'secondary';
    case 'cancelled': return 'destructive';
    case 'pending':
    default: return 'default';
  }
};

type KanbanColumnId = 'preparing' | 'delayed' | 'delivered';

interface KanbanColumn {
  id: KanbanColumnId;
  title: string;
  icon: React.ElementType;
  orders: OrderKanbanCardProps[];
}

export default function HomePage() {
  const [allOrders, setAllOrders] = useState<SavedOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SavedOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { toast } = useToast();

  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([
    { id: 'preparing', title: 'En Preparación', icon: TimerIcon, orders: [] },
    { id: 'delayed', title: 'Con Demora', icon: AlertTriangle, orders: [] },
    { id: 'delivered', title: 'Entregado', icon: CheckCircle2, orders: [] },
  ]);

  // Load orders from localStorage on mount
  useEffect(() => {
    const storedOrders = localStorage.getItem('siChefOrders');
    if (storedOrders) {
      try {
        const parsedOrders: SavedOrder[] = JSON.parse(storedOrders).map((order: any) => ({
            ...order,
            createdAt: new Date(order.createdAt),
            items: order.items?.map((item: any) => ({
                id: item.id || 'unknown',
                name: item.name || 'Unknown Item',
                quantity: typeof item.quantity === 'number' ? item.quantity : 0,
                price: typeof item.price === 'number' ? item.price : 0,
                totalItemPrice: typeof item.totalItemPrice === 'number' ? item.totalItemPrice : 0,
                components: Array.isArray(item.components) ? item.components : [],
            })) || [],
             subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0,
             total: typeof order.total === 'number' ? order.total : 0,
             status: ['pending', 'completed', 'cancelled'].includes(order.status) ? order.status : 'pending',
             paymentMethod: ['cash', 'card'].includes(order.paymentMethod) ? order.paymentMethod : 'card',
        })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by most recent
        setAllOrders(parsedOrders);
      } catch (error) {
         console.error("Fallo al parsear pedidos desde localStorage:", error);
         localStorage.removeItem('siChefOrders'); // Limpiar datos potencialmente corruptos
          toast({ title: "Error al Cargar Pedidos", description: "No se pudieron cargar los datos de ventas anteriores. El almacenamiento podría estar corrupto.", variant: "destructive" });
      }
    }
  }, [toast]);

  const handleMoveToDelayed = useCallback((orderId: string) => {
    setKanbanColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({ ...col, orders: [...col.orders] }));
      const preparingCol = newColumns.find(col => col.id === 'preparing');
      const delayedCol = newColumns.find(col => col.id === 'delayed');

      if (preparingCol && delayedCol) {
        const orderIndex = preparingCol.orders.findIndex(o => o.order.id === orderId);
        if (orderIndex > -1) {
          const [orderToMove] = preparingCol.orders.splice(orderIndex, 1);
          // Ensure orderToMove exists and is not already in delayed to prevent duplicates
          if (orderToMove && !delayedCol.orders.some(o => o.order.id === orderToMove.order.id)) {
             // Update the internal state of the order if necessary (e.g., add a 'isDelayed' flag for styling)
             // For now, moving it to the column is the primary action.
            delayedCol.orders.unshift({ ...orderToMove, isDelayed: true }); // Add to the top of delayed
            toast({ title: "Pedido Demorado", description: `Pedido #${orderToMove.order.orderNumber} movido a 'Con Demora'.`, variant: "default" });
          }
        }
      }
      return newColumns;
    });
  }, [toast]);


  // Distribute orders into Kanban columns
  useEffect(() => {
    const newPreparing: OrderKanbanCardProps[] = [];
    const newDelayed: OrderKanbanCardProps[] = [];
    const newDelivered: OrderKanbanCardProps[] = [];

    allOrders.forEach(order => {
      if (order.status === 'cancelled') {
        // Optionally handle cancelled orders, e.g., filter them out or put in a separate list
        return;
      }

      const cardProps: OrderKanbanCardProps = {
        order,
        onCardClick: () => handleRowClick(order),
        // onMoveToDelayed: handleMoveToDelayed, // Pass this down
        isDelayed: false // Initial state
      };

      if (order.status === 'completed') {
        newDelivered.push(cardProps);
      } else if (order.status === 'pending') {
        // Check if it should already be in delayed based on current logic
        // For now, all pending start in 'preparing' and move via handleMoveToDelayed
        const fifteenMinutes = 15 * 60 * 1000;
        const timeSinceCreation = Date.now() - new Date(order.createdAt).getTime();
        if (timeSinceCreation > fifteenMinutes) {
            // Check if it's already manually moved by inspecting existing 'delayed' column
            // This avoids re-classifying if already in 'delayed' from a previous render
            const isAlreadyDelayed = kanbanColumns.find(c => c.id === 'delayed')?.orders.some(o => o.order.id === order.id);
            if (isAlreadyDelayed) {
                 newDelayed.push({ ...cardProps, isDelayed: true});
            } else {
                 // This logic primarily for initial load.
                 // Active timers on cards will call handleMoveToDelayed for transitions.
                 newPreparing.push(cardProps); // Start in preparing, timer will move it
            }
        } else {
            newPreparing.push(cardProps);
        }
      }
    });

    setKanbanColumns(prevColumns =>
      prevColumns.map(col => {
        if (col.id === 'preparing') return { ...col, orders: newPreparing.map(o => ({...o, onMoveToDelayed: () => handleMoveToDelayed(o.order.id) })) };
        if (col.id === 'delayed') return { ...col, orders: newDelayed }; // Orders moved here will already have isDelayed true
        if (col.id === 'delivered') return { ...col, orders: newDelivered };
        return col;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders, handleMoveToDelayed]); // Removed kanbanColumns from deps to avoid loop with its own update


  const handleRowClick = (order: SavedOrder) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleEditOrder = (orderId: string) => {
    console.log(`Editando pedido: ${orderId}`);
    toast({
        title: "Función de Edición No Implementada",
        description: "Editar pedidos completados requiere carga de estado compleja y manejo de inventario.",
        variant: "default",
    });
    setIsSheetOpen(false);
  };

  const handleCancelOrder = async (orderToCancel: SavedOrder) => {
    if (isCancelling) return;

    if (!confirm(`¿Estás seguro que quieres cancelar el pedido #${orderToCancel.orderNumber}? Esta acción no se puede deshacer y el inventario NO se repondrá automáticamente.`)) {
        return;
    }

    setIsCancelling(true);
    toast({ title: "Cancelando Pedido...", description: `Procesando cancelación para el pedido #${orderToCancel.orderNumber}` });

    try {
        console.warn(`Pedido ${orderToCancel.id} cancelado. El inventario NO se repone automáticamente.`);
        toast({ title: "Inventario No Repuesto", description: `Puede ser necesario un ajuste manual del inventario para el pedido cancelado #${orderToCancel.orderNumber}.`, variant: "default" });

        setAllOrders(prevOrders => {
            const updatedOrders = prevOrders.map(order =>
                order.id === orderToCancel.id ? { ...order, status: 'cancelled' } : order
            );
            localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));
            return updatedOrders;
        });

        if (selectedOrder && selectedOrder.id === orderToCancel.id) {
            setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
        }

        toast({ title: "Pedido Cancelado", description: `El pedido #${orderToCancel.orderNumber} ha sido marcado como cancelado.`, variant: "destructive" });
    } catch (error) {
        console.error("Error cancelando pedido:", error);
        toast({ title: "Falló la Cancelación", description: "Ocurrió un error mientras se cancelaba el pedido.", variant: "destructive" });
    } finally {
        setIsCancelling(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col shadow-md">
        <CardHeader>
          <CardTitle>Panel de Pedidos Activos</CardTitle>
          <CardDescription>Visualiza y gestiona el estado de los pedidos.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-x-auto p-4">
          <div className="flex gap-4 min-w-max h-full">
            {kanbanColumns.map(column => (
              <OrderKanbanColumn
                key={column.id}
                title={column.title}
                icon={column.icon}
                orders={column.orders}
                columnId={column.id}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sheet para Detalles del Pedido */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-lg w-[90vw] md:w-[450px] p-0 flex flex-col">
           {selectedOrder ? (
            <>
            <ScrollArea className="flex-grow">
              <div className="p-6">
                <SheetHeader className="mb-4">
                  <SheetTitle>Detalles del Pedido: #{selectedOrder.orderNumber}</SheetTitle>
                  <SheetDescription>
                     ID: {selectedOrder.id} <br/>
                     Cliente: {selectedOrder.customerName} | {format(selectedOrder.createdAt, 'Pp')}
                  </SheetDescription>
                </SheetHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <h4 className="text-md font-semibold mb-2">Items Pedidos</h4>
                  {selectedOrder.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="text-sm border-b pb-3 mb-3 last:border-b-0 last:mb-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium flex items-center gap-1">
                          {item.components?.some(c => c.slotLabel === 'Contenido') && <PackageIcon className="h-4 w-4 text-accent flex-shrink-0" title="Paquete"/>}
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-medium">{formatCurrency(item.totalItemPrice)}</span>
                      </div>
                       <div className="text-xs text-muted-foreground mb-1.5">
                           (Base: {formatCurrency(item.price)} c/u)
                       </div>
                      {item.components && item.components.length > 0 && (
                        <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                           <span className="font-medium text-foreground">
                             {item.components.some(c => c.slotLabel === 'Contenido') ? 'Contenido / Modificadores:' : 'Modificadores:'}
                            </span>
                           <ul className="list-disc list-inside pl-2">
                            {item.components.map((comp, compIdx) => (
                                <li key={compIdx}>
                                     {comp.slotLabel && comp.slotLabel !== 'Mod' && comp.slotLabel !== 'Contenido' && `[${comp.slotLabel}] `}
                                     {comp.name}
                                </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div>
                   <div className="flex justify-between text-sm mt-1">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between font-semibold mt-1 text-base">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                   <div className="flex justify-between text-sm mt-1">
                    <span>Forma de Pago:</span>
                    <span className="capitalize">{selectedOrder.paymentMethod}</span>
                  </div>
                  {selectedOrder.paymentMethod === 'cash' && selectedOrder.paidAmount != null && (
                     <>
                       <div className="flex justify-between text-sm mt-1">
                         <span>Monto Pagado:</span>
                         <span>{formatCurrency(selectedOrder.paidAmount)}</span>
                       </div>
                       {(selectedOrder.changeGiven ?? 0) > 0 && (
                            <div className="flex justify-between text-sm mt-1 text-accent font-medium">
                                <span>Cambio Entregado:</span>
                                <span>{formatCurrency(selectedOrder.changeGiven)}</span>
                            </div>
                       )}
                     </>
                   )}
                   <div className="flex justify-between text-sm mt-1 items-center">
                      <span>Estado:</span>
                      <Badge variant={getStatusVariant(selectedOrder.status)} className="capitalize">
                        {selectedOrder.status}
                      </Badge>
                    </div>
                </div>
              </div>
            </ScrollArea>

            {selectedOrder.status !== 'cancelled' && (
               <div className="p-6 border-t mt-auto bg-muted/30">
                 <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditOrder(selectedOrder!.id)} disabled>
                        <Pencil className="mr-2 h-4 w-4" /> Editar (Deshabilitado)
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(selectedOrder!)} disabled={isCancelling}>
                        <XCircle className="mr-2 h-4 w-4" /> {isCancelling ? 'Cancelando...' : 'Cancelar Pedido'}
                    </Button>
                 </div>
                 <p className="text-xs text-muted-foreground mt-2 text-right">Nota: Cancelar no repone automáticamente el inventario.</p>
                </div>
            )}
             {selectedOrder.status === 'cancelled' && (
                <div className="p-6 border-t mt-auto bg-destructive/10 text-center">
                    <p className="text-sm font-medium text-destructive">Este pedido ha sido cancelado.</p>
                 </div>
             )}
            </>
           ) : (
                <div className="p-6 text-center text-muted-foreground flex items-center justify-center h-full">Selecciona un pedido para ver detalles.</div>
           )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
