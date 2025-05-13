// src/index.ts (Fragmento relevante)

// ... otras importaciones ...
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './router/dynamicRouter'; // Importa RootStackParamList
import componentesMap from './router/dynamicRouter'; // Asegúrate de importar componentesMap correctamente

const Stack = createNativeStackNavigator<RootStackParamList>();

// Define las props que acepta AppLayout
interface AppLayoutProps {
  initialRouteName: keyof RootStackParamList; // Esperamos que sea un nombre de ruta válido
}

// Modificamos AppLayout para aceptar la prop initialRouteName
const AppLayout: React.FC<AppLayoutProps> = ({ initialRouteName }) => {
  return (
    <NavigationContainer> {/* Asegúrate de que NavigationContainer esté aquí o en App.tsx, no en ambos */}
      <Stack.Navigator
        initialRouteName={initialRouteName} // Usamos la prop recibida
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
      {/* ... mapeo de pantallas usando componentesMap ... */}
       {Object.keys(componentesMap).map((pantallaNombre) => {
          const Componente = componentesMap[pantallaNombre as keyof typeof componentesMap];
          return (
            <Stack.Screen
              key={pantallaNombre}
              name={pantallaNombre as keyof RootStackParamList}
              component={Componente}
              options={{
                headerShown: false,
              }}
            />
          );
        })}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppLayout;
