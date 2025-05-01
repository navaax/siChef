"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// Placeholder component for settings sections
const SettingsSection = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => (
  <>
    <div className="mb-6">
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="space-y-4 mb-8">
      {children}
    </div>
    <Separator className="my-8" />
  </>
);

export default function SettingsPage() {

  // State for settings values (example)
  const [businessName, setBusinessName] = React.useState("siChef Restaurant");
  const [currencySymbol, setCurrencySymbol] = React.useState("$");
  const [printReceipts, setPrintReceipts] = React.useState(true);


  const handleSaveChanges = () => {
     // Add logic to save settings (e.g., to localStorage or backend)
     console.log("Saving settings...", { businessName, currencySymbol, printReceipts });
     alert("Settings saved (simulated).");
  }

  return (
    <div className="max-w-4xl mx-auto">
       <Card>
        <CardHeader>
          <CardTitle>Configuraciones</CardTitle>
          <CardDescription>Administra la configuración de tu punto de venta.</CardDescription>
        </CardHeader>
        <CardContent>

           <SettingsSection title="General" description="Configuración básica de la tienda.">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="businessName">Nombre del Negocio</Label>
                 <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Tu Restaurante" />
               </div>
                <div className="space-y-2">
                 <Label htmlFor="currencySymbol">Símbolo de Moneda</Label>
                 <Input id="currencySymbol" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} placeholder="$" className="w-20"/>
               </div>
             </div>
          </SettingsSection>

          <SettingsSection title="Impresión" description="Opciones para impresión de comandas y recibos.">
             <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="printReceipts"
                  checked={printReceipts}
                  onChange={(e) => setPrintReceipts(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                />
                <Label htmlFor="printReceipts" className="text-sm font-medium">Imprimir recibo al finalizar venta</Label>
            </div>
             {/* Add more printing options like printer selection etc. */}
          </SettingsSection>

           <SettingsSection title="Usuarios" description="Administrar cuentas de usuario.">
              <p className="text-sm text-muted-foreground">La gestión de usuarios (añadir/editar PIN) se puede implementar aquí.</p>
               {/* Example: Button to add user */}
               <Button variant="outline" disabled>Añadir Usuario (Próximamente)</Button>
          </SettingsSection>

           {/* Add more sections as needed (Taxes, Menu Management, etc.) */}


           <div className="mt-8 flex justify-end">
             <Button onClick={handleSaveChanges}>Guardar Cambios</Button>
           </div>

        </CardContent>
      </Card>
    </div>
  );
}
