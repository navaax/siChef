module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    '@babel/preset-typescript', // <--- Asegúrate de que esta línea esté aquí
    '@babel/preset-react', // Puede ser necesario si no está incluido en los anteriores
    '@babel/preset-env', // Generalmente incluido para transpilación de JavaScript
  ],
  plugins: [
    // Puedes necesitar el plugin react-native-web babel resolver
    ['react-native-web', { commonjs: true }],
    // Asegurar loose: true para estos plugins para consistencia y silenciar advertencias
    ["@babel/plugin-transform-class-properties", { "loose": true }],
    ["@babel/plugin-transform-private-methods", { "loose": true }],
    ["@babel/plugin-transform-private-property-in-object", { "loose": true }],
    // ... otros plugins si tienes ...
  ],
};
