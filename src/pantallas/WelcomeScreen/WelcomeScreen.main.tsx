// Inicio de importaciones 
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'; // Importaciones de react-native
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/native-stack'; // Para tipado de navegación
import { RootStackParamList } from '../../router/dynamicRouter'; // Importa el tipo de navegación
import { handleCreateBusiness, handleJoinTeam } from './WelcomeScreen.functions'; // Importa las funciones
import { styles } from './WelcomeScreen.styles'; // Importa los estilos
// Fin de importaciones

type WelcomeScreenNavigationProp =  StackNavigationProp<RootStackParamList, 'WelcomeScreen'>;

function WelcomeScreen (){
    const navigation = useNavigation <WelcomeScreenNavigationProp>();

    return(
        <View style={styles.container}>
            <Text style={styles.welcomeText}>
                Bienvenido al equipo de siChefPOS
            </Text>
            <Text style={styles.copyrightText}>
            © [Año Actual] siChefPOS
             </Text>
            <Text style={styles.questionText}>
                ¿Qué acción quieres realizar?
            </Text>
            <TouchableOpacity
                style={styles.button}
                onPress={() => handleCreateBusiness(navigation)} // Llama a la función de manejo
                >
                <Text style={styles.buttonText}>Crear Negocio</Text>
             </TouchableOpacity>
             <TouchableOpacity
                style={[styles.button, styles.secondaryButton]} // Estilo secundario si es necesario
                onPress={() => handleJoinTeam(navigation)} // Llama a la función de manejo
            >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Integrarte a un Equipo de trabajo
                </Text>
             </TouchableOpacity>
        </View>
        
    );
} 

export default WelcomeScreen;