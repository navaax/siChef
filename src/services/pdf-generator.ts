import type { CashSessionDetail } from "@/types/cash-register-types"; // Importar si se usan detalles

/**
 * Representa los datos del reporte de ventas.
 */
export interface SalesReport {
  /**
   * El nombre del negocio.
   */
  businessName: string;
  /**
   * El logo del negocio (como URL o imagen codificada en base64).
   */
  logo: string;
  /**
   * La fecha en que se generó el reporte.
   */
  reportDate: string;
  /**
   * El usuario que generó el reporte.
   */
  user: string;
  /**
   * El monto inicial de efectivo en caja.
   */
  startingCash: number;
  /**
   * El monto total de ventas (solo completadas).
   */
  totalSales: number;
  /**
   * El monto total de ventas pagadas en efectivo.
   */
  cashSales: number;
  /**
   * El monto total de ventas pagadas con tarjeta.
   */
  cardSales: number;
  /**
   * El monto total de gastos registrados.
   */
  totalExpenses: number;
  /**
   * El monto total de propinas registradas (en efectivo).
   */
  totalTips: number;
  /**
   * El monto de préstamos o retiros de caja.
   */
  loansWithdrawalsAmount: number;
  /**
   * El motivo del préstamo o retiro.
   */
  loansWithdrawalsReason: string;
   /**
   * El monto final de efectivo contado.
   */
  endingCash: number;
  /**
   * El monto de efectivo que se esperaba tener en caja.
   * Calculado como: startingCash + cashSales - totalExpenses - loansWithdrawalsAmount + totalTips
   */
  expectedCashInRegister: number;
  /**
   * La diferencia entre el efectivo contado y el esperado.
   * Calculado como: endingCash - expectedCashInRegister
   */
  calculatedDifference: number;
  /**
   * Los datos del historial de ventas (solo órdenes completadas).
   */
  salesHistory: SalesHistoryItem[];
  /**
   * Opcional: Detalles de denominación inicial.
   */
  // startDenominations?: CashSessionDetail[];
  /**
   * Opcional: Detalles de denominación final.
   */
  // endDenominations?: CashSessionDetail[];

}

/**
 * Representa un solo item en el historial de ventas.
 */
export interface SalesHistoryItem {
  /**
   * El número de pedido.
   */
  orderNumber: string;
  /**
   * El ID del pedido.
   */
  orderId: string;
  /**
   * El nombre del cliente.
   */
  customer: string;
  /**
   * El subtotal del pedido.
   */
  subtotal: number;
  /**
   * El monto total del pedido.
   */
  total: number;
  /**
   * El método de pago usado para el pedido.
   */
  paymentMethod: string;
  /**
   * El estado del pedido.
   */
  status: string;
}

/**
 * Genera asíncronamente un reporte de ventas en PDF.
 *
 * IMPORTANTE: Esta función actualmente devuelve un PDF vacío.
 * Necesitas implementar la lógica real de generación de PDF usando una librería
 * como jsPDF, PDFKit (lado del servidor), o un servicio de PDF dedicado.
 *
 * @param reportData Los datos a incluir en el reporte de ventas.
 * @returns Una promesa que resuelve a un documento PDF como un array de bytes.
 */
export async function generateSalesReport(reportData: SalesReport): Promise<Uint8Array> {
  // TODO: Implementar generación de PDF usando una librería como jsPDF o PDFKit.
  // Esto es un stub, reemplazar con lógica real de generación de PDF.

  console.log('--- Generando Reporte de Ventas PDF ---');
  console.log('Nombre Negocio:', reportData.businessName);
  console.log('Fecha Reporte:', reportData.reportDate);
  console.log('Usuario:', reportData.user);
  console.log('-----------------------------------');
  console.log('Fondo Inicial:', reportData.startingCash);
  console.log('Ventas Totales:', reportData.totalSales);
  console.log('Ventas Efectivo:', reportData.cashSales);
  console.log('Ventas Tarjeta:', reportData.cardSales);
  console.log('Gastos:', reportData.totalExpenses);
  console.log('Propinas:', reportData.totalTips);
  console.log('Préstamos/Retiros:', reportData.loansWithdrawalsAmount, `(${reportData.loansWithdrawalsReason || 'Sin motivo'})`);
  console.log('-----------------------------------');
  console.log('Efectivo Esperado:', reportData.expectedCashInRegister);
  console.log('Efectivo Contado:', reportData.endingCash);
  console.log('Diferencia:', reportData.calculatedDifference);
  console.log('-----------------------------------');
  console.log('Historial de Ventas:');

  console.log('\n--- Pagos en Efectivo ---');
  reportData.salesHistory
    .filter(item => item.paymentMethod === 'cash')
    .forEach(item => {
      console.log(`  #${item.orderNumber} (${item.orderId.substring(0,8)}) - ${item.customer} - Sub: ${item.subtotal} - Total: ${item.total} - ${item.status}`);
    });

   console.log('\n--- Pagos con Tarjeta ---');
    reportData.salesHistory
        .filter(item => item.paymentMethod === 'card')
        .forEach(item => {
            console.log(`  #${item.orderNumber} (${item.orderId.substring(0,8)}) - ${item.customer} - Sub: ${item.subtotal} - Total: ${item.total} - ${item.status}`);
        });

  console.log('-----------------------------------');
  console.warn('Generación de PDF no implementada. Devolviendo PDF vacío.');


  // Valor de retorno placeholder - Reemplazar con bytes reales del PDF
  return new Uint8Array();
}

