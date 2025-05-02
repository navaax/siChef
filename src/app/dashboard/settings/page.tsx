"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added Select
import { useToast } from '@/hooks/use-toast'; // Added useToast
import { Wifi, Bluetooth, Usb, Loader2 } from 'lucide-react'; // Added icons

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

  // State for printer settings (example)
  const [isSearchingPrinters, setIsSearchingPrinters] = React.useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = React.useState<{id: string, name: string, type: 'usb' | 'bluetooth' | 'wifi'}[]>([]);
  const [selectedPrinter, setSelectedPrinter] = React.useState<string | null>(null);

  // Load settings on component mount (including printer)
  React.useEffect(() => {
    const savedBusinessName = localStorage.getItem('siChefSettings_businessName');
    const savedCurrency = localStorage.getItem('siChefSettings_currencySymbol');
    const savedPrintReceipts = localStorage.getItem('siChefSettings_printReceipts');
    const savedPrinter = localStorage.getItem('siChefSettings_selectedPrinter');

    if (savedBusinessName) setBusinessName(savedBusinessName);
    if (savedCurrency) setCurrencySymbol(savedCurrency);
    if (savedPrintReceipts) setPrintReceipts(savedPrintReceipts === 'true');
    if (savedPrinter) setSelectedPrinter(savedPrinter);

     // Simulate finding a previously saved printer (for UI display)
    if(savedPrinter) {
        setDiscoveredPrinters([{ id: savedPrinter, name: `Impresora Guardada (${savedPrinter.substring(0,8)}...)`, type: 'wifi' }]);
    }

  }, []);


  const handleSearchPrinters = async (type: 'usb' | 'bluetooth' | 'wifi') => {
     setIsSearchingPrinters(true);
     setDiscoveredPrinters([]); // Clear previous results
     console.log(`Buscando impresoras ${type}...`);
     toast({ title: `Buscando impresoras ${type}...`, description: "Esto puede tomar unos segundos." });

     // --- SIMULACIÓN ---
     // Aquí iría la lógica real para buscar impresoras usando un plugin de Capacitor
     // Por ahora, simularemos encontrar algunas impresoras después de un tiempo
     await new Promise(resolve => setTimeout(resolve, 2500));

     let foundPrinters: {id: string, name: string, type: 'usb' | 'bluetooth' | 'wifi'}[] = [];
     if (type === 'bluetooth') {
         foundPrinters = [
             { id: 'BT:00:11:22:33:FF:EE', name: 'POS-Printer-BT', type: 'bluetooth' },
             { id: 'BT:AA:BB:CC:DD:EE:FF', name: 'Printer_XYZ', type: 'bluetooth' },
         ];
     } else if (type === 'wifi') {
         foundPrinters = [
             { id: 'WIFI:192.168.1.100', name: 'EPSON_TM-T88VI', type: 'wifi' },
             { id: 'WIFI:192.168.1.105', name: 'Generic POS Printer', type: 'wifi' },
         ];
     } else { // usb
         foundPrinters = [
             { id: 'USB:/dev/usb/lp0', name: 'USB Thermal Printer', type: 'usb' },
         ];
     }
     // --- FIN SIMULACIÓN ---

     setDiscoveredPrinters(foundPrinters);
     setIsSearchingPrinters(false);
      toast({ title: "Búsqueda Finalizada", description: `Se encontraron ${foundPrinters.length} impresoras ${type}.` });
   };

  const handleSaveChanges = () => {
     // Guardar configuraciones generales
     localStorage.setItem('siChefSettings_businessName', businessName);
     localStorage.setItem('siChefSettings_currencySymbol', currencySymbol);
     localStorage.setItem('siChefSettings_printReceipts', String(printReceipts));

     // Guardar impresora seleccionada
     if (selectedPrinter) {
       localStorage.setItem('siChefSettings_selectedPrinter', selectedPrinter);
       console.log("Impresora seleccionada guardada:", selectedPrinter);
     } else {
       localStorage.removeItem('siChefSettings_selectedPrinter');
       console.log("Ninguna impresora seleccionada para guardar.");
     }

     console.log("Guardando configuraciones...", { businessName, currencySymbol, printReceipts, selectedPrinter });
     toast({ title: "Configuraciones Guardadas", description: "Los cambios han sido guardados localmente." });
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

          <SettingsSection title="Impresión" description="Configuración de la impresora de comandas y recibos.">
             <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="printReceipts"
                  checked={printReceipts}
                  onChange={(e) => setPrintReceipts(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                />
                <Label htmlFor="printReceipts" className="text-sm font-medium">Imprimir recibo al finalizar venta</Label>
            </div>

            <div className='space-y-4'>
                <Label>Buscar Impresoras</Label>
                <div className='flex flex-wrap gap-2'>
                    <Button variant="outline" size="sm" onClick={() => handleSearchPrinters('bluetooth')} disabled={isSearchingPrinters}>
                        {isSearchingPrinters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bluetooth className="mr-2 h-4 w-4" />}
                        Bluetooth
                    </Button>
                     <Button variant="outline" size="sm" onClick={() => handleSearchPrinters('wifi')} disabled={isSearchingPrinters}>
                         {isSearchingPrinters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                        WiFi/Red
                    </Button>
                     <Button variant="outline" size="sm" onClick={() => handleSearchPrinters('usb')} disabled={isSearchingPrinters}>
                         {isSearchingPrinters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Usb className="mr-2 h-4 w-4" />}
                        USB
                    </Button>
                </div>

                {isSearchingPrinters && <p className="text-sm text-muted-foreground">Buscando...</p>}

                 <div className='space-y-2'>
                     <Label htmlFor="selectPrinter">Seleccionar Impresora</Label>
                      <Select
                         value={selectedPrinter ?? "__NONE__"}
                         onValueChange={(value) => setSelectedPrinter(value === "__NONE__" ? null : value)}
                         disabled={discoveredPrinters.length === 0 && !selectedPrinter} // Deshabilitar si no hay descubiertas Y no hay una seleccionada previamente
                     >
                        <SelectTrigger id="selectPrinter">
                            <SelectValue placeholder="Selecciona una impresora encontrada..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__NONE__">-- Ninguna --</SelectItem>
                            {discoveredPrinters.map(printer => (
                                <SelectItem key={printer.id} value={printer.id}>
                                    {printer.name} ({printer.type.toUpperCase()})
                                </SelectItem>
                            ))}
                            {discoveredPrinters.length === 0 && !isSearchingPrinters && !selectedPrinter && (
                                <SelectItem value="__EMPTY__" disabled>No se encontraron impresoras. Realiza una búsqueda.</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                 </div>
            </div>

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