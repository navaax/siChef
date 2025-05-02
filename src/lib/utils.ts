import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda (USD por defecto).
 * @param amount El monto a formatear.
 * @returns Una cadena formateada como moneda (ej. '$1,234.56') o '$0.00' si es inválido.
 */
export const formatCurrency = (amount: number | null | undefined): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        // Devolver un valor predeterminado o manejar el error como prefieras
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    // Puedes cambiar 'en-US' y 'USD' por la localización y moneda deseadas (ej. 'es-MX', 'MXN')
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};
