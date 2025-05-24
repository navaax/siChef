
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
import { Download, FileText, Loader2, ReceiptText, HandCoins, Gift, Landmark, CalendarIcon } from 'lucide-react'; // Icons, added CalendarIcon
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { useCashRegister } from '@/contexts/cash-register-context'; // Importar hook de caja
import { generateSalesReport, type SalesReport, type SalesHistoryItem } from '@/services/pdf-generator';
import { closeCashSession } from '@/services/cash-register-service'; // Importar servicio de caja
import type { SavedOrder } from '@/types/product-types'; // Import SavedOrder type
import { formatCurrency } from '@/lib/utils'; // Importar utilidad de formato
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DenominationInputForm } from '@/components/cash-register/denomination-input-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { StartCashFormData, EndOfDayFormData } from '@/types/cash-register-types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Helper para obtener variante de badge de estado
const getStatusVariant = (status: SavedOrder['status']): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
  switch (status) {
    case 'completed': return 'secondary';
    case 'cancelled': return 'destructive';
    case 'pending':
    default: return 'default';
  }
};

type WizardStep = 'countCash' | 'expenses' | 'tips' | 'loans' | 'summary' | 'confirm';

// --- Componente ---
export default function ReportsPage() {
  const { username } = useAuth();
  const { currentSession, clearSession } = useCashRegister(); // Obtener sesión de caja actual
  const { toast } = useToast();
  const [allOrders, setAllOrders] = useState<SavedOrder[]>([]); // Todas las órdenes cargadas
  const [filteredOrders, setFilteredOrders] = useState<SavedOrder[]>([]); // Órdenes filtradas por fecha
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date()); // Fecha seleccionada para filtrar
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

   // Cargar pedidos desde localStorage al montar
  useEffect(() => {
    const storedOrders = localStorage.getItem('siChefOrders');
    if (storedOrders) {
      try {
           const parsedOrders: SavedOrder[] = JSON.parse(storedOrders).map((order: any) => ({
              ...order,
              createdAt: new Date(order.createdAt), // Asegurar que es un objeto Date
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
           setAllOrders(parsedOrders);
      } catch (error) {
          console.error("Fallo al parsear pedidos desde localStorage:", error);
          toast({ title: "Error al Cargar Pedidos", description: "No se pudieron cargar los datos de ventas anteriores.", variant: "destructive" });
      }
    }
  }, [toast]);

  // Filtrar pedidos basado en la fecha seleccionada
  useEffect(() => {
    if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const filtered = allOrders.filter(order =>
        order.createdAt >= startOfDay && order.createdAt <= endOfDay
      );
      setFilteredOrders(filtered);
    } else {
      setFilteredOrders(allOrders); // Mostrar todos si no hay fecha seleccionada
    }
  }, [selectedDate, allOrders]);

  // Calcular totales para el reporte (usando filteredOrders)
  // Estos son los totales que se muestran en la tabla de resumen de la UI y que se USAN como base para el wizard
  const completedOrdersForUI = filteredOrders.filter(o => o.status === 'completed');
  const totalSalesForUI = completedOrdersForUI.reduce((sum, order) => sum + order.total, 0);
  const cashSalesForUI = completedOrdersForUI.filter(o => o.paymentMethod === 'cash').reduce((sum, order) => sum + order.total, 0);
  const cardSalesForUI = completedOrdersForUI.filter(o => o.paymentMethod === 'card').reduce((sum, order) => sum + order.total, 0);
  
  // Estos se calcularán DENTRO de handleFinalizeDay para asegurar consistencia con los datos del momento
  let expectedCashInRegister = 0;
  let cashDifference = 0;
  let startingCashForSummary = currentSession?.starting_cash ?? 0;

  if (wizardStep === 'summary' || wizardStep === 'confirm') {
    startingCashForSummary = currentSession?.starting_cash ?? 0;
    // Usa los totales DE LA UI para el resumen, pero los finales se recalculan en handleFinalizeDay
    const tempCashSales = completedOrdersForUI.filter(o => o.paymentMethod === 'cash').reduce((sum, order) => sum + order.total, 0);
    expectedCashInRegister = startingCashForSummary + tempCashSales
                                - (endOfDayData.expenses ?? 0)
                                - (endOfDayData.loanAmount ?? 0)
                                + (endOfDayData.tips ?? 0);
    cashDifference = (endOfDayData.endingCashTotal ?? 0) - expectedCashInRegister;
  }


  const handleOpenWizard = () => {
    if (!currentSession) {
        toast({ title: "Sin Sesión Activa", description: "No hay una sesión de caja activa para cerrar.", variant: "destructive" });
        return;
    }
    setWizardStep('countCash');
    setEndOfDayData({
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
        if ((endOfDayData.endingCashTotal ?? -1) < 0) {
            toast({title: "Conteo Inválido", description: "Ingresa el conteo de efectivo final (puede ser 0).", variant:"destructive"});
            return;
        }
        setWizardStep('expenses');
        break;
      case 'expenses': setWizardStep('tips'); break;
      case 'tips': setWizardStep('loans'); break;
      case 'loans': setWizardStep('summary'); break;
      case 'summary': setWizardStep('confirm'); break;
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
    handleNextStep();
  };

  const handleFinalizeDay = async () => {
    if (!currentSession) {
        toast({ title: "Error", description: "No hay sesión activa para cerrar.", variant: "destructive" });
        return;
    }
    setIsGeneratingPdf(true);
    toast({ title: "Generando Reporte...", description: "Preparando el PDF de ventas y cerrando caja." });

    const reportTimestamp = new Date();
    let ordersForReport: SavedOrder[];

    if (selectedDate) {
        const startOfDay = new Date(selectedDate); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(selectedDate); endOfDay.setHours(23,59,59,999);
        ordersForReport = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return order.status === 'completed' && orderDate >= startOfDay && orderDate <= endOfDay;
        });
        console.log(`[handleFinalizeDay] Pedidos para reporte (fecha seleccionada ${format(selectedDate, 'yyyy-MM-dd')}): ${ordersForReport.length} pedidos.`);
    } else {
        const sessionStartTime = new Date(currentSession.start_time).getTime();
        ordersForReport = allOrders.filter(order =>
            order.status === 'completed' && new Date(order.createdAt).getTime() >= sessionStartTime
        );
        console.warn(`[handleFinalizeDay] No hay fecha seleccionada para el reporte, usando ${ordersForReport.length} órdenes completadas desde el inicio de la sesión actual (${format(new Date(currentSession.start_time), 'Pp')}).`);
    }
    // console.log('[handleFinalizeDay] Pedidos seleccionados para el reporte:', JSON.stringify(ordersForReport.map(o => ({id: o.id, total: o.total, date: o.createdAt})), null, 2));


    const finalTotalSales = ordersForReport.reduce((sum, order) => sum + order.total, 0);
    const finalCashSales = ordersForReport.filter(o => o.paymentMethod === 'cash').reduce((sum, order) => sum + order.total, 0);
    const finalCardSales = ordersForReport.filter(o => o.paymentMethod === 'card').reduce((sum, order) => sum + order.total, 0);
    const finalStartingCash = currentSession.starting_cash;

    const finalExpectedCash = finalStartingCash + finalCashSales
                              - (endOfDayData.expenses ?? 0)
                              - (endOfDayData.loanAmount ?? 0)
                              + (endOfDayData.tips ?? 0);
    const finalCashDifference = (endOfDayData.endingCashTotal ?? 0) - finalExpectedCash;

    const reportData: SalesReport = {
        businessName: localStorage.getItem('siChefSettings_businessName') || "siChef POS",
        reportDate: reportTimestamp.toISOString(),
        user: username || 'Usuario Desconocido',
        startingCash: finalStartingCash,
        totalSales: finalTotalSales,
        cashSales: finalCashSales,
        cardSales: finalCardSales,
        totalExpenses: endOfDayData.expenses ?? 0,
        totalTips: endOfDayData.tips ?? 0,
        loansWithdrawalsAmount: endOfDayData.loanAmount ?? 0,
        loansWithdrawalsReason: endOfDayData.loanReason ?? '',
        endingCash: endOfDayData.endingCashTotal ?? 0,
        expectedCashInRegister: finalExpectedCash,
        calculatedDifference: finalCashDifference,
        salesHistory: ordersForReport.map(order => ({
            orderNumber: String(order.orderNumber),
            orderId: order.id,
            customer: order.customerName,
            subtotal: order.subtotal,
            total: order.total,
            paymentMethod: order.paymentMethod,
            status: order.status,
        })),
    };
    console.log("[handleFinalizeDay] Objeto reportData final para PDF:", JSON.stringify(reportData, null, 2));


    try {
        const pdfBytes = await generateSalesReport(reportData);
        console.log(`[handleFinalizeDay] Bytes del PDF generados (longitud): ${pdfBytes?.length}`);

        if (!pdfBytes || pdfBytes.length === 0) {
             console.error('[handleFinalizeDay] generateSalesReport devolvió un array vacío o nulo. El PDF no se descargará.');
             toast({ title: "Error Reporte", description: "No se pudo generar el archivo PDF (datos vacíos o error interno en la generación).", variant: "destructive" });
             setIsGeneratingPdf(false);
             return; // Salir si no hay bytes de PDF
        }

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const timestampStr = format(reportTimestamp, 'yyyyMMdd_HHmmss');
        link.download = `siChef_ReporteVentas_${timestampStr}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast({ title: "Reporte Generado", description: "Descarga de PDF iniciada." });

        await closeCashSession(
            currentSession.id,
            endOfDayData.endingCashTotal ?? 0,
            finalCashSales,
            finalCardSales,
            endOfDayData.expenses ?? 0,
            endOfDayData.tips ?? 0,
            endOfDayData.loanAmount ?? 0,
            endOfDayData.loanReason ?? ''
        );

        const remainingOrders = allOrders.filter(o => {
           const orderTime = new Date(o.createdAt).getTime();
           if (o.status === 'completed') {
               if (selectedDate) {
                   const startOfDayReport = new Date(selectedDate); startOfDayReport.setHours(0,0,0,0);
                   const endOfDayReport = new Date(selectedDate); endOfDayReport.setHours(23,59,59,999);
                   return orderTime < startOfDayReport.getTime() || orderTime > endOfDayReport.getTime();
               } else {
                   return orderTime < new Date(currentSession.start_time).getTime();
               }
           }
           return true;
        });

        localStorage.setItem('siChefOrders', JSON.stringify(remainingOrders));
        setAllOrders(remainingOrders);
        setSelectedDate(prevDate => prevDate ? new Date(prevDate) : undefined);

        clearSession();
        setIsWizardOpen(false);

        toast({ title: "Día Finalizado", description: "Ventas completadas archivadas, caja cerrada." });

    } catch (error) {
        console.error("[handleFinalizeDay] Error finalizando día / generando PDF:", error);
        toast({ title: "Operación Fallida", description: `No se pudo finalizar el día o generar el reporte: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
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
              isLoading={isGeneratingPdf}
              submitButtonText="Siguiente: Gastos"
            />
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
      case 'confirm':
        // Recalcular aquí para asegurar que el resumen usa los datos actuales de endOfDayData
        const summaryStartingCash = currentSession?.starting_cash ?? 0;
        const summaryCashSales = completedOrdersForUI.filter(o => o.paymentMethod === 'cash').reduce((sum, order) => sum + order.total, 0);
        const summaryExpectedCash = summaryStartingCash + summaryCashSales
                                    - (endOfDayData.expenses ?? 0)
                                    - (endOfDayData.loanAmount ?? 0)
                                    + (endOfDayData.tips ?? 0);
        const summaryCashDifference = (endOfDayData.endingCashTotal ?? 0) - summaryExpectedCash;

        return (
          <>
            <DialogHeader>
               <DialogTitle>Paso 5: Resumen y Confirmación</DialogTitle>
               <DialogDescription>Revisa los totales antes de finalizar el día.</DialogDescription>
            </DialogHeader>
             <div className="space-y-3 py-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Fondo Inicial:</span> <span>{formatCurrency(summaryStartingCash)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ventas Efectivo (Día Seleccionado):</span> <span className="text-green-600">+ {formatCurrency(summaryCashSales)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ventas Tarjeta (Día Seleccionado):</span> <span>{formatCurrency(cardSalesForUI)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gastos:</span> <span className="text-red-600">- {formatCurrency(endOfDayData.expenses ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Propinas (Efectivo):</span> <span className="text-green-600">+ {formatCurrency(endOfDayData.tips ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Préstamos/Retiros:</span> <span className="text-red-600">- {formatCurrency(endOfDayData.loanAmount ?? 0)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-2"><span >Efectivo Esperado:</span> <span>{formatCurrency(summaryExpectedCash)}</span></div>
                <div className="flex justify-between font-semibold"><span >Efectivo Contado:</span> <span>{formatCurrency(endOfDayData.endingCashTotal ?? 0)}</span></div>
                 <div className={`flex justify-between font-bold text-lg border-t pt-2 ${summaryCashDifference === 0 ? '' : summaryCashDifference > 0 ? 'text-green-700' : 'text-destructive'}`}>
                    <span >Diferencia:</span>
                    <span>{formatCurrency(summaryCashDifference)} {summaryCashDifference === 0 ? '' : summaryCashDifference > 0 ? '(Sobrante)' : '(Faltante)'}</span>
                 </div>
                 {endOfDayData.loanReason && <p className="text-xs text-muted-foreground pt-2">Motivo Préstamo/Retiro: {endOfDayData.loanReason}</p>}
             </div>
             <p className="text-xs text-center text-muted-foreground mt-4">
                 Al confirmar, se cerrará la sesión de caja actual, se generará el reporte PDF para el día <strong>{selectedDate ? format(selectedDate, "PPP") : 'seleccionado'}</strong> y se limpiarán las ventas completadas de ese día.
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
             <CardDescription>Historial de pedidos por fecha.</CardDescription>
          </div>
          <div className="flex items-center gap-4">
             <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Selecciona fecha</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
             <Button onClick={handleOpenWizard} disabled={isGeneratingPdf || !currentSession} size="sm">
                 {isGeneratingPdf ? (
                     <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                     </>
                 ) : (
                     <>
                        <Download className="mr-2 h-4 w-4" /> Finalizar Día Actual y Exportar
                     </>
                 )}
             </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
           <div className="relative h-full">
             <ScrollArea className="absolute inset-0">
                 <Table className="min-w-full">
                   <TableHeader>
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
                    {filteredOrders.length > 0 ? (
                      filteredOrders
                         .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
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
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                            {selectedDate ? `No hay pedidos para el ${format(selectedDate, 'PPP')}.` : 'No hay historial de ventas aún.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                   {completedOrdersForUI.length > 0 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3}>Resumen del Día ({selectedDate ? format(selectedDate, 'PPP') : 'Todos'}) (Pedidos Completados)</TableCell>
                            <TableCell className="text-right">Subtotal</TableCell>
                             <TableCell className="text-right">Total</TableCell>
                             <TableCell colSpan={3}></TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell colSpan={3}>Ventas en Efectivo:</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(cashSalesForUI)}</TableCell>
                            <TableCell colSpan={3}></TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell colSpan={3}>Ventas con Tarjeta:</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(cardSalesForUI)}</TableCell>
                             <TableCell colSpan={3}></TableCell>
                         </TableRow>
                         <TableRow className="text-base font-bold">
                            <TableCell colSpan={3}>Venta Total (Completados):</TableCell>
                             <TableCell className="text-right"></TableCell>
                             <TableCell className="text-right">{formatCurrency(totalSalesForUI)}</TableCell>
                             <TableCell colSpan={3}></TableCell>
                         </TableRow>
                    </TableFooter>
                    )}
                </Table>
              </ScrollArea>
            </div>
        </CardContent>
      </Card>

       <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
         <DialogContent className="sm:max-w-lg">
           {renderWizardContent()}
         </DialogContent>
      </Dialog>
    </div>
  );
}

