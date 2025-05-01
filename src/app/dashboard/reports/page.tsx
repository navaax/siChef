// src/app/dashboard/reports/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Loader2 } from 'lucide-react'; // Icons
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { generateSalesReport, type SalesReport, type SalesHistoryItem } from '@/services/pdf-generator'; // Assuming service exists
import type { SavedOrder } from '@/types/product-types'; // Import SavedOrder type

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

// --- Component ---
export default function ReportsPage() {
  const { username } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [startingCash, setStartingCash] = useState<number>(100.00); // Default starting cash

  // Load orders and starting cash from localStorage on mount
  useEffect(() => {
    const storedOrders = localStorage.getItem('siChefOrders');
    if (storedOrders) {
        try {
             const parsedOrders: SavedOrder[] = JSON.parse(storedOrders).map((order: any) => ({
                ...order,
                createdAt: new Date(order.createdAt),
                 // Ensure subtotal and total are numbers, default to 0 if missing or invalid
                subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0,
                total: typeof order.total === 'number' ? order.total : 0,
                 items: order.items?.map((item: any) => ({
                    id: item.id || 'unknown',
                    name: item.name || 'Unknown Item',
                    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
                    price: typeof item.price === 'number' ? item.price : 0,
                    totalItemPrice: typeof item.totalItemPrice === 'number' ? item.totalItemPrice : 0,
                    components: Array.isArray(item.components) ? item.components : [],
                 })) || [],
                 status: ['pending', 'completed', 'cancelled'].includes(order.status) ? order.status : 'pending',
                 paymentMethod: ['cash', 'card'].includes(order.paymentMethod) ? order.paymentMethod : 'card',
             }));
             setOrders(parsedOrders);
        } catch (error) {
            console.error("Failed to parse orders from localStorage:", error);
            toast({ title: "Error Loading Orders", description: "Could not load previous sales data.", variant: "destructive" });
        }
    }

    const storedStartingCash = localStorage.getItem('siChefStartingCash');
    setStartingCash(storedStartingCash ? parseFloat(storedStartingCash) : 100.00); // Use stored or default

  }, [toast]);

  // Calculate totals for the report summary (only completed orders)
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
                businessName: "siChef POS", // Replace with dynamic name from settings?
                logo: "https://picsum.photos/100/50?random=99", // Placeholder logo
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
                    subtotal: order.subtotal, // Use the stored subtotal
                    total: order.total,
                    paymentMethod: order.paymentMethod,
                    status: order.status,
                })),
            };

            // Simulate PDF generation
            console.log("--- PDF Report Data ---", reportData);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate generation time
            const pdfBytes = await generateSalesReport(reportData); // Still call the (placeholder) function

             // Check if PDF generation actually returned data (placeholder returns empty)
            if (pdfBytes && pdfBytes.length > 0) {
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
            } else {
                 toast({ title: "Report Generation Skipped", description: "PDF generation is simulated. Check console for data.", variant: "default" });
            }


            // --- Resetting for the new day ---
            // Clear completed/cancelled orders, keep pending ones
            const activeOrders = orders.filter(o => o.status === 'pending');
            localStorage.setItem('siChefOrders', JSON.stringify(activeOrders));
            setOrders(activeOrders);

            // Optionally archive completed/cancelled orders to another key or backend
            const archivedOrders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
            console.log("Archived orders (simulated):", archivedOrders);
            // localStorage.setItem('siChefArchivedOrders_YYYYMMDD', JSON.stringify(archivedOrders));

            // Reset starting cash (or prompt user)
             const newStartingCash = 100.00; // Example reset value
             localStorage.setItem('siChefStartingCash', String(newStartingCash));
             setStartingCash(newStartingCash);

             toast({ title: "Day Finalized", description: "Completed sales cleared, ready for a new day." });


        } catch (error) {
            console.error("Error finalizing day / generating PDF:", error);
            toast({ title: "Operation Failed", description: `Could not finalize the day or generate the report: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };


  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
          <div>
             <CardTitle>Reporte de Ventas</CardTitle>
             <CardDescription>Historial de todos los pedidos del día.</CardDescription>
           </div>
             <Button onClick={handleFinalizeDay} disabled={isGeneratingPdf || completedOrders.length === 0} size="sm">
                 {isGeneratingPdf ? (
                     <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...
                     </>
                 ) : (
                     <>
                        <Download className="mr-2 h-4 w-4" /> Finalizar Día y Exportar
                     </>
                 )}
             </Button>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0"> {/* Remove padding for full height scroll */}
           <div className="relative h-full">
             <ScrollArea className="absolute inset-0"> {/* Make ScrollArea fill CardContent */}
                 <Table className="min-w-full">{/* Ensure table takes at least full width */}
                   <TableHeader className="sticky top-0 bg-background z-10 shadow-sm"> {/* Make header sticky */}
                    <TableRow>
                      <TableHead className="w-[100px]">Pedido #</TableHead>
                      <TableHead className="w-[150px]">ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right w-[100px]">Subtotal</TableHead>
                      <TableHead className="text-right w-[100px]">Total</TableHead>
                      <TableHead className="w-[100px]">Forma Pago</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[180px]">Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length > 0 ? (
                      orders
                         .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort by most recent
                        .map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell className="text-xs text-muted-foreground break-all">{order.id}</TableCell>
                          <TableCell>{order.customerName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(order.subtotal)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(order.total)}</TableCell>
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
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No hay historial de ventas aún.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                   {/* Footer with Summary (Only if there are completed orders) */}
                   {completedOrders.length > 0 && (
                    <TableFooter className="sticky bottom-0 bg-background z-10 border-t font-semibold">
                        <TableRow>
                            <TableCell colSpan={3}>Resumen del Día (Pedidos Completados)</TableCell>
                            <TableCell className="text-right">Subtotal</TableCell>
                             <TableCell className="text-right">Total</TableCell>
                             <TableCell colSpan={3}></TableCell> {/* Placeholder cells */}
                        </TableRow>
                         <TableRow>
                            <TableCell colSpan={3}>Inicio de Caja:</TableCell>
                            <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(startingCash)}</TableCell>
                             <TableCell colSpan={3}></TableCell>
                         </TableRow>
                        <TableRow>
                            <TableCell colSpan={3}>Ventas en Efectivo:</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(cashSales)}</TableCell>
                            <TableCell colSpan={3}></TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell colSpan={3}>Ventas con Tarjeta:</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(cardSales)}</TableCell>
                             <TableCell colSpan={3}></TableCell>
                         </TableRow>
                         <TableRow>
                            <TableCell colSpan={3}>Venta Total (Completados):</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right text-base font-bold">{formatCurrency(totalSales)}</TableCell>
                             <TableCell colSpan={3}></TableCell>
                         </TableRow>
                         <TableRow className="text-lg font-bold border-t-2">
                            <TableCell colSpan={3}>Efectivo Esperado en Caja:</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(expectedCashInRegister)}</TableCell>
                            <TableCell colSpan={3}></TableCell>
                        </TableRow>
                    </TableFooter>
                    )}
                </Table>
              </ScrollArea>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

```