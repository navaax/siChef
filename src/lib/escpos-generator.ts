'use client';
// src/lib/escpos-generator.ts

import type { SavedOrder } from '@/types/product-types';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import type { ConfiguredPrinter } from '@/services/printer-service';

// --- Comandos ESC/POS (Ejemplos - Estos deben ser los caracteres/bytes reales) ---
const ESC = '\x1B'; // Caracter de escape
const GS = '\x1D';
const NUL = '\x00';

const INIT_PRINTER = ESC + '@';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_RIGHT = ESC + 'a' + '\x02';
const TEXT_NORMAL = ESC + '!' + '\x00';
const TEXT_LARGE = ESC + '!' + '\x10'; // Doble altura
const TEXT_WIDE = ESC + '!' + '\x20'; // Doble ancho
const TEXT_LARGE_WIDE = ESC + '!' + '\x30'; // Doble altura y ancho
const PARTIAL_CUT = GS + 'V' + '\x01';
const FULL_CUT = GS + 'V' + '\x00';

/**
 * Genera una cadena de comandos ESC/POS para una comanda de cocina.
 * @param order El pedido a imprimir.
 * @returns Una cadena de comandos lista para ser enviada a una impresora ESC/POS.
 */
export function generateOrderSlipEscpos(order: SavedOrder): string {
    let commands = '';
    commands += INIT_PRINTER;
    commands += ALIGN_CENTER;
    commands += TEXT_LARGE_WIDE;
    commands += `COMANDA: #${order.orderNumber}\n`;
    commands += TEXT_NORMAL;
    commands += `${order.customerName}\n`;
    commands += `${format(new Date(order.createdAt), 'HH:mm')}\n`;
    commands += '--------------------------------\n';
    commands += ALIGN_LEFT;

    order.items.forEach(item => {
        commands += TEXT_LARGE;
        commands += `${item.quantity}x ${item.name}\n`;
        commands += TEXT_NORMAL;

        if (item.components && item.components.length > 0) {
            item.components.forEach(comp => {
                let compText = `  - ${comp.name}`;
                if (comp.servingStyle && comp.servingStyle !== "Normal") {
                    compText += ` (${comp.servingStyle})`;
                }
                if (comp.slotLabel && comp.slotLabel !== 'Contenido') {
                    compText += ` [${comp.slotLabel}]`;
                }
                commands += compText + '\n';
            });
        }
        commands += '\n'; // Espacio entre items
    });
    
    commands += '\n\n\n';
    commands += PARTIAL_CUT;

    return commands;
}

/**
 * Genera una cadena de comandos ESC/POS para un ticket de venta.
 * @param order El pedido a imprimir.
 * @returns Una cadena de comandos lista para ser enviada a una impresora ESC/POS.
 */
export function generateReceiptEscpos(order: SavedOrder): string {
    let commands = '';
    const businessName = localStorage.getItem('siChefSettings_businessName') || 'siChef POS';
    
    commands += INIT_PRINTER;
    commands += ALIGN_CENTER;
    commands += BOLD_ON;
    commands += `${businessName}\n`;
    commands += BOLD_OFF;
    commands += `Pedido #${order.orderNumber}\n`;
    commands += `Fecha: ${format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}\n`;
    commands += `Cliente: ${order.customerName}\n`;
    commands += '--------------------------------\n';
    commands += ALIGN_LEFT;

    order.items.forEach(item => {
        const itemPrice = formatCurrency(item.totalItemPrice);
        const line = `${item.quantity}x ${item.name}`;
        const spaces = 32 - line.length - itemPrice.length;
        commands += line + ' '.repeat(Math.max(0, spaces)) + itemPrice + '\n';

        if (item.components && item.components.length > 0) {
            item.components.forEach(comp => {
                let compText = `  - ${comp.name}`;
                if (comp.servingStyle && comp.servingStyle !== "Normal") {
                    compText += ` (${comp.servingStyle})`;
                }
                if (comp.extraCost && comp.extraCost > 0) {
                    compText += ` (+${formatCurrency(comp.extraCost)})`;
                }
                commands += compText + '\n';
            });
        }
    });

    commands += '--------------------------------\n';
    commands += ALIGN_RIGHT;
    commands += BOLD_ON;
    commands += `SUBTOTAL: ${formatCurrency(order.subtotal)}\n`;
    commands += TEXT_LARGE;
    commands += `TOTAL: ${formatCurrency(order.total)}\n`;
    commands += TEXT_NORMAL;
    commands += BOLD_OFF;
    commands += '--------------------------------\n';
    commands += ALIGN_LEFT;
    commands += `Metodo de Pago: ${order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1)}\n`;
    if (order.paymentMethod === 'cash') {
        if (order.paidAmount) commands += `Recibido: ${formatCurrency(order.paidAmount)}\n`;
        if (order.changeGiven) commands += `Cambio: ${formatCurrency(order.changeGiven)}\n`;
    }
    
    commands += ALIGN_CENTER;
    commands += '\n¡Gracias por tu compra!\n\n\n';
    commands += PARTIAL_CUT;

    return commands;
}
