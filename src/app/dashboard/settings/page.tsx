"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Removed Select
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react'; // Removed Wifi, Bluetooth, Usb
import { printTicket, PrinterError } from '@/services/printer-service'; // Importar servicio

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
  const { toast } = useToast();

  // State for settings values
  const [businessName, setBusinessName] = React.useState("siChef Restaurant");
  const [currencySymbol, setCurrencySymbol] = React.useState("$");
  const [printReceipts, setPrintReceipts] = React.useState(true);

  // State for printer settings - Simplified
  // const [isSearchingPrinters, setIsSearchingPrinters] = React.useState(false); // Removed
  // const [discoveredPrinters, setDiscoveredPrinters] = React.useState<DiscoveredPrinter[]>([]); // Removed
  // const [selectedPrinter, setSelectedPrinter] = React.useState<DiscoveredPrinter | null>(null); // Removed
  const [isTestingPrinter, setIsTestingPrinter] = React.useState(false);

  // Load settings on component mount
  React.useEffect(() => {
    const savedBusinessName = localStorage.getItem('siChefSettings_businessName');
    const savedCurrency = localStorage.getItem('siChefSettings_currencySymbol');
    const savedPrintReceipts = localStorage.getItem('siChefSettings_printReceipts');
    // Removed loading saved printer

    if (savedBusinessName) setBusinessName(savedBusinessName);
    if (savedCurrency) setCurrencySymbol(savedCurrency);
    if (savedPrintReceipts) setPrintReceipts(savedPrintReceipts === 'true');

  }, []);


  // Removed handleSearchPrinters function


  const handleSaveChanges = () => {
     // Guardar configuraciones generales
     localStorage.setItem('siChefSettings_businessName', businessName);
     localStorage.setItem('siChefSettings_currencySymbol', currencySymbol);
     localStorage.setItem('siChefSettings_printReceipts', String(printReceipts));

     // Removed saving selected printer

     console.log("Guardando configuraciones...", { businessName, currencySymbol, printReceipts });
     toast({ title: "Configuraciones Guardadas", description: "Los cambios han sido guardados localmente." });
  }

  const handleTestPrinter = async () => {
    // No need to check for selectedPrinter anymore
    setIsTestingPrinter(true);
    toast({ title: "Probando Impresora...", description: "Enviando página de prueba..." });

    // Create simple HTML test data
    const testHtml = `
        <html><head><style>body{font-family:monospace; font-size:10pt; margin:5mm; width:58mm;} .center{text-align:center;}</style></head><body>
        <div class="center">*** Página de Prueba siChef ***</div><br>
        <div>Fecha: ${new Date().toLocaleString()}</div><br>
        <div>--------------------------------</div><br>
        <div class="center">¡Conexión Exitosa!</div><br><br><br>
        </body></html>
    `;

    try {
      await printTicket(testHtml, "Prueba de Impresión siChef"); // Pass HTML to printTicket
      // The plugin opens the OS dialog, success here means the dialog was likely called
      toast({ title: "Diálogo de Impresión Mostrado", description: "Selecciona una impresora en el diálogo del sistema.", icon: <CheckCircle className="h-4 w-4 text-green-500"/> });
    } catch (error) {
      console.error("Error en la prueba de impresión:", error);
      const message = error instanceof PrinterError ? error.message : "Error desconocido al imprimir.";
      toast({ variant: "destructive", title: "Error de Impresión", description: message, icon: <XCircle className="h-4 w-4"/> });
    } finally {
      setIsTestingPrinter(false);
    }
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

          <SettingsSection title="Impresión" description="Configuración de impresión de recibos. La selección de impresora se realiza en el diálogo del sistema.">
             <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="printReceipts"
                  checked={printReceipts}
                  onChange={(e) => setPrintReceipts(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                  aria-labelledby="printReceiptsLabel"
                />
                <Label htmlFor="printReceipts" id="printReceiptsLabel" className="text-sm font-medium cursor-pointer">Imprimir recibo al finalizar venta</Label>
            </div>

            {/* Removed Printer Search and Selection UI */}

            {/* Botón de Prueba */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestPrinter}
              disabled={isTestingPrinter} // Disable only while testing
              className="mt-2"
            >
              {isTestingPrinter ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Probar Impresión (Abre Diálogo)
            </Button>

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
