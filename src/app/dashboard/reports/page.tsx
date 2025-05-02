// src/app/dashboard/reports/page.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Loader2, ReceiptText, HandCoins, Gift, Landmark } from 'lucide-react'; // Icons
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { useCashRegister } from '@/contexts/cash-register-context'; // Importar hook de caja
import { generateSalesReport, type SalesReport, type SalesHistoryItem } from '@/services/pdf-generator'; // Assuming service exists
import { closeCashSession } from '@/services/cash-register-service'; // Importar servicio de caja
import type { SavedOrder } from '@/types/product-types'; // Import SavedOrder type
import { formatCurrency } from '@/lib/utils'; // Importar utilidad de formato
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DenominationInputForm } from '@/components/cash-register/denomination-input-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { StartCashFormData, EndOfDayFormData } from '@/types/cash-register-types';

// Helper to get status badge variant
const getStatusVariant = (status: SavedOrder['status']): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
  switch (status) {
    case 'completed': return 'secondary';
    case 'cancelled': return 'destructive';
    case 'pending':
    default: return 'default';
  }
};

type WizardStep = 'countCash' | 'expenses' | 'tips' | 'loans' | 'summary' | 'confirm';

// --- Component ---
export default function ReportsPage() {
  const { username } = useAuth();
  const { currentSession, clearSession } = useCashRegister(); // Obtener sesión de caja actual
  const { toast } = useToast();
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('countCash');
  const [endOfDayData, setEndOfDayData] = useState<Partial<EndOfDayFormData>>({
    expenses: 0,
    tips: 0,
    loanAmount: 0,
    loanReason: '',
    endingDenominations: {},
    endingCashTotal: 0,
  });

  // Load orders from localStorage on mount
  useEffect(() => {
    const storedOrders = localStorage.getItem('siChefOrders');
    if (storedOrders) {
      try {
           const parsedOrders: SavedOrder[] = JSON.parse(storedOrders).map((order: any) => ({
              ...order,
              createdAt: new Date(order.createdAt),
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
          toast({ title: "Error al Cargar Pedidos", description: "No se pudieron cargar los datos de ventas anteriores.", variant: "destructive" });
      }
    }
    // Starting cash ahora viene del contexto de caja
  }, [toast]);

  // Calcular totales para el reporte (solo órdenes completadas durante la sesión activa)
  const completedOrders = orders.filter(o => o.status === 'completed'); // Filtrar solo completados
  const totalSales = completedOrders.reduce((sum, order) => sum + order.total, 0);
  const cashSales = completedOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, order) => sum + order.total, 0);
  const cardSales = completedOrders.filter(o => o.paymentMethod === 'card').reduce((sum, order) => sum + order.total, 0);
  const startingCash = currentSession?.starting_cash ?? 0; // Obtener de la sesión actual
  const expectedCashInRegister = startingCash + cashSales
                              - (endOfDayData.expenses ?? 0)
                              - (endOfDayData.loanAmount ?? 0)
                              + (endOfDayData.tips ?? 0); // Ajustado con gastos, préstamos y propinas

  const cashDifference = (endOfDayData.endingCashTotal ?? 0) - expectedCashInRegister;

  const handleOpenWizard = () => {
    if (!currentSession) {
        toast({ title: "Sin Sesión Activa", description: "No hay una sesión de caja activa para cerrar.", variant: "destructive" });
        return;
    }
    if (completedOrders.length === 0) {
        toast({ title: "Sin Ventas Completadas", description: "No se puede generar el reporte sin ventas completadas en esta sesión.", variant: "destructive" });
        return;
    }
    setWizardStep('countCash'); // Empezar desde el conteo de efectivo
    setEndOfDayData({ // Resetear datos del wizard
        expenses: 0,
        tips: 0,
        loanAmount: 0,
        loanReason: '',
        endingDenominations: {},
        endingCashTotal: 0,
    });
    setIsWizardOpen(true);
  };

  const handleNextStep = () => {
    switch (wizardStep) {
      case 'countCash':
        if ((endOfDayData.endingCashTotal ?? 0) <= 0) {
            toast({title: "Conteo Inválido", description: "Ingresa el conteo de efectivo final.", variant:"destructive"});
            return;
        }
        setWizardStep('expenses');
        break;
      case 'expenses': setWizardStep('tips'); break;
      case 'tips': setWizardStep('loans'); break;
      case 'loans': setWizardStep('summary'); break;
      case 'summary': setWizardStep('confirm'); break; // O ir directo a finalizar
      default: break;
    }
  };

   const handlePreviousStep = () => {
    switch (wizardStep) {
      case 'expenses': setWizardStep('countCash'); break;
      case 'tips': setWizardStep('expenses'); break;
      case 'loans': setWizardStep('tips'); break;
      case 'summary': setWizardStep('loans'); break;
      case 'confirm': setWizardStep('summary'); break;
      default: break;
    }
  };

  const handleDenominationSubmit = (data: StartCashFormData) => {
    setEndOfDayData(prev => ({ ...prev, endingDenominations: data.denominations, endingCashTotal: data.total }));
    handleNextStep(); // Avanzar al siguiente paso
  };

  const handleFinalizeDay = async () => {
    if (!currentSession) {
        toast({ title: "Error", description: "No hay sesión activa para cerrar.", variant: "destructive" });
        return;
    }
    setIsGeneratingPdf(true);
    toast({ title: "Generando Reporte...", description: "Preparando el PDF de ventas y cerrando caja." });

    try {
        // 1. Preparar datos del reporte
        const reportData: SalesReport = {
            businessName: "siChef POS", // Reemplazar con nombre dinámico
            logo: "https://picsum.photos/100/50?random=99", // Logo placeholder
            reportDate: format(new Date(), 'Pp'),
            user: username || 'Usuario Desconocido',
            startingCash: startingCash,
            totalSales: totalSales,
            cashSales: cashSales,
            cardSales: cardSales,
            totalExpenses: endOfDayData.expenses ?? 0,
            totalTips: endOfDayData.tips ?? 0,
            loansWithdrawalsAmount: endOfDayData.loanAmount ?? 0,
            loansWithdrawalsReason: endOfDayData.loanReason ?? '',
            endingCash: endOfDayData.endingCashTotal ?? 0, // Conteo final
            expectedCashInRegister: expectedCashInRegister, // Calculado incluyendo gastos, etc.
            calculatedDifference: cashDifference, // Diferencia calculada
            salesHistory: completedOrders.map(order => ({
                orderNumber: String(order.orderNumber),
                orderId: order.id,
                customer: order.customerName,
                subtotal: order.subtotal,
                total: order.total,
                paymentMethod: order.paymentMethod,
                status: order.status,
            })),
        };

        // 2. Simular generación de PDF y obtener bytes (o console.log)
        console.log("--- Datos Reporte PDF ---", reportData);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simular tiempo
        const pdfBytes = await generateSalesReport(reportData);

        if (pdfBytes && pdfBytes.length > 0) {
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
            link.download = `siChef_ReporteVentas_${timestamp}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            toast({ title: "Reporte Generado", description: "Descarga de PDF iniciada." });
        } else {
             toast({ title: "Generación de Reporte Simulada", description: "Revisa la consola para ver los datos.", variant: "default" });
        }

        // 3. Cerrar la sesión de caja en la BD
        await closeCashSession(
            currentSession.id,
            endOfDayData.endingCashTotal ?? 0,
            cashSales,
            cardSales,
            endOfDayData.expenses ?? 0,
            endOfDayData.tips ?? 0,
            endOfDayData.loanAmount ?? 0,
            endOfDayData.loanReason ?? ''
        );

        // 4. Resetear estado local
        const activeOrders = orders.filter(o => o.status === 'pending');
        localStorage.setItem('siChefOrders', JSON.stringify(activeOrders));
        setOrders(activeOrders);
        clearSession(); // Limpiar sesión del contexto
        setIsWizardOpen(false); // Cerrar el wizard

        toast({ title: "Día Finalizado", description: "Ventas completadas archivadas (simulado), caja cerrada." });

    } catch (error) {
        console.error("Error finalizando día / generando PDF:", error);
        toast({ title: "Operación Fallida", description: `No se pudo finalizar el día o generar el reporte: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
    } finally {
        setIsGeneratingPdf(false);
    }
};

// --- Renderizado del Wizard ---
const renderWizardContent = () => {
    switch (wizardStep) {
      case 'countCash':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Paso 1: Conteo de Efectivo Final</DialogTitle>
              <DialogDescription>Ingresa la cantidad de cada denominación que tienes físicamente en caja.</DialogDescription>
            </DialogHeader>
            <DenominationInputForm
              onSubmit={handleDenominationSubmit}
              isLoading={isGeneratingPdf} // Usar el mismo estado de carga
              submitButtonText="Siguiente: Gastos"
            />
            {/* No necesitamos Cancelar aquí, el Dialog se encarga */}
          </>
        );
      case 'expenses':
        return (
          <>
            <DialogHeader>
               <DialogTitle>Paso 2: Registrar Gastos</DialogTitle>
               <DialogDescription>Ingresa el total de gastos pagados desde la caja durante esta sesión.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
               <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                     id="expenses"
                     type="number"
                     step="0.01"
                     min="0"
                     value={endOfDayData.expenses || ''}
                     onChange={(e) => setEndOfDayData(prev => ({ ...prev, expenses: parseFloat(e.target.value) || 0 }))}
                     placeholder="0.00"
                     className="pl-7 text-lg"
                     aria-label="Total de Gastos"
                  />
               </div>
            </div>
            <div className="flex justify-between mt-4">
                 <Button variant="outline" onClick={handlePreviousStep}>Anterior</Button>
                <Button onClick={handleNextStep}>Siguiente: Propinas</Button>
            </div>
          </>
        );
      case 'tips':
         return (
          <>
            <DialogHeader>
               <DialogTitle>Paso 3: Registrar Propinas</DialogTitle>
               <DialogDescription>Ingresa el total de propinas recibidas (en efectivo) que se manejarán desde la caja.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                     id="tips"
                     type="number"
                     step="0.01"
                     min="0"
                     value={endOfDayData.tips || ''}
                     onChange={(e) => setEndOfDayData(prev => ({ ...prev, tips: parseFloat(e.target.value) || 0 }))}
                     placeholder="0.00"
                     className="pl-7 text-lg"
                     aria-label="Total de Propinas"
                  />
               </div>
            </div>
             <div className="flex justify-between mt-4">
                 <Button variant="outline" onClick={handlePreviousStep}>Anterior</Button>
                <Button onClick={handleNextStep}>Siguiente: Préstamos/Retiros</Button>
            </div>
          </>
        );
     case 'loans':
        return (
          <>
            <DialogHeader>
               <DialogTitle>Paso 4: Préstamos / Retiros de Caja</DialogTitle>
               <DialogDescription>Registra cualquier dinero retirado de la caja que no sea un gasto operativo (ej. préstamo al dueño).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                     id="loanAmount"
                     type="number"
                     step="0.01"
                     min="0"
                     value={endOfDayData.loanAmount || ''}
                     onChange={(e) => setEndOfDayData(prev => ({ ...prev, loanAmount: parseFloat(e.target.value) || 0 }))}
                     placeholder="0.00"
                     className="pl-7 text-lg"
                     aria-label="Monto de Préstamo/Retiro"
                  />
               </div>
               <div>
                   <Label htmlFor="loanReason" className="text-xs">Motivo (Opcional)</Label>
                   <Textarea
                     id="loanReason"
                     value={endOfDayData.loanReason || ''}
                     onChange={(e) => setEndOfDayData(prev => ({ ...prev, loanReason: e.target.value }))}
                     placeholder="Ej: Retiro dueño, Préstamo nómina..."
                     rows={2}
                   />
               </div>
            </div>
            <div className="flex justify-between mt-4">
                 <Button variant="outline" onClick={handlePreviousStep}>Anterior</Button>
                <Button onClick={handleNextStep}>Siguiente: Resumen</Button>
            </div>
          </>
        );
      case 'summary':
      case 'confirm': // Mostrar lo mismo para resumen y confirmación final
        return (
          <>
            <DialogHeader>
               <DialogTitle>Paso 5: Resumen y Confirmación</DialogTitle>
               <DialogDescription>Revisa los totales antes de finalizar el día.</DialogDescription>
            </DialogHeader>
             <div className="space-y-3 py-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Fondo Inicial:</span> <span>{formatCurrency(startingCash)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ventas Efectivo:</span> <span className="text-green-600">+ {formatCurrency(cashSales)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gastos:</span> <span className="text-red-600">- {formatCurrency(endOfDayData.expenses ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Propinas (Efectivo):</span> <span className="text-green-600">+ {formatCurrency(endOfDayData.tips ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Préstamos/Retiros:</span> <span className="text-red-600">- {formatCurrency(endOfDayData.loanAmount ?? 0)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-2"><span >Efectivo Esperado:</span> <span>{formatCurrency(expectedCashInRegister)}</span></div>
                <div className="flex justify-between font-semibold"><span >Efectivo Contado:</span> <span>{formatCurrency(endOfDayData.endingCashTotal ?? 0)}</span></div>
                 <div className={`flex justify-between font-bold text-lg border-t pt-2 ${cashDifference === 0 ? '' : cashDifference > 0 ? 'text-green-700' : 'text-destructive'}`}>
                    <span >Diferencia:</span>
                    <span>{formatCurrency(cashDifference)} {cashDifference === 0 ? '' : cashDifference > 0 ? '(Sobrante)' : '(Faltante)'}</span>
                 </div>
                 {endOfDayData.loanReason && <p className="text-xs text-muted-foreground pt-2">Motivo Préstamo/Retiro: {endOfDayData.loanReason}</p>}
             </div>
             <p className="text-xs text-center text-muted-foreground mt-4">
                 Al confirmar, se cerrará la sesión de caja actual, se generará el reporte PDF y se limpiarán las ventas completadas para el próximo día.
            </p>
            <div className="flex justify-between mt-6">
                 <Button variant="outline" onClick={handlePreviousStep} disabled={isGeneratingPdf}>Anterior</Button>
                 <Button onClick={handleFinalizeDay} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                    Confirmar y Finalizar Día
                 </Button>
            </div>
          </>
        );
      default: return null;
    }
  };


  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
          <div>
             <CardTitle>Reporte de Ventas</CardTitle>
             <CardDescription>Historial de todos los pedidos de la sesión actual.</CardDescription>
           </div>
             <Button onClick={handleOpenWizard} disabled={isGeneratingPdf || !currentSession || completedOrders.length === 0} size="sm">
                 {isGeneratingPdf ? (
                     <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                     </>
                 ) : (
                     <>
                        <Download className="mr-2 h-4 w-4" /> Finalizar Día y Exportar
                     </>
                 )}
             </Button>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0"> {/* Quitar padding para scroll de altura completa */}
           <div className="relative h-full">
             <ScrollArea className="absolute inset-0"> {/* Hacer que ScrollArea llene CardContent */}
                 <Table className="min-w-full">{/* Asegurar que la tabla ocupe al menos el ancho completo */}
                   <TableHeader className="sticky top-0 bg-background z-10 shadow-sm"> {/* Hacer encabezado pegajoso */}
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
                         .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Ordenar por más reciente
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
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No hay historial de ventas aún para esta sesión.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                   {/* Footer con Resumen (Solo si hay órdenes completadas) */}
                   {completedOrders.length > 0 && currentSession && (
                    <TableFooter className="sticky bottom-0 bg-background z-10 border-t font-semibold">
                        <TableRow>
                            <TableCell colSpan={3}>Resumen de la Sesión (Pedidos Completados)</TableCell>
                            <TableCell className="text-right">Subtotal</TableCell>
                             <TableCell className="text-right">Total</TableCell>
                             <TableCell colSpan={3}></TableCell> {/* Celdas Placeholder */}
                        </TableRow>
                         <TableRow>
                            <TableCell colSpan={3}>Fondo Inicial:</TableCell>
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
                         <TableRow className="text-base font-bold">
                            <TableCell colSpan={3}>Venta Total (Completados):</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(totalSales)}</TableCell>
                             <TableCell colSpan={3}></TableCell>
                         </TableRow>
                         {/* Mostrar efectivo esperado SÓLO si se está en el wizard o ya se cerró */}
                         {/*
                         <TableRow className="text-lg font-bold border-t-2">
                            <TableCell colSpan={3}>Efectivo Esperado en Caja:</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(expectedCashInRegister)}</TableCell>
                            <TableCell colSpan={3}></TableCell>
                        </TableRow>
                        */}
                    </TableFooter>
                    )}
                </Table>
              </ScrollArea>
            </div>
        </CardContent>
      </Card>

      {/* Wizard de Fin de Día */}
       <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
         <DialogContent className="sm:max-w-lg">
           {renderWizardContent()}
         </DialogContent>
      </Dialog>
    </div>
  );
}
