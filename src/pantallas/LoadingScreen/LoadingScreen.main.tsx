// src/screens/LoadingScreen/LoadingScreen.main.tsx

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { styles } from './LoadingScreen.styles'; // Importa los estilos

function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0000ff" /> {/* Indicador de carga */}
      <Text style={styles.text}>Cargando...</Text> {/* Texto de carga */}
    </View>
  );
}

export default LoadingScreen;