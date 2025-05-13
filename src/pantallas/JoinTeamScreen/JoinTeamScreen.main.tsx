// src/pantallas/JoinTeamScreen/JoinTeamScreen.main.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { styles } from './JoinTeamScreen.styles'; // Importa los estilos (ruta relativa)

function JoinTeamScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Pantalla: Integrarse a un Equipo de trabajo</Text>
      {/* Aquí irá el formulario o la UI para unirse a un equipo */}
    </View>
  );
}

export default JoinTeamScreen;