// src/config/denominations.ts
import type { Denomination } from '@/types/cash-register-types';

// Definir las denominaciones de moneda/billete disponibles
export const denominations: Denomination[] = [
  { value: 500, label: '$500', type: 'bill' },
  { value: 200, label: '$200', type: 'bill' },
  { value: 100, label: '$100', type: 'bill' },
  { value: 50, label: '$50', type: 'bill' },
  { value: 20, label: '$20', type: 'bill' },
  { value: 10, label: '$10', type: 'coin' },
  { value: 5, label: '$5', type: 'coin' },
  { value: 2, label: '$2', type: 'coin' },
  { value: 1, label: '$1', type: 'coin' },
  { value: 0.50, label: '$0.50', type: 'coin' },
];

// Ordenar por valor descendente para la UI
denominations.sort((a, b) => b.value - a.value);
