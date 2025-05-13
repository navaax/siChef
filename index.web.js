import { AppRegistry } from 'react-native';
    import App from './App'; // Importa tu componente App principal
    import { name as appName } from './app.json'; // O el nombre de tu app

    AppRegistry.registerComponent(appName, () => App);

    AppRegistry.runApplication(appName, {
      rootTag: document.getElementById('root'), // El ID del elemento en tu index.html donde montar la app
    });
