"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Pencil, XCircle } from 'lucide-react'; // Icons for edit and cancel
import type { SavedOrder, SavedOrderItem } from '@/types/product-types'; // Import shared types

// Helper to format currency
const formatCurrency = (amount: number) => {
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

export default function HomePage() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SavedOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

   // Load orders from localStorage on mount
  useEffect(() => {
    const storedOrders = localStorage.getItem('siChefOrders');
    if (storedOrders) {
      try {
         // Parse dates correctly
        const parsedOrders: SavedOrder[] = JSON.parse(storedOrders).map((order: any) => ({
            ...order,
            createdAt: new Date(order.createdAt),
        }));
        setOrders(parsedOrders);
      } catch (error) {
         console.error("Failed to parse orders from localStorage:", error);
         // Optionally clear corrupted data or show an error
         // localStorage.removeItem('siChefOrders');
      }
    }
    // No initial mock data insertion here; rely on create-order to add orders
  }, []);

  const handleRowClick = (order: SavedOrder) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleEditOrder = (orderId: string) => {
    // TODO: Implement actual order editing logic
    // This might involve:
    // 1. Loading the order data into the create-order page state.
    // 2. Allowing modification.
    // 3. Updating the order in localStorage (or backend).
    console.log(`Editing order: ${orderId}`);
    alert(`Editing order ${orderId} - Functionality not yet fully implemented.`);
    // Example navigation (if needed): router.push(`/dashboard/create-order?edit=${orderId}`);
    setIsSheetOpen(false); // Close sheet after initiating edit
  };

  const handleCancelOrder = (orderId: string) => {
    // Update order status in state and localStorage
    setOrders(prevOrders => {
      const updatedOrders = prevOrders.map(order =>
        order.id === orderId ? { ...order, status: 'cancelled' } : order
      );
      localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders)); // Update localStorage
      return updatedOrders;
    });

     // Update selected order if it's the one being cancelled
     if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
     }

    alert(`Order ${orderId} cancelled.`);
    // Keep sheet open to show updated status, or close if preferred:
    // setIsSheetOpen(false);
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Main Content - Order List */}
      <div className="md:col-span-3"> {/* Takes full width */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Pedidos Recientes</CardTitle>
            <CardDescription>Lista de los pedidos actuales y pasados.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] md:h-[70vh]">
              <Table>{/* No whitespace */}
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Forma de Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length > 0 ? (
                    orders
                      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort by most recent
                      .map((order) => (
                      <TableRow key={order.id} onClick={() => handleRowClick(order)} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{order.id}</TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell>{formatCurrency(order.total)}</TableCell>
                        <TableCell className="capitalize">{order.paymentMethod}</TableCell>
                         <TableCell>
                          <Badge variant={getStatusVariant(order.status)} className="capitalize">
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(order.createdAt, 'p')}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No hay pedidos aún.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Right Sidebar - Order Details */}
       <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-lg w-[90vw] md:w-[400px] p-0 flex flex-col">
           {selectedOrder && (
            <>
            <ScrollArea className="flex-grow">
              <div className="p-6">
                <SheetHeader className="mb-4">
                  <SheetTitle>Detalles del Pedido: {selectedOrder.id}</SheetTitle>
                  <SheetDescription>
                     Cliente: {selectedOrder.customerName} | {format(selectedOrder.createdAt, 'Pp')}
                  </SheetDescription>
                </SheetHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <h4 className="text-md font-semibold mb-2">Productos Ordenados</h4>
                  {selectedOrder.items.map((item, index) => ( // Use index if item.id is not unique enough for keys within an order
                    <div key={`${item.id}-${index}`} className="text-sm border-b pb-2 last:border-b-0">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.quantity}x {item.name}</span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                      {item.components && item.components.length > 0 && (
                        <ul className="list-disc list-inside text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                          {item.components.map((comp, compIdx) => (
                            <li key={compIdx}>
                              {comp} {item.isApart ? <Badge variant="outline" className="ml-1 text-xs px-1 py-0">Aparte</Badge> : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                       <div className="text-xs text-muted-foreground mt-0.5">
                           Precio Unitario: {formatCurrency(item.price)}
                       </div>
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
                  {selectedOrder.paymentMethod === 'cash' && selectedOrder.paidAmount != null && ( // Check for null/undefined
                     <>
                       <div className="flex justify-between text-sm mt-1">
                         <span>Pagado con:</span>
                         <span>{formatCurrency(selectedOrder.paidAmount)}</span>
                       </div>
                       <div className="flex justify-between text-sm mt-1 text-accent font-medium">
                         <span>Cambio:</span>
                         <span>{formatCurrency(selectedOrder.changeGiven ?? 0)}</span>
                       </div>
                     </>
                   )}
                   <div className="flex justify-between text-sm mt-1 items-center">
                      <span>Status:</span>
                      <Badge variant={getStatusVariant(selectedOrder.status)} className="capitalize">
                        {selectedOrder.status}
                      </Badge>
                    </div>
                </div>
              </div>
            </ScrollArea>

             {/* Action buttons only if order is pending */}
            {selectedOrder.status === 'pending' && (
               <div className="p-6 border-t mt-auto bg-muted/30">
                 <div className="flex justify-end gap-2">
                    {/* Edit Button - Placeholder */}
                    {/* <Button variant="outline" size="sm" onClick={() => handleEditOrder(selectedOrder.id)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button> */}
                    <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(selectedOrder.id)}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar Pedido
                    </Button>
                 </div>
                </div>
            )}
            </>
           )}
           {!selectedOrder && (
                <div className="p-6 text-center text-muted-foreground">Selecciona un pedido para ver los detalles.</div>
           )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
