// src/app/dashboard/home/page.tsx
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
import { Pencil, XCircle, PackageIcon } from 'lucide-react'; // Icons for edit, cancel, package
import type { SavedOrder, SavedOrderItem } from '@/types/product-types'; // Import shared types

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
            // Ensure items have components array, even if empty
            items: order.items.map((item: any) => ({
                ...item,
                components: item.components || [], // Default to empty array if missing
            }))
        }));
        setOrders(parsedOrders);
      } catch (error) {
         console.error("Failed to parse orders from localStorage:", error);
         localStorage.removeItem('siChefOrders'); // Clear potentially corrupted data
      }
    }
  }, []);

  const handleRowClick = (order: SavedOrder) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleEditOrder = (orderId: string) => {
    // TODO: Implement actual order editing logic
    // This is complex as it might involve reversing inventory changes or handling partially completed orders.
    console.log(`Editing order: ${orderId}`);
    alert(`Editing order ${orderId} - Functionality not yet implemented due to complexity.`);
    // router.push(`/dashboard/create-order?edit=${orderId}`); // Needs logic to load state
    setIsSheetOpen(false);
  };

   const handleCancelOrder = (orderId: string) => {
        // Confirmation dialog before cancelling
        if (!confirm(`Are you sure you want to cancel order ${orderId}? This action cannot be undone and inventory will NOT be automatically restocked.`)) {
            return;
        }

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

        // NOTE: Inventory is NOT automatically restocked here.
        // This would require tracking exactly what was decremented for this order
        // and performing the reverse operation, which adds significant complexity.
        // A manual inventory adjustment might be necessary.
        alert(`Order ${orderId} marked as cancelled. Inventory NOT automatically restocked.`);
        // Keep sheet open to show updated status
    };


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Main Content - Order List */}
      <div className="md:col-span-3"> {/* Takes full width */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>List of current and past orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] md:h-[70vh]">
              <Table>{/* No whitespace */}
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length > 0 ? (
                    orders
                      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort by most recent
                      .map((order) => (
                      <TableRow key={order.id} onClick={() => handleRowClick(order)} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
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
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No orders yet.</TableCell>
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
        <SheetContent className="sm:max-w-lg w-[90vw] md:w-[450px] p-0 flex flex-col"> {/* Increased width slightly */}
           {selectedOrder && (
            <>
            <ScrollArea className="flex-grow">
              <div className="p-6">
                <SheetHeader className="mb-4">
                  <SheetTitle>Order Details: #{selectedOrder.orderNumber}</SheetTitle>
                  <SheetDescription>
                     ID: {selectedOrder.id} <br/>
                     Customer: {selectedOrder.customerName} | {format(selectedOrder.createdAt, 'Pp')}
                  </SheetDescription>
                </SheetHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <h4 className="text-md font-semibold mb-2">Items Ordered</h4>
                  {selectedOrder.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="text-sm border-b pb-3 mb-3 last:border-b-0 last:mb-0">
                       {/* Item Header: Qty x Name and Total Item Price */}
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium flex items-center gap-1">
                          {item.components?.some(c => c.slotLabel === 'Contenido') && <PackageIcon className="h-4 w-4 text-accent flex-shrink-0" title="Package"/>}
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-medium">{formatCurrency(item.totalItemPrice)}</span>
                      </div>
                       {/* Base Price Info */}
                       <div className="text-xs text-muted-foreground mb-1.5">
                           (Base: {formatCurrency(item.price)} each)
                       </div>
                       {/* Components/Modifiers List */}
                      {item.components && item.components.length > 0 && (
                        <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                           <span className="font-medium text-foreground">Details:</span>
                           <ul className="list-disc list-inside pl-2">
                            {item.components.map((comp, compIdx) => (
                                <li key={compIdx}>
                                     {comp.slotLabel && comp.slotLabel !== 'Mod' && comp.slotLabel !== 'Contenido' ? `[${comp.slotLabel}] ` : ''}
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
                {/* Financial Summary */}
                <div>
                   <div className="flex justify-between text-sm mt-1">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {/* Add Tax/Discount lines here if applicable later */}
                  <div className="flex justify-between font-semibold mt-1 text-base">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                   <div className="flex justify-between text-sm mt-1">
                    <span>Payment Method:</span>
                    <span className="capitalize">{selectedOrder.paymentMethod}</span>
                  </div>
                  {selectedOrder.paymentMethod === 'cash' && selectedOrder.paidAmount != null && ( // Check for null/undefined
                     <>
                       <div className="flex justify-between text-sm mt-1">
                         <span>Amount Paid:</span>
                         <span>{formatCurrency(selectedOrder.paidAmount)}</span>
                       </div>
                       <div className="flex justify-between text-sm mt-1 text-accent font-medium">
                         <span>Change Given:</span>
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

             {/* Action buttons only if order is NOT cancelled */}
            {selectedOrder.status !== 'cancelled' && (
               <div className="p-6 border-t mt-auto bg-muted/30">
                 <div className="flex justify-end gap-2">
                    {/* Edit Button - Placeholder/Disabled due to complexity */}
                    <Button variant="outline" size="sm" onClick={() => handleEditOrder(selectedOrder.id)} disabled>
                        <Pencil className="mr-2 h-4 w-4" /> Edit (Disabled)
                    </Button>
                    {/* Cancel Button - Only if not already completed */}
                    {selectedOrder.status === 'pending' && (
                        <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(selectedOrder.id)}>
                            <XCircle className="mr-2 h-4 w-4" /> Cancel Order
                        </Button>
                    )}
                    {selectedOrder.status === 'completed' && (
                         <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(selectedOrder.id)}>
                            <XCircle className="mr-2 h-4 w-4" /> Cancel Order (No Inv. Restock)
                        </Button>
                    )}
                 </div>
                 {selectedOrder.status === 'completed' && (
                    <p className="text-xs text-muted-foreground mt-2 text-right">Note: Cancelling a completed order does not automatically restock inventory.</p>
                 )}
                </div>
            )}
             {/* Message if order is cancelled */}
             {selectedOrder.status === 'cancelled' && (
                <div className="p-6 border-t mt-auto bg-destructive/10 text-center">
                    <p className="text-sm font-medium text-destructive-foreground">This order has been cancelled.</p>
                 </div>
             )}
            </>
           )}
           {!selectedOrder && (
                <div className="p-6 text-center text-muted-foreground">Select an order to view details.</div>
           )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
