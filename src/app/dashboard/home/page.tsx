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
import type { SavedOrder, SavedOrderItem, SavedOrderItemComponent } from '@/types/product-types'; // Import shared types
import { adjustInventoryStock } from '@/services/inventory-service'; // Import for potential cancellation restocking
import { getProductById } from '@/services/product-service'; // Import for getting product details
import { useToast } from '@/hooks/use-toast'; // Import useToast

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
  const [isCancelling, setIsCancelling] = useState(false);
  const { toast } = useToast();

   // Load orders from localStorage on mount
  useEffect(() => {
    const storedOrders = localStorage.getItem('siChefOrders');
    if (storedOrders) {
      try {
         // Parse dates correctly and ensure item structure
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
        }));
        setOrders(parsedOrders);
      } catch (error) {
         console.error("Failed to parse orders from localStorage:", error);
         localStorage.removeItem('siChefOrders'); // Clear potentially corrupted data
          toast({ title: "Error Loading Orders", description: "Could not load order history. Storage might be corrupted.", variant: "destructive" });
      }
    }
  }, [toast]);

  const handleRowClick = (order: SavedOrder) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleEditOrder = (orderId: string) => {
    // TODO: Implement actual order editing logic
    // This is complex: needs to load order state into create-order page, handle inventory adjustments (reversal/update),
    // potentially restrict edits based on order status.
    console.log(`Editing order: ${orderId}`);
    toast({
        title: "Edit Functionality Not Implemented",
        description: "Editing completed orders requires complex state loading and inventory handling.",
        variant: "default",
    });
    // router.push(`/dashboard/create-order?edit=${orderId}`); // Needs logic to load state
    setIsSheetOpen(false);
  };

   const handleCancelOrder = async (orderToCancel: SavedOrder) => {
        if (isCancelling) return; // Prevent double clicks

        // Confirmation dialog before cancelling
        if (!confirm(`Are you sure you want to cancel order #${orderToCancel.orderNumber}? This action cannot be undone and inventory will NOT be automatically restocked.`)) {
            return;
        }

        setIsCancelling(true);
        toast({ title: "Cancelling Order...", description: `Processing cancellation for order #${orderToCancel.orderNumber}` });

        try {
            // --- Optional: Attempt to Restock Inventory (Simplified Example) ---
            // This is complex and prone to errors if product definitions changed.
            // Only attempt if the order was 'completed'.
            // if (orderToCancel.status === 'completed') {
            //     console.warn("Attempting simplified inventory restock for cancelled order:", orderToCancel.id);
            //     const inventoryAdjustments: Record<string, number> = {}; // Key: inventory_item_id, Value: change
            //     // Logic similar to handleFinalizeOrder but with POSITIVE changes
            //     // ... (fetch product details, iterate items/components, calculate positive adjustments) ...
            //     try {
            //         for (const [itemId, change] of Object.entries(inventoryAdjustments)) {
            //             if (change !== 0) {
            //                 await adjustInventoryStock(itemId, change); // Restock
            //                 console.log(`Restocked inventory for ${itemId} by ${change}`);
            //             }
            //         }
            //         toast({ title: "Inventory Restocked (Simplified)", description: `Attempted restock for cancelled order items.`, variant: "default" });
            //     } catch (invError) {
            //         console.error("Inventory restock failed:", invError);
            //         toast({ title: "Inventory Restock Failed", description: `Could not automatically restock inventory. Please adjust manually.`, variant: "destructive" });
            //         // Proceed with cancellation anyway? Or stop? Decided to proceed.
            //     }
            // }
             console.warn(`Order ${orderToCancel.id} cancelled. Inventory NOT automatically restocked.`);
             toast({ title: "Inventory Not Restocked", description: `Manual inventory adjustment may be needed for cancelled order #${orderToCancel.orderNumber}.`, variant: "default" });


            // Update order status in state and localStorage
            setOrders(prevOrders => {
                const updatedOrders = prevOrders.map(order =>
                    order.id === orderToCancel.id ? { ...order, status: 'cancelled' } : order
                );
                localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders)); // Update localStorage
                return updatedOrders;
            });

            // Update selected order if it's the one being cancelled
            if (selectedOrder && selectedOrder.id === orderToCancel.id) {
                setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
            }

             toast({ title: "Order Cancelled", description: `Order #${orderToCancel.orderNumber} has been marked as cancelled.`, variant: "destructive" });
            // Keep sheet open to show updated status


        } catch (error) {
            console.error("Error cancelling order:", error);
            toast({ title: "Cancellation Failed", description: "An error occurred while cancelling the order.", variant: "destructive" });
        } finally {
            setIsCancelling(false);
        }
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
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
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
                      <TableRow key={order.id} onClick={() => handleRowClick(order)} className="cursor-pointer hover:bg-muted/50" aria-label={`View details for order number ${order.orderNumber}`}>
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
           {selectedOrder ? ( // Check if selectedOrder is not null
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
                           {/* Check if 'Contenido' exists in components to indicate package */}
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
                           {/* Check if 'Contenido' exists to decide title */}
                           <span className="font-medium text-foreground">
                             {item.components.some(c => c.slotLabel === 'Contenido') ? 'Contents / Modifiers:' : 'Modifiers:'}
                            </span>
                           <ul className="list-disc list-inside pl-2">
                            {item.components.map((comp, compIdx) => (
                                <li key={compIdx}>
                                     {/* Display slot label if it exists and isn't generic */}
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
                        {/* Only show change if it was calculated and non-zero */}
                       {(selectedOrder.changeGiven ?? 0) > 0 && (
                            <div className="flex justify-between text-sm mt-1 text-accent font-medium">
                                <span>Change Given:</span>
                                <span>{formatCurrency(selectedOrder.changeGiven)}</span>
                            </div>
                       )}
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
                    {/* Edit Button - Placeholder/Disabled */}
                    <Button variant="outline" size="sm" onClick={() => handleEditOrder(selectedOrder!.id)} disabled>
                        <Pencil className="mr-2 h-4 w-4" /> Edit (Disabled)
                    </Button>
                    {/* Cancel Button */}
                    <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(selectedOrder!)} disabled={isCancelling}>
                        <XCircle className="mr-2 h-4 w-4" /> {isCancelling ? 'Cancelling...' : 'Cancel Order'}
                    </Button>
                 </div>
                 <p className="text-xs text-muted-foreground mt-2 text-right">Note: Cancelling does not automatically restock inventory.</p>
                </div>
            )}
             {/* Message if order is cancelled */}
             {selectedOrder.status === 'cancelled' && (
                <div className="p-6 border-t mt-auto bg-destructive/10 text-center">
                    <p className="text-sm font-medium text-destructive">This order has been cancelled.</p>
                 </div>
             )}
            </>
           ) : ( // Show this if selectedOrder is null
                <div className="p-6 text-center text-muted-foreground flex items-center justify-center h-full">Select an order to view details.</div>
           )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
