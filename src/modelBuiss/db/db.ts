import SQlite from 'react-native-sqlite-storage';

SQlite.enablePromise(true);

const database_name = 'siChefPOS.db';
const database_version = '1.0';
const database_displayname = 'SQLite siChefPOS Database';

export const openDB = async (): Promise<SQlite.SQLiteDatabase> => {
  try {
    const db = await SQlite.openDatabase({
      name: database_name,
      location: 'default',
    });
    console.log("Base de datos abierta correctamente");
    return db;
  } catch (error) {
    console.error("Error al abrir la base de datos:", error);
    throw error; // Re-lanza el error para que se maneje en initDB
  }
};