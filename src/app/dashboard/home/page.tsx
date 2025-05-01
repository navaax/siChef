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

// Define types for Order and OrderItem
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  components?: string[]; // e.g., ["Extra Cheese", "No Onions"]
  isApart?: boolean; // If the component is separate
}

interface Order {
  id: string; // e.g., siChef-001
  orderNumber: number; // e.g., 1
  customerName: string;
  items: OrderItem[];
  paymentMethod: 'cash' | 'card';
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  paidAmount?: number; // Only relevant for cash payments
  changeGiven?: number; // Only relevant for cash payments
}


// Mock data for orders
const initialOrders: Order[] = [
  {
    id: 'siChef-001', orderNumber: 1, customerName: 'Alice Smith', items: [
      { id: 'prod-101', name: 'Cheeseburger', quantity: 1, price: 8.50, components: ['Extra Pickles'], isApart: false },
      { id: 'prod-203', name: 'Fries', quantity: 1, price: 3.00 },
    ], paymentMethod: 'card', total: 11.50, status: 'pending', createdAt: new Date(Date.now() - 3600 * 1000 * 1) // 1 hour ago
  },
  {
    id: 'siChef-002', orderNumber: 2, customerName: 'Bob Johnson', items: [
      { id: 'prod-305', name: 'Chicken Salad', quantity: 1, price: 9.75 },
    ], paymentMethod: 'cash', total: 9.75, status: 'completed', createdAt: new Date(Date.now() - 3600 * 1000 * 2), paidAmount: 10.00, changeGiven: 0.25 // 2 hours ago
  },
   {
    id: 'siChef-003', orderNumber: 3, customerName: 'Charlie Brown', items: [
      { id: 'prod-102', name: 'Veggie Burger', quantity: 2, price: 7.50, components: ['Lettuce Wrap', 'Avocado'], isApart: true },
      { id: 'prod-401', name: 'Iced Tea', quantity: 1, price: 2.50 },
    ], paymentMethod: 'card', total: 17.50, status: 'pending', createdAt: new Date(Date.now() - 3600 * 1000 * 0.5) // 30 mins ago
  },
   {
    id: 'siChef-004', orderNumber: 4, customerName: 'Diana Prince', items: [
      { id: 'prod-501', name: 'Espresso', quantity: 1, price: 3.50 },
    ], paymentMethod: 'cash', total: 3.50, status: 'cancelled', createdAt: new Date(Date.now() - 3600 * 1000 * 3), paidAmount: 5.00, changeGiven: 1.50 // 3 hours ago
  },
];

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

// Helper to get status badge variant
const getStatusVariant = (status: Order['status']): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
  switch (status) {
    case 'completed': return 'secondary';
    case 'cancelled': return 'destructive';
    case 'pending':
    default: return 'default';
  }
};

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

   // Load orders from localStorage on mount, or use initial mock data
  useEffect(() => {
    const storedOrders = localStorage.getItem('siChefOrders');
    if (storedOrders) {
      // Need to parse dates correctly
      const parsedOrders = JSON.parse(storedOrders).map((order: any) => ({
        ...order,
        createdAt: new Date(order.createdAt),
      }));
      setOrders(parsedOrders);
    } else {
      setOrders(initialOrders);
      localStorage.setItem('siChefOrders', JSON.stringify(initialOrders)); // Save initial data
    }
  }, []);

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleEditOrder = (orderId: string) => {
    // Navigate to create order page with orderId for editing
    console.log(`Editing order: ${orderId}`);
    // router.push(`/dashboard/create-order?edit=${orderId}`); // Example navigation
    alert(`Editing order ${orderId} - Functionality to be implemented.`);
    setIsSheetOpen(false); // Close sheet after initiating edit
  };

  const handleCancelOrder = (orderId: string) => {
    setOrders(prevOrders => {
      const updatedOrders = prevOrders.map(order =>
        order.id === orderId ? { ...order, status: 'cancelled' } : order
      );
      localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders)); // Update localStorage
      return updatedOrders;
    });
    alert(`Order ${orderId} cancelled.`);
    setIsSheetOpen(false); // Close sheet after cancelling
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Main Content - Order List */}
      <div className="md:col-span-3"> {/* Takes full width initially, sidebar will appear */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Recientes</CardTitle>
            <CardDescription>Lista de los pedidos actuales.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] md:h-[70vh]">
              <Table>{/* Ensure no whitespace before TableHeader */}
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido #</TableHead>
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
                      <TableCell colSpan={6} className="text-center">No hay pedidos aún.</TableCell>
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
        <SheetContent className="sm:max-w-lg w-[90vw] md:w-[400px] p-0">
           {selectedOrder && (
            <ScrollArea className="h-full">
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
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="text-sm">
                      <div className="flex justify-between">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                      {item.components && item.components.length > 0 && (
                        <ul className="list-disc list-inside text-xs text-muted-foreground ml-4">
                          {item.components.map((comp, idx) => (
                            <li key={idx}>
                              {comp} {item.isApart ? <Badge variant="outline" className="ml-1 text-xs">Aparte</Badge> : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div>
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                   <div className="flex justify-between text-sm mt-1">
                    <span>Forma de Pago:</span>
                    <span className="capitalize">{selectedOrder.paymentMethod}</span>
                  </div>
                  {selectedOrder.paymentMethod === 'cash' && selectedOrder.paidAmount && (
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
                   <div className="flex justify-between text-sm mt-1">
                      <span>Status:</span>
                      <Badge variant={getStatusVariant(selectedOrder.status)} className="capitalize">
                        {selectedOrder.status}
                      </Badge>
                    </div>
                </div>

                {/* Action buttons only if order is pending */}
                {selectedOrder.status === 'pending' && (
                  <>
                   <Separator className="my-4" />
                   <div className="flex justify-end gap-2 mt-4">
                     <Button variant="outline" size="sm" onClick={() => handleEditOrder(selectedOrder.id)}>
                       <Pencil className="mr-2 h-4 w-4" /> Editar
                     </Button>
                     <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(selectedOrder.id)}>
                       <XCircle className="mr-2 h-4 w-4" /> Cancelar
                     </Button>
                   </div>
                 </>
                )}
              </div>
            </ScrollArea>
           )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
