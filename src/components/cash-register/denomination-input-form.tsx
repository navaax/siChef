'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from '@/lib/utils'; // Asegúrate de tener esta utilidad
import { denominations } from '@/config/denominations'; // Importar config
import type { StartCashFormData } from '@/types/cash-register-types'; // Importar tipo

// Generar esquema Zod dinámicamente basado en las denominaciones
const generateSchema = () => {
  const schemaFields: Record<string, z.ZodTypeAny> = {};
  denominations.forEach(denom => {
    schemaFields[String(denom.value)] = z.coerce.number().int().min(0, "Cantidad no puede ser negativa").optional().default(0);
  });
  return z.object(schemaFields);
};

const denominationSchema = generateSchema();
type DenominationFormValues = z.infer<typeof denominationSchema>;

interface DenominationInputFormProps {
  onSubmit: (data: StartCashFormData) => void;
  isLoading?: boolean;
  initialValues?: DenominationFormValues; // Para prellenar (ej. en conteo final)
  submitButtonText?: string;
}

export const DenominationInputForm: React.FC<DenominationInputFormProps> = ({
  onSubmit,
  isLoading = false,
  initialValues,
  submitButtonText = "Confirmar Monto Inicial"
}) => {
  const form = useForm<DenominationFormValues>({
    resolver: zodResolver(denominationSchema),
    defaultValues: initialValues || {},
  });

  const watchedValues = form.watch(); // Observar todos los valores

  // Calcular subtotales y total
  const [subtotals, total] = React.useMemo(() => {
    const subs: Record<string, number> = {};
    let currentTotal = 0;
    denominations.forEach(denom => {
      const valueStr = String(denom.value);
      const quantity = watchedValues[valueStr] ?? 0;
      const sub = denom.value * quantity;
      subs[valueStr] = sub;
      currentTotal += sub;
    });
    return [subs, currentTotal];
  }, [watchedValues]);

  const handleFormSubmit = (data: DenominationFormValues) => {
    const submitData: StartCashFormData = {
      denominations: data, // Zod ya parseó a números
      total: total,
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
      <ScrollArea className="h-[40vh] pr-4">
        <div className="grid grid-cols-3 gap-x-4 gap-y-3 items-center">
          {/* Encabezados */}
          <Label className="text-sm font-medium text-muted-foreground">Denominación</Label>
          <Label className="text-sm font-medium text-muted-foreground text-center">Cantidad</Label>
          <Label className="text-sm font-medium text-muted-foreground text-right">Subtotal</Label>

          {/* Filas de Denominaciones */}
          {denominations.map((denom) => {
            const valueStr = String(denom.value);
            return (
              <React.Fragment key={valueStr}>
                <Label htmlFor={valueStr} className="text-base font-semibold">{denom.label}</Label>
                <Controller
                  name={valueStr}
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id={valueStr}
                      type="number"
                      inputMode="numeric" // Para teclados móviles
                      min="0"
                      step="1"
                      className="text-center h-9"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseInt(e.target.value, 10))} // Manejar vacío y asegurar entero
                      value={field.value || ''} // Mostrar vacío si es 0 o undefined
                      aria-label={`Cantidad de ${denom.label}`}
                    />
                  )}
                />
                <span className="text-right text-sm tabular-nums">{formatCurrency(subtotals[valueStr] ?? 0)}</span>
              </React.Fragment>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between items-center text-lg font-bold">
          <Label>Total Calculado:</Label>
          <span>{formatCurrency(total)}</span>
        </div>
         {/* Botón de limpiar (opcional) */}
         <Button type="button" variant="outline" size="sm" onClick={() => form.reset()} disabled={isLoading}>
             Limpiar
         </Button>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || total <= 0}>
        {isLoading ? 'Procesando...' : submitButtonText}
      </Button>
    </form>
  );
};
