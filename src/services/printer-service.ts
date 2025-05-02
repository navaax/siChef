'use client';

import { Capacitor } from '@capacitor/core';

// Basic Error class for Printer specific issues
export class PrinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrinterError';
  }
}

// Interface for cordova-plugin-printer (simplified)
declare global {
  interface CordovaPlugins {
    printer: {
      print: (content: string | HTMLElement, options?: PrinterOptions) => void;
      // Add other methods if needed (like isAvailable)
    };
  }
  interface Cordova {
    plugins: CordovaPlugins;
  }
  var cordova: Cordova; // Make cordova globally available
}

interface PrinterOptions {
  /** The name of the print job */
  name?: string;
  /** The number of copies to print */
  copies?: number;
  /** The orientation of the printed content, `portrait` or `landscape` */
  orientation?: 'portrait' | 'landscape';
  /** If the content should be rendered in monochrome */
  monochrome?: boolean;
  /** The printer's URL or ID */
  printer?: string;
  /** Additional platform-specific options */
  [key: string]: any;
}

/**
 * Check if the app is running on a native platform (iOS/Android).
 */
function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Prints HTML content using cordova-plugin-printer.
 * Assumes the plugin is available and initialized.
 *
 * @param htmlContent The HTML string to print.
 * @param jobName Optional name for the print job.
 */
export async function printHtmlTicket(htmlContent: string, jobName: string = 'siChef Receipt'): Promise<void> {
  if (!isNativePlatform()) {
    throw new PrinterError("La impresión directa solo está disponible en plataformas nativas (iOS/Android).");
  }

  // Check if the plugin exists
  if (typeof cordova === 'undefined' || !cordova.plugins || !cordova.plugins.printer) {
     console.error("Cordova printer plugin not found. Ensure it's installed and initialized.");
     throw new PrinterError("Plugin de impresora no encontrado. Asegúrate de que esté instalado.");
  }

  console.log(`Iniciando impresión HTML para: ${jobName}`);

  try {
    // Options for the print job (customize as needed)
    const options: PrinterOptions = {
      name: jobName,
      orientation: 'portrait',
      // printer: 'OptionalPrinterID' // Let the OS handle printer selection usually
    };

    // Call the plugin's print method
    // The plugin usually opens the standard OS print dialog
    await new Promise<void>((resolve, reject) => {
        cordova.plugins.printer.print(htmlContent, options);
        // The plugin itself doesn't have a standard callback for success/failure.
        // We resolve immediately assuming the print dialog was shown.
        // Error handling within the plugin might need platform-specific checks.
        console.log("Se llamó al diálogo de impresión del sistema operativo.");
        // Simulating success as the plugin doesn't provide a direct callback
        // In a real scenario, you might rely on device logs or lack of errors.
        setTimeout(resolve, 100); // Resolve after a short delay
    });

    console.log(`Diálogo de impresión mostrado para ${jobName}.`);

  } catch (error) {
    console.error(`Error imprimiendo HTML:`, error);
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    // Add more specific error checks if the plugin provides them
    throw new PrinterError(`Error al imprimir: ${errorMessage}`);
  }
}

// Removed search functions as cordova-plugin-printer relies on the OS print dialog
// export type DiscoveredPrinter = { ... }
// export async function searchPrinters(...) { ... }
// export async function searchBluetoothPrinters(...) { ... }
// export async function searchWifiPrinters(...) { ... }
// export async function searchUsbPrinters(...) { ... }
// export async function initializeBluetoothForScan(...) { ... }

// Renamed the main print function to reflect HTML printing
export { printHtmlTicket as printTicket };