/**
 * Ejemplo usando jsPDF (Lado del Cliente):
 *
 * import { jsPDF } from "jspdf";
 * import autoTable from 'jspdf-autotable'; // Necesita npm install jspdf jspdf-autotable
 * import { formatCurrency } from '@/lib/utils'; // Importar tu helper
 *
 * export async function generateSalesReport(reportData: SalesReport): Promise<Uint8Array> {
 *    const doc = new jsPDF();
 *    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
 *    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
 *    let currentY = 15; // Posición inicial
 *    const margin = 14;
 *
 *    // Encabezado
 *    doc.setFontSize(18);
 *    doc.text(reportData.businessName, pageWidth / 2, currentY, { align: 'center' });
 *    currentY += 8;
 *    doc.setFontSize(10);
 *    doc.text(`Reporte de Ventas - Fecha: ${reportData.reportDate}`, pageWidth / 2, currentY, { align: 'center' });
 *    currentY += 5;
 *    doc.text(`Generado por: ${reportData.user}`, pageWidth / 2, currentY, { align: 'center' });
 *    currentY += 10;
 *
 *    // Sección de Resumen Financiero
 *    doc.setFontSize(12);
 *    doc.text("Resumen Financiero", margin, currentY);
 *    currentY += 7;
 *    doc.setFontSize(10);
 *    const summaryCol1X = margin;
 *    const summaryCol2X = pageWidth / 2;
 *
 *    doc.text(`Fondo Inicial:`, summaryCol1X, currentY);
 *    doc.text(`${formatCurrency(reportData.startingCash)}`, summaryCol2X, currentY, {align: 'right'});
 *    currentY += 5;
 *    doc.text(`Ventas Efectivo:`, summaryCol1X, currentY);
 *    doc.text(`+ ${formatCurrency(reportData.cashSales)}`, summaryCol2X, currentY, {align: 'right'});
 *    currentY += 5;
 *    doc.text(`Ventas Tarjeta:`, summaryCol1X, currentY);
 *     doc.text(`${formatCurrency(reportData.cardSales)}`, summaryCol2X, currentY, {align: 'right'}); // No sumar al efectivo esperado
 *    currentY += 5;
 *     doc.text(`Gastos (-):`, summaryCol1X, currentY);
 *     doc.text(`- ${formatCurrency(reportData.totalExpenses)}`, summaryCol2X, currentY, {align: 'right'});
 *     currentY += 5;
 *     doc.text(`Propinas (+):`, summaryCol1X, currentY);
 *     doc.text(`+ ${formatCurrency(reportData.totalTips)}`, summaryCol2X, currentY, {align: 'right'});
 *     currentY += 5;
 *     doc.text(`Préstamos/Retiros (-):`, summaryCol1X, currentY);
 *     doc.text(`- ${formatCurrency(reportData.loansWithdrawalsAmount)}`, summaryCol2X, currentY, {align: 'right'});
 *     if(reportData.loansWithdrawalsReason) {
 *          currentY += 4;
 *          doc.setFontSize(8);
 *          doc.text(`   Motivo: ${reportData.loansWithdrawalsReason}`, summaryCol1X, currentY);
 *          doc.setFontSize(10);
 *     }
 *     currentY += 7;
 *
 *     // Línea separadora
 *     doc.setDrawColor(180); // Gris claro
 *     doc.line(margin, currentY, pageWidth - margin, currentY);
 *     currentY += 5;
 *
 *     doc.setFont(undefined, 'bold');
 *     doc.text(`Efectivo Esperado:`, summaryCol1X, currentY);
 *     doc.text(`${formatCurrency(reportData.expectedCashInRegister)}`, summaryCol2X, currentY, {align: 'right'});
 *     currentY += 5;
 *     doc.text(`Efectivo Contado:`, summaryCol1X, currentY);
 *     doc.text(`${formatCurrency(reportData.endingCash)}`, summaryCol2X, currentY, {align: 'right'});
 *     currentY += 7;
 *
 *      doc.setFontSize(12);
 *      doc.text(`Diferencia:`, summaryCol1X, currentY);
 *      const diffColor = reportData.calculatedDifference === 0 ? [0, 0, 0] : reportData.calculatedDifference > 0 ? [0, 100, 0] : [200, 0, 0]; // Negro, Verde, Rojo
 *      doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
 *      doc.text(`${formatCurrency(reportData.calculatedDifference)} ${reportData.calculatedDifference === 0 ? '' : reportData.calculatedDifference > 0 ? '(Sobrante)' : '(Faltante)'}`, summaryCol2X, currentY, {align: 'right'});
 *      doc.setTextColor(0, 0, 0); // Resetear color
 *      doc.setFont(undefined, 'normal');
 *      currentY += 10;
 *
 *    // Tabla de Historial de Ventas (usando jspdf-autotable)
 *    const head = [['#', 'Cliente', 'Subtotal', 'Total', 'Pago', 'Estado']];
 *    const body = reportData.salesHistory.map(item => [
 *        item.orderNumber,
 *        item.customer,
 *        formatCurrency(item.subtotal),
 *        formatCurrency(item.total),
 *        item.paymentMethod,
 *        item.status
 *    ]);
 *
 *    doc.setFontSize(12);
 *    doc.text("Detalle de Ventas Completadas", margin, currentY);
 *    currentY += 5;
 *
 *    autoTable(doc, {
 *        head: head,
 *        body: body,
 *        startY: currentY,
 *        theme: 'grid',
 *        headStyles: { fillColor: [0, 128, 128] }, // Encabezado Teal
 *        styles: { fontSize: 8 },
 *        columnStyles: {
 *             2: { halign: 'right' }, // Subtotal
 *             3: { halign: 'right' }, // Total
 *        },
 *        didDrawPage: (data) => { currentY = data.cursor?.y || currentY; } // Actualizar Y después de dibujar tabla
 *    });
 *    // currentY se actualiza dentro de didDrawPage
 *
 *    // Devolver bytes del PDF
 *    return doc.output('arraybuffer');
 * }
 *
 */
