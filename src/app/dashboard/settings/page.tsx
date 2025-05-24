
/**
 * Página de configuración para la aplicación siChef POS.
 * Permite al usuario ajustar configuraciones generales y de impresión.
 */
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { printTicket, PrinterError } from '@/services/printer-service';
import { v4 as uuidv4 } from 'uuid'; // Importar uuid para generar IDs en cliente

// Componente de sección reutilizable
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

// Tipos para las impresoras configuradas
interface ConfiguredPrinter {
  id: string;
  name: string;
  connectionType: 'network' | 'bluetooth' | 'usb';
  address: string; // IP para red, MAC para BT, o identificador USB
  role: string; // ej. "Comandas", "Recibos Cliente"
}

export default function SettingsPage() {
  const { toast } = useToast();

  // Estado para valores de configuración general
  const [businessName, setBusinessName] = React.useState("siChef Restaurant");
  const [currencySymbol, setCurrencySymbol] = React.useState("$");
  const [printReceipts, setPrintReceipts] = React.useState(true);

  // Nuevos estados para Configuración de Tienda
  const [subscriptionType, setSubscriptionType] = React.useState("siChef Básico (Gratuito)"); // Placeholder
  const [businessType, setBusinessType] = React.useState("restaurante");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [deviceType, setDeviceType] = React.useState("matriz");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [founders, setFounders] = React.useState("");

  // Nuevos estados para Configuración de Impresoras
  const [printFormat, setPrintFormat] = React.useState("80mm");
  const [configuredPrinters, setConfiguredPrinters] = React.useState<ConfiguredPrinter[]>([]);
  const [isPrinterDialogOpen, setIsPrinterDialogOpen] = React.useState(false);
  const [editingPrinter, setEditingPrinter] = React.useState<ConfiguredPrinter | null>(null);

  // Estados para el formulario del diálogo de impresora
  const [printerName, setPrinterName] = React.useState("");
  const [printerConnectionType, setPrinterConnectionType] = React.useState<'network' | 'bluetooth' | 'usb'>('network');
  const [printerAddress, setPrinterAddress] = React.useState("");
  const [printerRole, setPrinterRole] = React.useState("");


  // Estado para prueba de impresora
  const [isTestingPrinter, setIsTestingPrinter] = React.useState(false);

  // Cargar configuración al montar el componente
  React.useEffect(() => {
    const loadSettings = () => {
      try {
        setBusinessName(localStorage.getItem('siChefSettings_businessName') || "siChef Restaurant");
        setCurrencySymbol(localStorage.getItem('siChefSettings_currencySymbol') || "$");
        setPrintReceipts(localStorage.getItem('siChefSettings_printReceipts') === 'true');

        setSubscriptionType(localStorage.getItem('siChefSettings_subscriptionType') || "siChef Básico (Gratuito)");
        setBusinessType(localStorage.getItem('siChefSettings_businessType') || "restaurante");
        setLogoUrl(localStorage.getItem('siChefSettings_logoUrl') || "");
        setDeviceType(localStorage.getItem('siChefSettings_deviceType') || "matriz");
        setPhoneNumber(localStorage.getItem('siChefSettings_phoneNumber') || "");
        setEmail(localStorage.getItem('siChefSettings_email') || "");
        setFounders(localStorage.getItem('siChefSettings_founders') || "");

        setPrintFormat(localStorage.getItem('siChefSettings_printFormat') || "80mm");
        const savedPrinters = localStorage.getItem('siChefSettings_configuredPrinters');
        if (savedPrinters) {
          setConfiguredPrinters(JSON.parse(savedPrinters));
        }
      } catch (error) {
        console.error("Error cargando configuraciones de localStorage:", error);
        toast({ variant: "destructive", title: "Error al Cargar", description: "No se pudieron cargar algunas configuraciones." });
      }
    };
    loadSettings();
  }, [toast]);

  const handleSaveChanges = () => {
     localStorage.setItem('siChefSettings_businessName', businessName);
     localStorage.setItem('siChefSettings_currencySymbol', currencySymbol);
     localStorage.setItem('siChefSettings_printReceipts', String(printReceipts));

     localStorage.setItem('siChefSettings_subscriptionType', subscriptionType);
     localStorage.setItem('siChefSettings_businessType', businessType);
     localStorage.setItem('siChefSettings_logoUrl', logoUrl);
     localStorage.setItem('siChefSettings_deviceType', deviceType);
     localStorage.setItem('siChefSettings_phoneNumber', phoneNumber);
     localStorage.setItem('siChefSettings_email', email);
     localStorage.setItem('siChefSettings_founders', founders);

     localStorage.setItem('siChefSettings_printFormat', printFormat);
     localStorage.setItem('siChefSettings_configuredPrinters', JSON.stringify(configuredPrinters));

     console.log("Guardando configuraciones...", { /* todos los estados */ });
     toast({ title: "Configuraciones Guardadas", description: "Los cambios han sido guardados localmente." });
  }

  const handleOpenPrinterDialog = (printer: ConfiguredPrinter | null = null) => {
    setEditingPrinter(printer);
    if (printer) {
      setPrinterName(printer.name);
      setPrinterConnectionType(printer.connectionType);
      setPrinterAddress(printer.address);
      setPrinterRole(printer.role);
    } else {
      setPrinterName("");
      setPrinterConnectionType('network');
      setPrinterAddress("");
      setPrinterRole("");
    }
    setIsPrinterDialogOpen(true);
  };

  const handleSavePrinter = () => {
    if (!printerName || !printerAddress || !printerRole) {
      toast({ variant: "destructive", title: "Campos Vacíos", description: "Por favor completa todos los campos de la impresora." });
      return;
    }
    if (editingPrinter) {
      setConfiguredPrinters(prev => prev.map(p => p.id === editingPrinter.id ? { ...editingPrinter, name: printerName, connectionType: printerConnectionType, address: printerAddress, role: printerRole } : p));
      toast({ title: "Impresora Actualizada" });
    } else {
      setConfiguredPrinters(prev => [...prev, { id: uuidv4(), name: printerName, connectionType: printerConnectionType, address: printerAddress, role: printerRole }]);
      toast({ title: "Impresora Añadida" });
    }
    setIsPrinterDialogOpen(false);
    setEditingPrinter(null);
  };

  const handleDeletePrinter = (printerId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta impresora?")) {
      setConfiguredPrinters(prev => prev.filter(p => p.id !== printerId));
      toast({ title: "Impresora Eliminada", variant: "destructive" });
    }
  };

  const handleTestPrinter = async () => {
    setIsTestingPrinter(true);
    toast({ title: "Probando Impresora...", description: "Enviando página de prueba..." });
    const testHtml = `
        <html><head><style>body{font-family:monospace; font-size:10pt; margin:5mm; width:${printFormat === '55mm' ? '55mm' : '76mm'};} .center{text-align:center;}</style></head><body>
        <div class="center">*** Página de Prueba siChef ***</div><br>
        <div>Formato: ${printFormat}</div>
        <div>Fecha: ${new Date().toLocaleString()}</div><br>
        <div>--------------------------------</div><br>
        <div class="center">¡Impresión Funcional!</div><br><br><br>
        </body></html>
    `;
    try {
      await printTicket(testHtml, "Prueba de Impresión siChef");
      toast({ title: "Diálogo de Impresión Iniciado", description: "Selecciona una impresora en el diálogo del sistema o navegador.", icon: <CheckCircle className="h-4 w-4 text-green-500"/> });
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

           <SettingsSection title="Configuración de la Tienda" description="Información básica y tipo de operación de tu negocio.">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <Label htmlFor="businessName">Nombre del Negocio</Label>
                 <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Tu Restaurante" />
               </div>
                <div className="space-y-2">
                 <Label htmlFor="currencySymbol">Símbolo de Moneda</Label>
                 <Input id="currencySymbol" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} placeholder="$" className="w-20"/>
               </div>
                <div className="space-y-2">
                  <Label>Tipo de Suscripción</Label>
                  <p className="text-sm text-muted-foreground border p-2 rounded-md bg-secondary">{subscriptionType}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">Giro del Negocio</Label>
                  <Select value={businessType} onValueChange={(value) => setBusinessType(value)}>
                    <SelectTrigger id="businessType"><SelectValue placeholder="Selecciona un giro" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurante">Restaurante</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="tienda">Tienda</SelectItem>
                      <SelectItem value="boutique">Boutique</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL del Logo</Label>
                  <Input id="logoUrl" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://ejemplo.com/logo.png" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deviceType">Tipo de Dispositivo Principal</Label>
                  <Select value={deviceType} onValueChange={(value) => setDeviceType(value)}>
                    <SelectTrigger id="deviceType"><SelectValue placeholder="Selecciona el rol" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matriz">Matriz (Servidor Central)</SelectItem>
                      <SelectItem value="sucursal">Sucursal (Servidor Local)</SelectItem>
                      <SelectItem value="movil_cajero">Móvil - Cajero</SelectItem>
                      <SelectItem value="movil_cocina">Móvil - Cocina</SelectItem>
                      <SelectItem value="movil_mesero">Móvil - Mesero</SelectItem>
                      <SelectItem value="movil_repartidor">Móvil - Repartidor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de Teléfono</Label>
                  <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Ej: 5512345678" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@negocio.com" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="founders">Fundador(es)</Label>
                  <Input id="founders" value={founders} onChange={(e) => setFounders(e.target.value)} placeholder="Nombres de los fundadores" />
                </div>
             </div>
          </SettingsSection>

          <SettingsSection
            title="Impresión y Recibos"
            description="Configuración de impresión de recibos y formatos."
           >
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
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="printFormat">Formato de Impresión (Papel)</Label>
              <Select value={printFormat} onValueChange={(value) => setPrintFormat(value)}>
                <SelectTrigger id="printFormat"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="55mm">55 mm</SelectItem>
                  <SelectItem value="80mm">80 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestPrinter}
              disabled={isTestingPrinter}
              className="mt-4"
            >
              {isTestingPrinter ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Probar Impresión (Abre Diálogo)
            </Button>
          </SettingsSection>

          <SettingsSection title="Configuración de Impresoras" description="Añade y gestiona las impresoras que usará el sistema.">
            <Dialog open={isPrinterDialogOpen} onOpenChange={setIsPrinterDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => handleOpenPrinterDialog()}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Impresora
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPrinter ? 'Editar Impresora' : 'Añadir Nueva Impresora'}</DialogTitle>
                  <DialogDescription>
                    Define los detalles de la impresora para diferentes roles (comandas, recibos, etc.).
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1">
                    <Label htmlFor="printerName">Nombre Descriptivo</Label>
                    <Input id="printerName" value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="Ej: Comandas Cocina" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="printerConnectionType">Tipo de Conexión</Label>
                    <Select value={printerConnectionType} onValueChange={(v) => setPrinterConnectionType(v as any)}>
                      <SelectTrigger id="printerConnectionType"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="network">Red (IP)</SelectItem>
                        <SelectItem value="bluetooth">Bluetooth (MAC)</SelectItem>
                        <SelectItem value="usb">USB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="printerAddress">Dirección (IP/MAC/ID)</Label>
                    <Input id="printerAddress" value={printerAddress} onChange={(e) => setPrinterAddress(e.target.value)} placeholder="Ej: 192.168.1.100 o AA:BB:CC:DD:EE:FF" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="printerRole">Rol de la Impresora</Label>
                    <Input id="printerRole" value={printerRole} onChange={(e) => setPrinterRole(e.target.value)} placeholder="Ej: Comandas, Recibos, Barra" />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={handleSavePrinter}>Guardar Impresora</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="mt-4">
              <h4 className="text-md font-medium mb-2">Impresoras Configurada:</h4>
              {configuredPrinters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay impresoras configuradas.</p>
              ) : (
                <Card>
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Dirección</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {configuredPrinters.map(printer => (
                          <TableRow key={printer.id}>
                            <TableCell>{printer.name}</TableCell>
                            <TableCell className="capitalize">{printer.connectionType}</TableCell>
                            <TableCell>{printer.address}</TableCell>
                            <TableCell>{printer.role}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenPrinterDialog(printer)} title="Editar">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeletePrinter(printer.id)} title="Eliminar">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              )}
            </div>
          </SettingsSection>

          <SettingsSection title="Gestión de Dispositivos" description="Configura y vincula otros dispositivos a tu espacio de trabajo.">
             <div className="p-4 border rounded-md bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">Próximamente: Aquí podrás generar un código QR para que otros dispositivos se unan a esta instancia de siChef POS y sincronicen datos.</p>
                <div className="mt-4 h-32 w-32 bg-gray-300 mx-auto flex items-center justify-center text-gray-500 rounded">
                    QR Placeholder
                </div>
             </div>
          </SettingsSection>

           <div className="mt-8 flex justify-end">
             <Button onClick={handleSaveChanges}>Guardar Cambios</Button>
           </div>

        </CardContent>
      </Card>
    </div>
  );
}
