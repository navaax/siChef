
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.sichefpos', // Replace with your App ID
  appName: 'siChef POS',
  webDir: 'out', // Use 'out' for Next.js static export
  bundledWebRuntime: false,
  server: {
    // For local development with live reload, point to your Next.js dev server
    // url: 'http://192.168.1.YOUR_IP:9002', // Replace with your machine's IP
    // cleartext: true
    // For production, comment out the server block or point to your deployed PWA URL
  },
   plugins: {
     // Removed BluetoothLe plugin configuration
     // EscPosPrinter config removed as it's not being used
     Printer: { // Configuration for cordova-plugin-printer (usually empty)
        // No specific config typically needed here unless plugin docs state otherwise
     }
     // Potentially add other plugins and configurations here
   },
   // Android specific permissions might be needed
   // Add necessary permissions for Bluetooth scanning and connection (Classic & LE) if using a BT specific printer plugin later
   // Add permissions for Network and USB if those printer types are used by the selected cordova plugin
   // This might require modifications in android/app/src/main/AndroidManifest.xml
   /*
    Example permissions often needed (check plugin docs and Android requirements):
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false"/>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    // For USB: Add <uses-feature android:name="android.hardware.usb.host" /> and potentially specific intent filters
    // For cordova-plugin-printer, INTERNET might be needed for network printers accessed via OS dialog.
   */
  "cordova": {} // Add empty cordova object if not present
};

export default config;
