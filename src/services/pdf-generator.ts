// src/services/pdf-generator.ts
import type { CashSessionDetail } from "@/types/cash-register-types"; // Importar si se usan detalles
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable'; // Necesita npm install jspdf jspdf-autotable
import { formatCurrency } from '@/lib/utils'; // Importar tu helper
import { format } from 'date-fns';

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
  logo?: string; // Hacer logo opcional
  /**
   * La fecha en que se generó el reporte (ISO string).
   */
  reportDate: string; // Usar ISO string
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
 * @param reportData Los datos a incluir en el reporte de ventas.
 * @returns Una promesa que resuelve a un documento PDF como un array de bytes.
 */
export async function generateSalesReport(reportData: SalesReport): Promise<Uint8Array> {
   const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
   const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
   const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
   let currentY = 15; // Posición inicial
   const margin = 14;
   const col1X = margin;
   const col2X = pageWidth - margin; // Alinear a la derecha

   console.log("Generando PDF con datos:", reportData); // Depuración

   // -- Encabezado --
   doc.setFontSize(18);
   doc.text(reportData.businessName, pageWidth / 2, currentY, { align: 'center' });
   currentY += 8;
   doc.setFontSize(10);
   // Usar la fecha del reporte pasada como parámetro
   doc.text(`Reporte de Ventas - Fecha: ${format(new Date(reportData.reportDate), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, currentY, { align: 'center' });
   currentY += 5;
   doc.text(`Generado por: ${reportData.user}`, pageWidth / 2, currentY, { align: 'center' });
   currentY += 10;

   // -- Sección de Resumen Financiero --
   doc.setFontSize(12);
   doc.text("Resumen Financiero", margin, currentY);
   currentY += 7;
   doc.setFontSize(10);

   const addSummaryLine = (label: string, value: number | string, options?: { sign?: '+' | '-' | ''; isBold?: boolean; isTotal?: boolean; align?: 'left' | 'right' }) => {
        const { sign = '', isBold = false, isTotal = false, align = 'right' } = options || {};
        const formattedValue = typeof value === 'number' ? formatCurrency(value) : value;

        if (isTotal) {
            doc.setDrawColor(180); // Gris claro
            doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2); // Línea separadora
            currentY += 3;
        }
        if (isBold) doc.setFont(undefined, 'bold');
        doc.text(label, col1X, currentY);
        doc.text(`${sign} ${formattedValue}`, col2X, currentY, { align: align });
        if (isBold) doc.setFont(undefined, 'normal');
        currentY += 6; // Espacio entre líneas
        // Check for page break
        if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = 15;
        }
   };

   addSummaryLine("Fondo Inicial:", reportData.startingCash);
   addSummaryLine("Ventas Efectivo:", reportData.cashSales, { sign: '+' });
   addSummaryLine("Ventas Tarjeta:", reportData.cardSales); // No afecta cálculo de efectivo
   addSummaryLine("Gastos:", reportData.totalExpenses, { sign: '-' });
   addSummaryLine("Propinas (Efectivo):", reportData.totalTips, { sign: '+' });
   addSummaryLine("Préstamos/Retiros:", reportData.loansWithdrawalsAmount, { sign: '-' });
   if(reportData.loansWithdrawalsReason) {
        doc.setFontSize(8);
        doc.text(`   Motivo: ${reportData.loansWithdrawalsReason}`, col1X + 5, currentY - 3); // Ajustar posición
        doc.setFontSize(10);
   }

   // Efectivo esperado
   addSummaryLine("Efectivo Esperado:", reportData.expectedCashInRegister, { isBold: true, isTotal: true });

   // Efectivo contado y diferencia
   addSummaryLine("Efectivo Contado:", reportData.endingCash, { isBold: true });

   // Diferencia (con color)
   doc.setFontSize(12);
   doc.setFont(undefined, 'bold');
   doc.text("Diferencia:", col1X, currentY);
   const diffColor = reportData.calculatedDifference === 0 ? [0, 0, 0] : reportData.calculatedDifference > 0 ? [0, 100, 0] : [200, 0, 0]; // Negro, Verde, Rojo
   doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
   doc.text(
     `${formatCurrency(reportData.calculatedDifference)} ${reportData.calculatedDifference === 0 ? '' : reportData.calculatedDifference > 0 ? '(Sobrante)' : '(Faltante)'}`,
     col2X,
     currentY,
     { align: 'right' }
   );
   doc.setTextColor(0, 0, 0); // Resetear color
   doc.setFont(undefined, 'normal');
   currentY += 12; // Más espacio después de la diferencia

    // -- Tablas de Historial de Ventas --
    const addSalesTable = (title: string, data: SalesHistoryItem[]) => {
        if (currentY > pageHeight - 40) { // Añadir nueva página si no hay espacio
             doc.addPage();
             currentY = 15;
        }
        doc.setFontSize(12);
        doc.text(title, margin, currentY);
        currentY += 7;

        if(data.length === 0){
            doc.setFontSize(10);
            doc.text("No hay pedidos para mostrar.", margin, currentY);
            currentY += 10;
            return;
        }

        const head = [['#', 'Cliente', 'Subtotal', 'Total', 'Método']];
        const body = data.map(item => [
            item.orderNumber,
            item.customer,
            formatCurrency(item.subtotal),
            formatCurrency(item.total),
            item.paymentMethod // Añadir método de pago
        ]);

        autoTable(doc, {
            head: head,
            body: body,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [0, 128, 128], fontSize: 9 }, // Encabezado Teal, ajustar tamaño
            styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' }, // Ancho para #
                1: { cellWidth: 'auto' }, // Cliente auto
                2: { halign: 'right', cellWidth: 25 }, // Subtotal
                3: { halign: 'right', cellWidth: 25 }, // Total
                4: { cellWidth: 20, halign: 'center' }, // Método Pago
            },
            didDrawPage: (hookData) => {
                currentY = hookData.cursor?.y ? hookData.cursor.y + 5 : currentY + 5; // Actualizar Y y añadir margen
            }
        });
        // Ya no se necesita currentY += 5 aquí, se maneja en didDrawPage
    };

    // Usar el historial de ventas pasado en reportData
    addSalesTable("Historial de Pedidos (Completados)", reportData.salesHistory);


   // Devolver bytes del PDF
   const pdfOutput = doc.output('arraybuffer');
   console.log(`Tamaño final del PDF: ${pdfOutput.byteLength} bytes`);
   return pdfOutput as Uint8Array; // Asegurar tipo de retorno
}
