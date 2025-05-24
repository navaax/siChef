// src/app/dashboard/create-order/ticket.ts
'use client'; // Necesario si se usa en componentes de cliente o si usa hooks

import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import type { SavedOrder, SavedOrderItemComponent } from '@/types/product-types';

// Función simple para escapar HTML
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
export async function generateTicketData(order: SavedOrder): Promise<string> {
  let html = `
    <html>
    <head>
      <style>
        body { font-family: 'Courier New', Courier, monospace; font-size: 10pt; margin: 0; padding: 5mm; width: 58mm; box-sizing: border-box; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .item-line { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .item-name { flex-grow: 1; margin-right: 5px; }
        .item-price { white-space: nowrap; }
        .components { margin-left: 15px; font-size: 9pt; color: #555; }
        .component-detail { font-style: italic; } /* Estilo para detalles como 'Aparte' */
        .separator { border-top: 1px dashed #000; margin: 5px 0; }
        .total-line { display: flex; justify-content: space-between; font-weight: bold; }
        .payment-line { display: flex; justify-content: space-between; }
        .footer { margin-top: 10px; text-align: center; font-size: 9pt; }
      </style>
    </head>
    <body>
  `;

  // --- Encabezado ---
  const businessName = localStorage.getItem('siChefSettings_businessName') || 'siChef POS'; // Obtener de config
  html += `<div class="center bold">${escapeHtml(businessName)}</div>\n`;
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

    if (item.components && item.components.length > 0) {
      html += `<div class="components">\n`;
      item.components.forEach(comp => {
        let compText = `↳ ${escapeHtml(comp.name)}`;
        if (comp.servingStyle && comp.servingStyle !== "Normal") {
            compText += ` <span class="component-detail">(${escapeHtml(comp.servingStyle)})</span>`;
        }
        if (comp.extraCost && comp.extraCost > 0) {
            compText += ` <span class="component-detail">(+${escapeHtml(formatCurrency(comp.extraCost))})</span>`;
        }
        const compLabel = comp.slotLabel && comp.slotLabel !== 'Mod' && comp.slotLabel !== 'Contenido'
            ? ` <span class_alias="component-detail">[${escapeHtml(comp.slotLabel)}]</span>` // Usar class_alias para evitar conflictos con style
            : '';
        html += `<div>${compText}${compLabel}</div>\n`;
      });
      html += `</div>\n`;
    }
  });
  html += `<div class="separator"></div>\n`;

  // --- Totales ---
  html += `<div class="payment-line"><span>Subtotal:</span> <span class="right">${escapeHtml(formatCurrency(order.subtotal))}</span></div>\n`;
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
    if (order.changeGiven !== undefined && order.changeGiven !== null && order.changeGiven > 0) {
        html += `<div class="payment-line"><span>Cambio:</span> <span class="right">${escapeHtml(formatCurrency(order.changeGiven))}</span></div>\n`;
    } else if (order.paidAmount !== undefined && order.paidAmount !== null && order.paidAmount < order.total) {
        html += `<div class="payment-line"><span>Faltante:</span> <span class="right">${escapeHtml(formatCurrency(order.total - order.paidAmount))}</span></div>\n`;
    }
  }
  html += `<div class="separator"></div>\n`;

  // --- Pie de Página ---
  html += `<div class="footer">¡Gracias por tu compra!</div>\n`;
  html += `
    </body>
    </html>
  `;

  console.log("Ticket HTML generado:\n", html);
  return html;
}
