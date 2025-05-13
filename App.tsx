// App.tsx

import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeApplication } from './src/modelBuiss/initConfig'; // Importa la función de inicialización

import AppLayout from './src/index'; // Tu componente de navegación/layout
import LoadingScreen from './src/pantallas/LoadingScreen/LoadingScreen.main'; // Importa la pantalla de carga (ruta corregida)
import { RootStackParamList } from './src/router/dynamicRouter'; // Importa RootStackParamList para tipado

function App(): React.JSX.Element {
  const [isAppReady, setIsAppReady] = useState(false);
  // Usamos undefined como estado inicial para indicar que aún no se ha determinado la ruta
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList | undefined>(undefined);

  useEffect(() => {
    const initApp = async () => {
      const route = await initializeApplication();
      // Asegúrate de que la ruta retornada por initializeApplication sea un nombre válido en RootStackParamList
      // Usamos un casteo seguro o validación si es necesario.
      setInitialRouteName(route as keyof RootStackParamList);
      setIsAppReady(true);
    };

    initApp();
  }, []); // Ejecutar solo una vez al montar

  if (!isAppReady || initialRouteName === undefined) {
    // Muestra la pantalla de carga
    return <LoadingScreen />;
  }

  // Pasa la ruta inicial determinada a tu componente de navegación/layout
  return (
    <SafeAreaProvider>
      {/* Pasamos la ruta inicial como prop a AppLayout */}
      <AppLayout initialRouteName={initialRouteName} />
    </SafeAreaProvider>
  );
}

export default App;
