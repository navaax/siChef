
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
import { Pencil, XCircle, PackageIcon, TimerIcon, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { SavedOrder, SavedOrderItem, SavedOrderItemComponent, Product, InventoryItem } from '@/types/product-types'; // Added Product, InventoryItem
import { useToast } from '@/hooks/use-toast';
import { OrderKanbanColumn } from '@/components/dashboard/home/OrderKanbanColumn';
import type { OrderKanbanCardProps } from '@/components/dashboard/home/OrderKanbanCard';
import { getProductById } from '@/services/product-service'; // Para reposición de inventario
import { adjustInventoryStock, getInventoryItems } from '@/services/inventory-service'; // Para reposición de inventario

// Helper to format currency
const formatCurrency = (amount: number | null | undefined): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(0);
    }
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
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
  const [isProcessingAction, setIsProcessingAction] = useState(false); // Combina isCancelling y isUpdatingStatus
  const { toast } = useToast();

  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([
    { id: 'preparing', title: 'En Preparación', icon: TimerIcon, orders: [] },
    { id: 'delayed', title: 'Con Demora', icon: AlertTriangle, orders: [] },
    { id: 'delivered', title: 'Entregado', icon: CheckCircle2, orders: [] },
  ]);
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryItem>>(new Map()); // Needed for inventory names

  // Load orders and inventory from localStorage/service on mount
  useEffect(() => {
    async function loadInitialData() {
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
            })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            setAllOrders(parsedOrders);
          } catch (error) {
             console.error("Fallo al parsear pedidos desde localStorage:", error);
             localStorage.removeItem('siChefOrders');
              toast({ title: "Error al Cargar Pedidos", description: "No se pudieron cargar los datos de ventas anteriores.", variant: "destructive" });
          }
        }
        try {
            const fetchedInventory = await getInventoryItems();
            const invMap = new Map<string, InventoryItem>();
            fetchedInventory.forEach(item => invMap.set(item.id, item));
            setInventoryMap(invMap);
        } catch (error) {
            toast({ title: "Error al Cargar Inventario", description: "No se pudo cargar la información de inventario.", variant: "destructive" });
        }
    }
    loadInitialData();
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
          if (orderToMove && !delayedCol.orders.some(o => o.order.id === orderToMove.order.id)) {
            delayedCol.orders.unshift({ ...orderToMove, isDelayed: true });
            toast({ title: "Pedido Demorado", description: `Pedido #${orderToMove.order.orderNumber} movido a 'Con Demora'.`, variant: "default" });
          }
        }
      }
      return newColumns;
    });
  }, [toast]);


  useEffect(() => {
    const newPreparing: OrderKanbanCardProps[] = [];
    const newDelayed: OrderKanbanCardProps[] = [];
    const newDelivered: OrderKanbanCardProps[] = [];

    allOrders.forEach(order => {
      if (order.status === 'cancelled') {
        return;
      }
      const isCurrentlyInDelayedVisualColumn = kanbanColumns.find(col => col.id === 'delayed')?.orders.some(o => o.order.id === order.id);
      const cardProps: OrderKanbanCardProps = {
        order,
        onCardClick: () => handleRowClick(order),
        onMoveToDelayed: () => handleMoveToDelayed(order.id),
        isDelayed: isCurrentlyInDelayedVisualColumn || false,
      };

      if (order.status === 'completed') {
        newDelivered.push(cardProps);
      } else if (order.status === 'pending') {
        if (isCurrentlyInDelayedVisualColumn) {
            newDelayed.push({ ...cardProps, isDelayed: true });
        } else {
            newPreparing.push(cardProps);
        }
      }
    });

    setKanbanColumns(prevColumns =>
      prevColumns.map(col => {
        if (col.id === 'preparing') return { ...col, orders: newPreparing };
        if (col.id === 'delayed') return { ...col, orders: newDelayed };
        if (col.id === 'delivered') return { ...col, orders: newDelivered };
        return col;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders, handleMoveToDelayed]);


  const handleRowClick = (order: SavedOrder) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleEditOrder = (orderId: string) => {
    console.log(`Editando pedido: ${orderId}`);
    toast({
        title: "Función de Edición No Implementada",
        description: "Editar pedidos requiere manejo de estado complejo y de inventario.",
        variant: "default",
    });
    setIsSheetOpen(false);
  };

  const handleCancelOrder = async (orderToCancel: SavedOrder) => {
    if (isProcessingAction) return;

    let confirmationMessage = `¿Estás seguro que quieres cancelar el pedido #${orderToCancel.orderNumber}?`;
    let shouldRestock = false;

    if (orderToCancel.status === 'pending') {
        confirmationMessage += " Esta acción repondrá el inventario asociado.";
        shouldRestock = true;
    } else if (orderToCancel.status === 'completed') {
        confirmationMessage += " Esta es una anulación. El inventario NO se repondrá automáticamente.";
    } else {
        toast({ title: "Acción no permitida", description: "Este pedido no se puede cancelar en su estado actual.", variant: "default" });
        return;
    }

    if (!confirm(confirmationMessage)) {
        return;
    }

    setIsProcessingAction(true);
    toast({ title: "Procesando...", description: `Cancelando pedido #${orderToCancel.orderNumber}` });

    try {
        if (shouldRestock) {
            console.log(`[HomePage] Reponiendo inventario para pedido cancelado ${orderToCancel.id}`);
            const inventoryAdjustments: Record<string, { change: number, name: string }> = {};
            let productDetailsMap = new Map<string, Product>();

            // Collect all product IDs from the order to fetch details in batch
            const allProductIdsInOrder = new Set<string>();
            orderToCancel.items.forEach(item => {
                allProductIdsInOrder.add(item.id); // ID of the base product/package
                item.components.forEach(comp => {
                    // Assuming comp.name is the product name. We need a way to map this back to a product ID
                    // This part is tricky because SavedOrderItemComponent only has `name`.
                    // For accurate restocking, we need the product ID of each component.
                    // This structure is insufficient for easy restocking.
                    // A temporary simplification: We'll assume components don't consume separate inventory for now.
                    // TODO: Revisit SavedOrder structure if component-level restocking is needed.
                });
            });
            
            // Fetch details for base products/packages in the order
            const productFetchPromises = Array.from(allProductIdsInOrder).map(id => getProductById(id).catch(() => null));
            const fetchedProducts = (await Promise.all(productFetchPromises)).filter(p => p !== null) as Product[];
            fetchedProducts.forEach(p => productDetailsMap.set(p.id, p));

            for (const orderItem of orderToCancel.items) {
                const itemDetails = productDetailsMap.get(orderItem.id);
                if (itemDetails && itemDetails.inventory_item_id && itemDetails.inventory_consumed_per_unit) {
                    const invItemId = itemDetails.inventory_item_id;
                    // POSITIVE change because we are RESTOCKING
                    const change = +(itemDetails.inventory_consumed_per_unit * orderItem.quantity);
                    const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Item de Inventario' };
                    inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                }
                // TODO: Iterate orderItem.components to restock modifiers if they consume inventory
                // This requires components to have product_id and inventory_consumed_per_unit
            }

            const adjustmentPromises: Promise<void>[] = [];
            for (const [itemId, { change }] of Object.entries(inventoryAdjustments)) {
                if (change !== 0) {
                    adjustmentPromises.push(adjustInventoryStock(itemId, change));
                }
            }
            await Promise.all(adjustmentPromises);
             // Optionally re-fetch inventoryMap if displayed directly on this page, or rely on context/next load
            const newInvMap = new Map(inventoryMap);
            for (const [itemId, { change }] of Object.entries(inventoryAdjustments)) {
                const currentItem = newInvMap.get(itemId);
                if (currentItem) {
                    newInvMap.set(itemId, { ...currentItem, current_stock: currentItem.current_stock + change });
                }
            }
            setInventoryMap(newInvMap);
            console.log(`[HomePage] Inventario repuesto para pedido ${orderToCancel.id}`);
        }

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

        toast({ title: "Pedido Cancelado", description: `El pedido #${orderToCancel.orderNumber} ha sido marcado como cancelado. ${shouldRestock ? 'Inventario repuesto.' : 'Inventario NO repuesto.'}`, variant: "destructive" });
    } catch (error) {
        console.error("Error cancelando pedido:", error);
        toast({ title: "Falló la Cancelación", description: `Ocurrió un error: ${error instanceof Error ? error.message : 'Error desconocido'}.`, variant: "destructive" });
    } finally {
        setIsProcessingAction(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: SavedOrder['status']) => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    toast({ title: "Actualizando Estado...", description: `Cambiando estado del pedido a '${newStatus}'.`});

    try {
        setAllOrders(prevOrders => {
            const updatedOrders = prevOrders.map(order =>
                order.id === orderId ? { ...order, status: newStatus } : order
            );
            localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));
            return updatedOrders;
        });

        if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
        }
        if (newStatus === 'completed' || newStatus === 'cancelled') {
            setIsSheetOpen(false);
        }
        toast({ title: "Estado Actualizado", description: `El pedido #${selectedOrder?.orderNumber || orderId} ahora está '${newStatus}'.` });
    } catch (error) {
        console.error("Error actualizando estado del pedido:", error);
        toast({ title: "Falló la Actualización", description: "Ocurrió un error al cambiar el estado del pedido.", variant: "destructive" });
    } finally {
        setIsProcessingAction(false);
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
                                     {comp.servingStyle && comp.servingStyle !== "Normal" && ` (${comp.servingStyle})`}
                                     {comp.extraCost && comp.extraCost > 0 && ` (+${formatCurrency(comp.extraCost)})`}
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
                 <div className="flex flex-col sm:flex-row justify-end gap-2">
                    {selectedOrder.status === 'pending' && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleUpdateOrderStatus(selectedOrder!.id, 'completed')}
                            disabled={isProcessingAction}
                            className="flex-grow sm:flex-grow-0"
                        >
                            {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Marcar como Entregado
                        </Button>
                    )}
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditOrder(selectedOrder!.id)} 
                        disabled={isProcessingAction || selectedOrder.status === 'completed' || selectedOrder.status === 'cancelled'}
                        className="flex-grow sm:flex-grow-0"
                        title={selectedOrder.status !== 'pending' ? "Solo se pueden editar pedidos pendientes" : "Editar Pedido"}
                    >
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    {(selectedOrder.status === 'pending' || selectedOrder.status === 'completed') && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelOrder(selectedOrder!)}
                            disabled={isProcessingAction}
                            className="flex-grow sm:flex-grow-0"
                        >
                            {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                            {selectedOrder.status === 'completed' ? 'Anular Pedido' : 'Cancelar Pedido'}
                        </Button>
                    )}
                 </div>
                 {(selectedOrder.status === 'pending' || selectedOrder.status === 'completed') && (
                   <p className="text-xs text-muted-foreground mt-2 text-right">
                    {selectedOrder.status === 'pending' ? 'Cancelar repone inventario.' : 'Anular NO repone inventario.'}
                   </p>
                 )}
                </div>
            )}
             {selectedOrder.status === 'cancelled' && (
                <div className="p-6 border-t mt-auto bg-destructive/10 text-center">
                    <p className="text-sm font-medium text-destructive">Este pedido fue cancelado.</p>
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

