// src/screens/WelcomeScreen/WelcomeScreen.styles.ts

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff', // Color de fondo
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  copyrightText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 40,
  },
  questionText: {
    fontSize: 18,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007bff', // Color primario del botón
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15,
    width: '80%', // Ancho del botón
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff', // Color del texto del botón
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#f8f9fa', // Color secundario del botón
    borderColor: '#007bff',
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: '#007bff', // Color del texto secundario
  },
});
