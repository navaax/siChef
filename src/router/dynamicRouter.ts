// src/componentesMap.ts
import SplashScreen from '../pantallas/SplashScreen/SplashScreen.main'; // Importacion SplashScreen
import LoginScreen from '../pantallas/LoginScreen/LoginScreen.main'; // Importacion LoginScreen
import RegisterScreen from '../pantallas/RegisterScreen/RegisterScreen.main'; // Importacion RegisterScreen
import WelcomeScreen from '../pantallas/WelcomeScreen/WelcomeScreen.main'; // Ruta corregida
import LoadingScreen from '../pantallas/LoadingScreen/LoadingScreen.main'; // Ruta corregida
import CreateBusinessScreen from '../pantallas/CreateBusinessScreen/CreateBusinessScreen.main'; // Ruta corregida
import JoinTeamScreen from '../pantallas/JoinTeamScreen/JoinTeamScreen.main'; // Ruta corregida

const componentesMap = {
  // Splash: Splash,
  // Login: Login,
  // Registro: Registro,
  WelcomeScreen: WelcomeScreen,
  LoadingScreen: LoadingScreen,
  SplashScreen: SplashScreen, // Añadido SplashScreen
  LoginScreen: LoginScreen, // Añadido LoginScreen
  RegisterScreen: RegisterScreen, // Añadido RegisterScreen
  CreateBusinessScreen: CreateBusinessScreen,
  JoinTeamScreen: JoinTeamScreen,
  // Agrega más pantallas aquí si es necesario
};

// Define el tipo RootStackParamList basado en las claves de componentesMap
export type RootStackParamList = {
  [K in keyof typeof componentesMap]: any; // O un tipo más específico si conoces los parámetros
  // Puedes ir actualizando esto con 'undefined' o tipos de parámetros específicos:
  // Splash: undefined;
  // Login: { someParam: string }; // Ejemplo con parámetro
  // Registro: undefined;
  // WelcomeScreen: undefined;
  // LoadingScreen: undefined;
  // CreateBusinessScreen: undefined;
  // JoinTeamScreen: undefined;
};

export default componentesMap;
