'use client';

import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import type { SavedOrder, SavedOrderItem, SavedOrderItemComponent } from '@/types/product-types';

// Simple HTML escaping function
function escapeHtml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * Genera el contenido HTML formateado para un ticket de impresora.
 * @param order Los datos del pedido finalizado.
 * @returns Una cadena HTML formateada para la impresora.
 */
export async function generateTicketData(order: SavedOrder): Promise<string> { // Marked as async
  let html = `
    <html>
    <head>
      <style>
        body {
          font-family: 'Courier New', Courier, monospace; /* Use monospace font for alignment */
          font-size: 10pt; /* Adjust font size as needed */
          margin: 0;
          padding: 5mm; /* Add some padding */
          width: 58mm; /* Typical width for thermal printers */
          box-sizing: border-box;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .item-line { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .item-name { flex-grow: 1; margin-right: 5px; }
        .item-price { white-space: nowrap; }
        .components { margin-left: 15px; font-size: 9pt; color: #555; }
        .separator { border-top: 1px dashed #000; margin: 5px 0; }
        .total-line { display: flex; justify-content: space-between; font-weight: bold; }
        .payment-line { display: flex; justify-content: space-between; }
        .footer { margin-top: 10px; text-align: center; font-size: 9pt; }
      </style>
    </head>
    <body>
  `;

  // --- Encabezado ---
  html += `<div class="center bold">siChef POS</div>\n`; // Nombre del Negocio
  html += `<div class="center">Pedido #${escapeHtml(String(order.orderNumber))}</div>\n`;
  html += `<div class="center">${escapeHtml(format(order.createdAt, 'dd/MM/yyyy HH:mm'))}</div>\n`;
  if (order.customerName && order.customerName !== 'Guest') {
    html += `<div class="center">Cliente: ${escapeHtml(order.customerName)}</div>\n`;
  }
  html += `<div class="separator"></div>\n`;

  // --- Items del Pedido ---
  order.items.forEach(item => {
    html += `<div class="item-line">\n`;
    html += `  <span class="item-name">${escapeHtml(String(item.quantity))}x ${escapeHtml(item.name)}</span>\n`;
    html += `  <span class="item-price">${escapeHtml(formatCurrency(item.totalItemPrice))}</span>\n`;
    html += `</div>\n`;

    // Mostrar componentes/modificadores
    if (item.components && item.components.length > 0) {
      html += `<div class="components">\n`;
      item.components.forEach(comp => {
        const compLabel = comp.slotLabel && comp.slotLabel !== 'Mod' && comp.slotLabel !== 'Contenido'
            ? ` [${escapeHtml(comp.slotLabel)}]`
            : '';
        html += `<div>↳ ${escapeHtml(comp.name)}${compLabel}</div>\n`;
      });
      html += `</div>\n`;
    }
  });
  html += `<div class="separator"></div>\n`;

  // --- Totales ---
  html += `<div class="payment-line"><span>Subtotal:</span> <span class="right">${escapeHtml(formatCurrency(order.subtotal))}</span></div>\n`;
  // Añadir impuestos/descuentos si aplica
  html += `<div class="separator"></div>\n`;
  html += `<div class="total-line"><span>TOTAL:</span> <span class="right">${escapeHtml(formatCurrency(order.total))}</span></div>\n`;
  html += `<div class="separator"></div>\n`;

  // --- Pago ---
  const paymentMethodDisplay = order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1);
  html += `<div class="payment-line"><span>Forma de Pago:</span> <span class="right">${escapeHtml(paymentMethodDisplay)}</span></div>\n`;
  if (order.paymentMethod === 'cash') {
    if (order.paidAmount !== undefined && order.paidAmount !== null) {
        html += `<div class="payment-line"><span>Recibido:</span> <span class="right">${escapeHtml(formatCurrency(order.paidAmount))}</span></div>\n`;
    }
    // Mostrar cambio solo si es positivo
    if (order.changeGiven !== undefined && order.changeGiven !== null && order.changeGiven > 0) {
        html += `<div class="payment-line"><span>Cambio:</span> <span class="right">${escapeHtml(formatCurrency(order.changeGiven))}</span></div>\n`;
    } else if (order.paidAmount !== undefined && order.paidAmount !== null && order.paidAmount < order.total) {
        html += `<div class="payment-line"><span>Faltante:</span> <span class="right">${escapeHtml(formatCurrency(order.total - order.paidAmount))}</span></div>\n`;
    }
  }
  html += `<div class="separator"></div>\n`;

  // --- Pie de Página ---
  html += `<div class="footer">¡Gracias por tu compra!</div>\n`;
  // Añadir más info si es necesario (dirección, teléfono, etc.)

  html += `
    </body>
    </html>
  `;

  console.log("Ticket HTML generado:\n", html);
  return html;
}
