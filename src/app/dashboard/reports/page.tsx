"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Download, FileText } from 'lucide-react'; // Icons
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { generateSalesReport, type SalesReport, type SalesHistoryItem } from '@/services/pdf-generator'; // Assuming service exists

// --- Types (assuming similar Order type as in home) ---
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // Base price per unit
  components?: string[];
  isApart?: boolean;
}

interface Order {
  id: string; // e.g., siChef-001
  orderNumber: number;
  customerName: string;
  items: OrderItem[];
  paymentMethod: 'cash' | 'card';
  total: number; // Final total including modifiers, taxes etc.
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  paidAmount?: number;
  changeGiven?: number;
  subtotal?: number; // Adding subtotal for reporting
}

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

// --- Component ---
export default function ReportsPage() {
  const { username } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [startingCash, setStartingCash] = useState<number>(0); // Example starting cash

  // Load orders from localStorage on mount
  useEffect(() => {
    const storedOrders = localStorage.getItem('siChefOrders');
    if (storedOrders) {
       const parsedOrders = JSON.parse(storedOrders).map((order: any) => ({
        ...order,
        createdAt: new Date(order.createdAt),
         // Calculate subtotal if not stored (simple sum of item base prices * quantity)
         subtotal: order.subtotal ?? order.items.reduce((sum: number, item: OrderItem) => sum + (item.price * item.quantity), 0)
      }));
      setOrders(parsedOrders);
    }
     // Load starting cash (example, replace with actual logic if needed)
     const storedStartingCash = localStorage.getItem('siChefStartingCash');
     setStartingCash(storedStartingCash ? parseFloat(storedStartingCash) : 100.00); // Default 100

  }, []);

  // Calculate totals for the report summary
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalSales = completedOrders.reduce((sum, order) => sum + order.total, 0);
  const cashSales = completedOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, order) => sum + order.total, 0);
  const cardSales = completedOrders.filter(o => o.paymentMethod === 'card').reduce((sum, order) => sum + order.total, 0);
  const expectedCashInRegister = startingCash + cashSales;


   const handleFinalizeDay = async () => {
        if (completedOrders.length === 0) {
            toast({ title: "No Completed Orders", description: "Cannot generate report with no completed sales.", variant: "destructive" });
            return;
        }

        setIsGeneratingPdf(true);
        toast({ title: "Generating Report...", description: "Preparing your sales PDF." });

        try {
            const reportData: SalesReport = {
                businessName: "siChef Restaurant", // Replace with dynamic name
                logo: "https://picsum.photos/100/50?random=99", // Replace with actual logo URL or base64
                reportDate: format(new Date(), 'Pp'),
                user: username || 'Unknown User',
                startingCash: startingCash,
                totalSales: totalSales,
                cashSales: cashSales,
                cardSales: cardSales,
                expectedCashInRegister: expectedCashInRegister,
                salesHistory: completedOrders.map(order => ({ // Map to SalesHistoryItem structure
                    orderNumber: String(order.orderNumber),
                    orderId: order.id,
                    customer: order.customerName,
                    subtotal: order.subtotal || 0, // Use calculated/stored subtotal
                    total: order.total,
                    paymentMethod: order.paymentMethod,
                    status: order.status,
                })),
            };

            const pdfBytes = await generateSalesReport(reportData);

            // Trigger download
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
            link.download = `siChef_SalesReport_${timestamp}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href); // Clean up blob URL

            toast({ title: "Report Generated", description: "PDF download started." });

            // --- Resetting for the new day ---
            // 1. Clear completed orders (or move them to an archive - depends on requirements)
            //    For this example, we'll just clear all orders from localStorage.
            //    In a real app, you might want to archive instead of delete.
             localStorage.removeItem('siChefOrders');
             setOrders([]); // Clear orders in state

            // 2. Reset starting cash (optional, maybe prompt user for new starting cash)
             const newStartingCash = 100.00; // Example reset value
             localStorage.setItem('siChefStartingCash', String(newStartingCash));
             setStartingCash(newStartingCash);

             toast({ title: "Day Finalized", description: "Sales data cleared, ready for a new day." });


        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "PDF Generation Failed", description: "Could not generate the sales report.", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };


  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
             <CardTitle>Reporte de Ventas</CardTitle>
             <CardDescription>Historial de todos los pedidos.</CardDescription>
           </div>
             <Button onClick={handleFinalizeDay} disabled={isGeneratingPdf || completedOrders.length === 0}>
                 {isGeneratingPdf ? (
                     <>
                        <FileText className="mr-2 h-4 w-4 animate-pulse" /> Generando...
                     </>
                 ) : (
                     <>
                        <Download className="mr-2 h-4 w-4" /> Finalizar Día y Exportar PDF
                     </>
                 )}
             </Button>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0"> {/* Remove padding for full height scroll */}
          <ScrollArea className="h-full"> {/* Make ScrollArea take full height */}
             <Table className="relative"> {/* Add relative positioning */}
                <TableHeader className="sticky top-0 bg-background z-10"> {/* Make header sticky */}
                <TableRow>
                  <TableHead>Pedido #</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Forma Pago</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length > 0 ? (
                  orders
                     .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort by most recent
                    .map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.id}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>{formatCurrency(order.subtotal || 0)}</TableCell> {/* Display subtotal */}
                      <TableCell>{formatCurrency(order.total)}</TableCell>
                      <TableCell className="capitalize">{order.paymentMethod}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(order.status)} className="capitalize">
                          {order.status}
                        </Badge>
                      </TableCell>
                       <TableCell>{format(order.createdAt, 'Pp')}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-24">No hay historial de ventas aún.</TableCell>
                  </TableRow>
                )}
              </TableBody>
               {/* Footer with Summary (Only if there are completed orders) */}
               {completedOrders.length > 0 && (
                <TableFooter className="sticky bottom-0 bg-background z-10"> {/* Make footer sticky */}
                    <TableRow className="font-semibold">
                        <TableCell colSpan={3}>Resumen del Día (Pedidos Completados)</TableCell>
                        <TableCell colSpan={5} className="text-right"></TableCell> {/* Placeholder cells */}
                    </TableRow>
                    <TableRow>
                        <TableCell colSpan={3}>Inicio de Caja:</TableCell>
                        <TableCell className="text-right">{formatCurrency(startingCash)}</TableCell>
                        <TableCell colSpan={4}></TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell colSpan={3}>Venta Total:</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalSales)}</TableCell>
                         <TableCell colSpan={4}></TableCell>
                    </TableRow>
                     <TableRow>
                        <TableCell colSpan={3}>Ventas en Efectivo:</TableCell>
                        <TableCell className="text-right">{formatCurrency(cashSales)}</TableCell>
                         <TableCell colSpan={4}></TableCell>
                    </TableRow>
                     <TableRow>
                        <TableCell colSpan={3}>Ventas con Tarjeta:</TableCell>
                        <TableCell className="text-right">{formatCurrency(cardSales)}</TableCell>
                         <TableCell colSpan={4}></TableCell>
                    </TableRow>
                    <TableRow className="font-bold text-lg">
                        <TableCell colSpan={3}>Efectivo Esperado en Caja:</TableCell>
                        <TableCell className="text-right">{formatCurrency(expectedCashInRegister)}</TableCell>
                         <TableCell colSpan={4}></TableCell>
                    </TableRow>
                </TableFooter>
                )}
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
