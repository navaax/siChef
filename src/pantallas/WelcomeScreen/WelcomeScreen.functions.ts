// Inicio de importaciones 
import { StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../router/dynamicRouter'; // Importa el tipo de navegación
// Fin de importaciones

export const handleCreateBuissnes = (navigation: WelcomeScreenNavigationProp) => {
    console.log('Iniciando Creacion conn de tu negocio');
    // navigation.navigate('CreateBusinessScreen'); // Ejemplo
}

export const handleJoinTeam = (navigation: WelcomeScreenNavigationProp) =>{
    console.log('Iniciando Scan de QR');
}