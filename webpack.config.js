const path = require('path');
    const HtmlWebpackPlugin = require('html-webpack-plugin');

    const appDirectory = path.resolve(__dirname, './'); // Ajusta si la raíz de tu proyecto no es la misma que el webpack.config.js

    const { env } = process;

    const babelLoaderConfiguration = {
      test: /\.(js|jsx|ts|tsx)$/,
      // Reemplazamos 'include' con 'exclude' para mayor control
      exclude: [
        // Excluir la mayoría de node_modules, excepto las dependencias que necesitan transpilación
        /node_modules\/(?!(@react-native-async-storage\/async-storage|react-native-web|uncompiled-react-native-library)).*/,
      ],
      use: {
        loader: 'babel-loader',
        options: {
          cacheDirectory: true,
          // Asegúrate de que tu babel.config.js o .babelrc esté configurado correctamente
        },
      },
    };
    
    
    

    module.exports = {
      entry: path.resolve(appDirectory, 'index.web.js'), // Archivo de entrada web
      output: {
        filename: 'bundle.web.js',
        path: path.resolve(appDirectory, 'dist'), // Directorio de salida
      },
      module: {
        rules: [
          babelLoaderConfiguration,
          {
            test: /\.(gif|jpe?g|png|svg|webp)$/,
            use: {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]',
              },
            },
          },
          // Añade reglas para CSS si usas hojas de estilo web
          // {
          //   test: /\.css$/,
          //   use: ['style-loader', 'css-loader'],
          // },
        ],
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.resolve(appDirectory, 'public/index.html'), // Plantilla HTML (necesitas crear una)
          filename: './index.html',
        }),
      ],
      resolve: {
        // Esto es crucial para que React Native for Web resuelva los módulos correctamente
        alias: {
          'react-native$': 'react-native-web',
        },
        extensions: [
          '.web.js',
          '.web.jsx',
          '.web.ts',
          '.web.tsx',
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
        ],
        // Esto ayuda a Webpack a encontrar archivos con extensiones .web.js, etc.
      },
      devServer: {
        static: { // Usamos la nueva propiedad 'static'
          directory: path.join(appDirectory, 'dist'), // Y especificamos el directorio en 'directory'
        },
        compress: true,
        port: 9095,
        historyApiFallback: true,
      },
    };
