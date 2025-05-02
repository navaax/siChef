// src/types/cash-register-types.ts

export type Denomination = {
  value: number; // e.g., 500, 200, 0.5
  label: string; // e.g., '$500', '$0.50'
  type: 'bill' | 'coin';
};

// Representa una línea en el formulario de entrada de denominaciones
export interface DenominationInput {
  value: number;
  quantity: number;
  subtotal: number;
}

// Representa el detalle de una denominación guardada en la BD
export interface CashSessionDetail {
  id: string;
  cash_session_id: string;
  type: 'start' | 'end';
  denomination_value: number;
  quantity: number;
  subtotal: number;
}

// Representa una sesión de caja
export interface CashSession {
  id: string;
  user_id?: string | null;
  start_time: string; // ISO Date string
  end_time?: string | null; // ISO Date string
  starting_cash: number;
  ending_cash?: number | null;
  total_cash_sales?: number | null; // Calculado
  total_card_sales?: number | null; // Calculado
  total_expenses?: number | null;
  total_tips?: number | null;
  loans_withdrawals_amount?: number | null;
  loans_withdrawals_reason?: string | null;
  calculated_difference?: number | null; // Calculado
  status: 'open' | 'closed';
}

// Para el formulario de inicio de caja
export interface StartCashFormData {
  denominations: Record<string, number>; // key: denomination value as string, value: quantity
  total: number;
}

// Para el formulario de fin de día (se construye en pasos)
export interface EndOfDayFormData {
  endingDenominations: Record<string, number>; // Denominación final
  endingCashTotal: number;
  expenses: number;
  tips: number;
  loanAmount: number;
  loanReason: string;
}
