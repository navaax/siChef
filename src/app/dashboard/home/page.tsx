// src/app/dashboard/home/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Importar useRouter
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"; // SheetFooter importado
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Pencil, XCircle, PackageIcon, TimerIcon, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { SavedOrder, SavedOrderItem, SavedOrderItemComponent, Product, InventoryItem } from '@/types/product-types';
import { useToast } from '@/hooks/use-toast';
import { OrderKanbanColumn } from '@/components/dashboard/home/OrderKanbanColumn';
import type { OrderKanbanCardProps } from '@/components/dashboard/home/OrderKanbanCard';
import { getProductById } from '@/services/product-service';
import { adjustInventoryStock, getInventoryItems } from '@/services/inventory-service';
import { useAuth } from '@/contexts/auth-context'; // Importar useAuth
import { Dialog, DialogContent, DialogDescription, DialogFooter as DialogPrimitiveFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"; // Dialog para cancelación
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

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
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const { toast } = useToast();
  const { username } = useAuth(); // Obtener usuario actual
  const router = useRouter(); // Obtener router

  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([
    { id: 'preparing', title: 'En Preparación', icon: TimerIcon, orders: [] },
    { id: 'delayed', title: 'Con Demora', icon: AlertTriangle, orders: [] },
    { id: 'delivered', title: 'Entregado', icon: CheckCircle2, orders: [] },
  ]);
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryItem>>(new Map());

  // Estado para el diálogo de cancelación
  const [isCancelOrderDialogOpen, setIsCancelOrderDialogOpen] = useState(false);
  const [orderToCancelForDialog, setOrderToCancelForDialog] = useState<SavedOrder | null>(null);
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');
  const [authorizationPinInput, setAuthorizationPinInput] = useState('');


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
                 cancellationDetails: order.cancellationDetails // Cargar detalles de cancelación si existen
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
    if (!selectedOrder) {
      toast({ title: "Error", description: "No hay pedido seleccionado para editar.", variant: "destructive" });
      return;
    }
    console.log(`[HomePage] handleEditOrder llamado para orderId: ${orderId}, estado: ${selectedOrder.status}`);

    if (selectedOrder.status !== 'pending') {
      toast({
        title: "No Editable",
        description: `Los pedidos con estado '${selectedOrder.status}' no pueden ser editados.`,
        variant: "default"
      });
      console.log(`[HomePage] Pedido ${orderId} no editable, estado: ${selectedOrder.status}`);
      return;
    }

    // Navegar a la página de creación de pedidos con el ID del pedido a editar
    const editUrl = `/dashboard/create-order?editOrderId=${orderId}`;
    console.log(`[HomePage] Navegando a: ${editUrl}`);
    router.push(editUrl);
    setIsSheetOpen(false); // Cerrar el sheet después de iniciar la edición
  };

  // Abre el diálogo de cancelación
  const triggerCancelOrderDialog = (orderToCancel: SavedOrder) => {
    if (orderToCancel.status === 'cancelled') {
        toast({ title: "Pedido ya Cancelado", description: "Este pedido ya ha sido cancelado.", variant: "default" });
        return;
    }
    setOrderToCancelForDialog(orderToCancel);
    setCancellationReasonInput('');
    setAuthorizationPinInput('');
    setIsCancelOrderDialogOpen(true);
    setIsSheetOpen(false); // Cerrar el sheet de detalles si estaba abierto
  };


  const handleConfirmCancellation = async () => {
    if (!orderToCancelForDialog || !username) {
        toast({title: "Error", description: "No se seleccionó un pedido para cancelar o el usuario no está identificado.", variant: "destructive"});
        return;
    }
    if (!cancellationReasonInput.trim()) {
        toast({title: "Motivo Requerido", description: "Por favor, introduce un motivo para la cancelación.", variant: "destructive"});
        return;
    }
    if (authorizationPinInput.length < 4) { // Simulación de PIN
        toast({title: "PIN Inválido", description: "Por favor, introduce un PIN de autorización válido (mín. 4 dígitos).", variant: "destructive"});
        return;
    }

    setIsProcessingAction(true);
    toast({ title: "Procesando...", description: `Cancelando pedido #${orderToCancelForDialog.orderNumber}` });

    // Determinar si se debe reponer inventario basado en el estado *antes* de la cancelación
    const shouldRestock = orderToCancelForDialog.status === 'pending';

    try {
        if (shouldRestock) {
            console.log(`[HomePage] Reponiendo inventario para pedido cancelado ${orderToCancelForDialog.id} (estado: ${orderToCancelForDialog.status})`);
            const inventoryAdjustments: Record<string, { change: number, name: string }> = {};
            let productDetailsMap = new Map<string, Product>();

            const allProductIdsInOrder = new Set<string>();
            orderToCancelForDialog.items.forEach(item => {
                allProductIdsInOrder.add(item.id); // ID del producto o paquete base
                item.components.forEach(comp => {
                   // Para la reposición, necesitamos el ID del producto original del componente (modificador)
                   // Si `comp.productId` está disponible, úsalo.
                    if (comp.productId) {
                        allProductIdsInOrder.add(comp.productId);
                    }
                });
            });
            
            const productFetchPromises = Array.from(allProductIdsInOrder).map(id => getProductById(id).catch(() => null));
            const fetchedProducts = (await Promise.all(productFetchPromises)).filter(p => p !== null) as Product[];
            fetchedProducts.forEach(p => productDetailsMap.set(p.id, p));

            for (const orderItem of orderToCancelForDialog.items) {
                const itemDetails = productDetailsMap.get(orderItem.id);
                if (itemDetails && itemDetails.inventory_item_id && itemDetails.inventory_consumed_per_unit) {
                    const invItemId = itemDetails.inventory_item_id;
                    const change = +(itemDetails.inventory_consumed_per_unit * orderItem.quantity); // Positivo para reponer
                    const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Item de Inventario' };
                    inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                }
                
                // Reponer inventario de modificadores
                for (const component of orderItem.components) {
                    if (component.productId && component.slotLabel !== 'Contenido') { // Asegurar que es un modificador con ID
                        const modDetails = productDetailsMap.get(component.productId);
                        if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                            const invItemId = modDetails.inventory_item_id;
                             // Los modificadores se consumen una vez por cada *unidad* del producto principal al que están asociados.
                            const change = +(modDetails.inventory_consumed_per_unit * orderItem.quantity); // Positivo para reponer
                            const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Item de Inventario' };
                            inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                        }
                    }
                }
            }

            const adjustmentPromises: Promise<void>[] = [];
            for (const [itemId, { change }] of Object.entries(inventoryAdjustments)) {
                if (change !== 0) {
                    console.log(`[HomePage] Ajustando inventario para ${itemId}: ${change}`);
                    adjustmentPromises.push(adjustInventoryStock(itemId, change));
                }
            }
            await Promise.all(adjustmentPromises);
            console.log(`[HomePage] Inventario repuesto para pedido ${orderToCancelForDialog.id}`);
             // Actualizar inventario local si es necesario (o confiar en la próxima carga)
             const newInvMap = new Map(inventoryMap);
             Object.entries(inventoryAdjustments).forEach(([itemId, { change }]) => {
                const currentInvItem = newInvMap.get(itemId);
                if (currentInvItem) {
                    newInvMap.set(itemId, { ...currentInvItem, current_stock: currentInvItem.current_stock + change });
                }
             });
             setInventoryMap(newInvMap);
        } else {
             console.log(`[HomePage] NO se repone inventario para pedido cancelado ${orderToCancelForDialog.id} (estado: ${orderToCancelForDialog.status})`);
        }

        const updatedCancellationDetails = {
            reason: cancellationReasonInput,
            cancelledBy: username || 'Desconocido', // Usar 'Desconocido' si username es null
            cancelledAt: new Date().toISOString(),
            authorizedPin: authorizationPinInput, // Guardar el PIN ingresado para registro
        };

        setAllOrders(prevOrders => {
            const updatedOrders = prevOrders.map(order =>
                order.id === orderToCancelForDialog.id ? { ...order, status: 'cancelled', cancellationDetails: updatedCancellationDetails } : order
            );
            localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));
            return updatedOrders;
        });

        if (selectedOrder && selectedOrder.id === orderToCancelForDialog.id) {
            setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled', cancellationDetails: updatedCancellationDetails } : null);
        }

        toast({ title: "Pedido Cancelado", description: `El pedido #${orderToCancelForDialog.orderNumber} ha sido cancelado. ${shouldRestock ? 'Inventario repuesto.' : 'Inventario NO repuesto.'}`, variant: "destructive" });
    } catch (error) {
        console.error("Error cancelando pedido:", error);
        toast({ title: "Falló la Cancelación", description: `Ocurrió un error: ${error instanceof Error ? error.message : 'Error desconocido'}.`, variant: "destructive" });
    } finally {
        setIsProcessingAction(false);
        setIsCancelOrderDialogOpen(false);
        setOrderToCancelForDialog(null);
    }
  };


  const handleUpdateOrderStatus = async (orderId: string, newStatus: SavedOrder['status']) => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    toast({ title: "Actualizando Estado...", description: `Cambiando estado del pedido a '${newStatus}'.`});

    try {
        setAllOrders(prevOrders => {
            const updatedOrders = prevOrders.map(order =>
                order.id === orderId ? { ...order, status: newStatus, updatedAt: new Date() } : order
            );
            localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));
            return updatedOrders;
        });

        if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder(prev => prev ? { ...prev, status: newStatus, updatedAt: new Date() } : null);
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
                    {selectedOrder.status === 'cancelled' && selectedOrder.cancellationDetails && (
                        <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                            <p><strong>Cancelado por:</strong> {selectedOrder.cancellationDetails.cancelledBy}</p>
                            <p><strong>Fecha Cancelación:</strong> {format(new Date(selectedOrder.cancellationDetails.cancelledAt), 'Pp')}</p>
                            <p><strong>Motivo:</strong> {selectedOrder.cancellationDetails.reason}</p>
                        </div>
                    )}
                </div>
              </div>
            </ScrollArea>

            <SheetFooter className="p-6 border-t mt-auto bg-muted/30">
                 <div className="flex flex-col sm:flex-row justify-end gap-2 w-full">
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
                        onClick={() => { // Added explicit block for logging
                            if (selectedOrder) {
                                console.log(`[HomePage] Edit button clicked for order: ${selectedOrder.id}, status: ${selectedOrder.status}`);
                                handleEditOrder(selectedOrder.id);
                            } else {
                                console.warn("[HomePage] Edit button clicked but no selectedOrder.");
                            }
                        }}
                        disabled={isProcessingAction || !selectedOrder || selectedOrder.status !== 'pending'}
                        className="flex-grow sm:flex-grow-0"
                        title={selectedOrder && selectedOrder.status !== 'pending' ? "Solo se pueden editar pedidos pendientes" : "Editar Pedido"}
                    >
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    {(selectedOrder.status === 'pending' || selectedOrder.status === 'completed') && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => triggerCancelOrderDialog(selectedOrder!)}
                            disabled={isProcessingAction}
                            className="flex-grow sm:flex-grow-0"
                        >
                            {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                            {selectedOrder.status === 'completed' ? 'Anular Pedido' : 'Cancelar Pedido'}
                        </Button>
                    )}
                 </div>
                 {(selectedOrder.status === 'pending' || selectedOrder.status === 'completed') && (
                   <p className="text-xs text-muted-foreground mt-2 text-right w-full">
                    {selectedOrder.status === 'pending' ? 'Cancelar repone inventario.' : 'Anular NO repone inventario.'}
                   </p>
                 )}
                  {selectedOrder.status === 'cancelled' && (
                    <p className="text-sm font-medium text-destructive text-center w-full">Este pedido fue cancelado.</p>
                 )}
            </SheetFooter>
            </>
           ) : (
                <div className="p-6 text-center text-muted-foreground flex items-center justify-center h-full">Selecciona un pedido para ver detalles.</div>
           )}
        </SheetContent>
      </Sheet>

      {/* Diálogo para Cancelar Pedido */}
      <Dialog open={isCancelOrderDialogOpen} onOpenChange={(open) => { if (!open) { setIsCancelOrderDialogOpen(false); setOrderToCancelForDialog(null); }}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Pedido #{orderToCancelForDialog?.orderNumber}</DialogTitle>
            <DialogDescription>
              {orderToCancelForDialog?.status === 'pending'
                ? "El inventario asociado a este pedido será repuesto."
                : "Este pedido ya fue completado. Anularlo NO repondrá el inventario automáticamente."}
              <br/>Por favor, introduce el motivo y tu PIN de autorización (simulado).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="cancellationReason">Motivo de Cancelación</Label>
              <Textarea
                id="cancellationReason"
                value={cancellationReasonInput}
                onChange={(e) => setCancellationReasonInput(e.target.value)}
                placeholder="Ej: Cliente se arrepintió, Error en toma de pedido..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="authorizationPin">PIN de Autorización (Simulado)</Label>
              <Input
                id="authorizationPin"
                type="password"
                value={authorizationPinInput}
                onChange={(e) => setAuthorizationPinInput(e.target.value)}
                placeholder="Introduce tu PIN (mín. 4 dígitos)"
                maxLength={6}
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogPrimitiveFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isProcessingAction}>
                Cancelar Proceso
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancellation}
              disabled={isProcessingAction || !cancellationReasonInput.trim() || authorizationPinInput.length < 4}
            >
              {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Confirmar Cancelación de Pedido
            </Button>
          </DialogPrimitiveFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
