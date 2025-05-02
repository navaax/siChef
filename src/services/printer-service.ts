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
 * Prints HTML content using either cordova-plugin-printer (on native) or window.print() (on web).
 *
 * @param htmlContent The HTML string to print.
 * @param jobName Optional name for the print job (used by cordova plugin).
 */
export async function printTicket(htmlContent: string, jobName: string = 'siChef Receipt'): Promise<void> {
  console.log(`Iniciando impresión para: ${jobName}`);

  if (isNativePlatform()) {
    // --- Native Platform Printing (using Cordova Plugin) ---
    if (typeof cordova === 'undefined' || !cordova.plugins || !cordova.plugins.printer) {
      console.error("Cordova printer plugin not found. Ensure it's installed and initialized.");
      throw new PrinterError("Plugin de impresora no encontrado. Asegúrate de que esté instalado.");
    }

    try {
      const options: PrinterOptions = {
        name: jobName,
        orientation: 'portrait',
        // Let the OS handle printer selection
      };

      // Call the plugin's print method
      await new Promise<void>((resolve, reject) => {
        try {
            cordova.plugins.printer.print(htmlContent, options);
            // The plugin usually opens the standard OS print dialog
            console.log("Se llamó al diálogo de impresión del sistema operativo.");
            // Resolve after a short delay as the plugin lacks a standard callback
            setTimeout(resolve, 100);
        } catch (pluginError) {
             console.error("Error directo al llamar a cordova.plugins.printer.print:", pluginError);
            reject(new PrinterError(`Error al llamar al plugin de impresora: ${pluginError instanceof Error ? pluginError.message : pluginError}`));
        }
      });

      console.log(`Diálogo de impresión del OS mostrado para ${jobName}.`);

    } catch (error) {
      console.error(`Error imprimiendo en nativo:`, error);
      const errorMessage = error instanceof PrinterError ? error.message : (error instanceof Error ? error.message : JSON.stringify(error));
      throw new PrinterError(`Error al imprimir en nativo: ${errorMessage}`);
    }
  } else {
    // --- Web Browser Printing (using window.print()) ---
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new PrinterError("No se pudo abrir la ventana de impresión. Revisa la configuración de bloqueo de pop-ups.");
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close(); // Necessary for some browsers
      // Delay print command slightly to ensure content is loaded
      setTimeout(() => {
        printWindow.print();
        // Optionally close the window after printing (can be unreliable)
        // setTimeout(() => printWindow.close(), 500);
      }, 250); // Adjust delay if needed
      console.log("Diálogo de impresión del navegador abierto.");
    } catch (error) {
      console.error(`Error imprimiendo en navegador:`, error);
       const errorMessage = error instanceof PrinterError ? error.message : (error instanceof Error ? error.message : JSON.stringify(error));
      throw new PrinterError(`Error al imprimir en navegador: ${errorMessage}`);
    }
  }
}

// Removed functions related to specific printer types/discovery as cordova-plugin-printer uses the OS dialog
// export type DiscoveredPrinter = { ... }
// export async function searchPrinters(...) { ... }
// export async function initializeBluetoothForScan(...) { ... }
