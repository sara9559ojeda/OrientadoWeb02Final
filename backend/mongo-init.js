// Inicialización de MongoDB — se ejecuta UNA sola vez, al crear el volumen de datos.
//
// El usuario root (admin / admin123) lo crea automáticamente la imagen oficial de
// Mongo a partir de MONGO_INITDB_ROOT_USERNAME / MONGO_INITDB_ROOT_PASSWORD del
// docker-compose.yml. Aquí solo dejamos creada la base de datos del juego y sus
// colecciones para que existan desde el arranque.

const gameDb = db.getSiblingDB('multimedia_db');

['levels', 'blocks', 'users', 'gamescores'].forEach((name) => {
  if (!gameDb.getCollectionNames().includes(name)) {
    gameDb.createCollection(name);
  }
});

print('✅ Base de datos multimedia_db inicializada');
