// src/pantallas/CreateBusinessScreen/CreateBusinessScreen.main.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { styles } from './CreateBusinessScreen.styles'; // Importa los estilos (ruta relativa)

function CreateBusinessScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Pantalla: Crear Negocio</Text>
      {/* Aquí irá el formulario o la UI para crear un negocio */}
    </View>
  );
}

export default CreateBusinessScreen;
