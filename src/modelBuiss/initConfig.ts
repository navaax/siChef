// src/modelBuiss/initConfig.ts

import { initDB } from './db/initDB'; // Importa la función initDB
import AsyncStorage from '@react-native-async-storage/async-storage'; // Importa AsyncStorage

const HAS_LAUNCHED_KEY = 'hasLaunched';

/**
 * Realiza las verificaciones de inicialización de la aplicación.
 * Por ahora, solo verifica si es el primer lanzamiento.
 * @returns El nombre de la ruta inicial a la que debe navegar el navegador.
 */
export const initializeApplication = async (): Promise<string> => {
  try {
    const hasLaunched = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);

    if (hasLaunched === null) {
      // Primera vez que se abre la aplicación
      console.log('Primer lanzamiento: Inicializando base de datos...');
      const dbInitResult = await initDB(); // Llama a la función initDB
      if (!dbInitResult.success) {
        console.error('Error en la inicialización de la BD:', dbInitResult.message);
        // Dependiendo de tu lógica, podrías lanzar un error o redirigir a una pantalla de error
      }
      await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true'); // Marca como lanzado
      console.log('Primer lanzamiento: Navegando a WelcomeScreen');
      return 'WelcomeScreen'; // Ruta a la pantalla de bienvenida
    } else {
      // La aplicación ya ha sido lanzada antes
      // Aquí podrías agregar lógica para verificar autenticación, etc.
      console.log('Lanzamiento recurrente: Navegando a SplashScreen (o pantalla principal)');
      return 'SplashScreen'; // Reemplaza con el nombre real de tu pantalla principal (ej: 'DashboardScreen')
    }
  } catch (error) {
    console.error('Error durante la inicialización de la aplicación:', error);
    // En caso de error, podrías redirigir a una pantalla de error o a WelcomeScreen
    return 'SplashScreen'; // Valor por defecto en caso de error
  }
};
