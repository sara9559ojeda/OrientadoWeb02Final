# 🗄️ Guía de Inicialización de la Base de Datos

Esta guía explica cómo inicializar la base de datos MongoDB con las colecciones y datos necesarios para el juego.

## 📋 Requisitos Previos

- Docker y Docker Compose instalados
- Contenedores corriendo (`docker compose up -d`)

## 🚀 Inicialización Rápida

### Método 1: Script Automático (Recomendado)

```bash
cd backend
./scripts/init-database.sh
```

### Método 2: Comando Manual

```bash
docker exec backend-express npm run seed:levels
```

## 📊 ¿Qué hace el script de seed?

El script `seedLevels.js` crea:

1. **Colección `levels`**: Con 3 niveles iniciales del juego
   - Nivel 1: Ciudad Toy Car (10 coins, 1 enemigo)
   - Nivel 2: Mundo Antiguo (10 coins, 3 enemigos)
   - Nivel 3: Casas Pokémon (10 coins, 5 enemigos)

2. **Colecciones automáticas**: Cuando se crean usuarios o puntuaciones, MongoDB crea automáticamente:
   - `users`: Para almacenar usuarios registrados
   - `gamescores`: Para almacenar puntuaciones del juego

3. **Colección `blocks`**: Los bloques del juego (edificios, vehículos, monedas, etc.) se cargan desde el archivo `data/toy_car_blocks.json` a MongoDB mediante el script `seedBlocks.js`. Una vez cargados, están disponibles a través del endpoint `/api/blocks` desde la base de datos.

## ✅ Verificar que la Base de Datos Está Inicializada

### Opción 1: Desde el contenedor de MongoDB

```bash
docker exec -it backend-mongodb mongosh -u admin -p admin123 --authenticationDatabase=admin
```

Luego ejecuta:
```javascript
use multimedia_db
show collections
db.levels.find()
```

### Opción 2: Verificar desde el backend

```bash
# Verificar que el servidor puede conectarse
curl http://localhost:3000/api/health

# Verificar que los niveles están disponibles
curl http://localhost:3000/api/levels

# Verificar que los bloques están disponibles
curl http://localhost:3000/api/blocks | head -20
```

Deberías ver un array JSON con los bloques del juego (edificios, vehículos, monedas, etc.).

## 🔄 Re-inicializar la Base de Datos

Si necesitas limpiar y volver a inicializar:

```bash
# 1. Detener los contenedores
docker compose down

# 2. Eliminar el volumen de datos (¡CUIDADO! Esto borra todos los datos)
docker volume rm backend_mongodb_data

# 3. Iniciar de nuevo
docker compose up -d

# 4. Ejecutar el seed
docker exec backend-express npm run seed:levels
```

## 🐛 Solución de Problemas

### Error: "Authentication failed"

**Problema**: Las credenciales no coinciden.

**Solución**: Verifica que el archivo `.env` tenga:
```env
MONGODB_URI=mongodb://admin:admin123@mongodb:27017/multimedia_db?authSource=admin
```

### Error: "Cannot connect to MongoDB"

**Problema**: El contenedor de MongoDB no está corriendo.

**Solución**: 
```bash
docker ps  # Verificar que backend-mongodb esté corriendo
docker compose up -d  # Iniciar si no está corriendo
```

### Error: "Collection not found"

**Problema**: El seed no se ejecutó correctamente.

**Solución**: Ejecuta el seed manualmente:
```bash
docker exec backend-express npm run seed:levels
```

### Las colecciones no aparecen

**Problema**: Puede que estés conectado a la base de datos incorrecta.

**Solución**: Asegúrate de usar la base de datos correcta:
```javascript
use multimedia_db  // No 'test' ni 'admin'
show collections
```

### Error: "Bloques no encontrados" o endpoint `/api/blocks` devuelve array vacío

**Problema**: El archivo `toy_car_blocks.json` no está en el lugar correcto.

**Solución**: 
1. Verifica que el archivo existe:
   ```bash
   ls -la backend/data/toy_car_blocks.json
   ```

2. Si no existe, cópialo desde el frontend:
   ```bash
   cp game-project/public/data/toy_car_blocks.json backend/data/
   ```

3. Reinicia el contenedor para que copie el archivo:
   ```bash
   docker compose restart backend
   ```

4. Verifica que el endpoint funciona:
   ```bash
   curl http://localhost:3000/api/blocks | jq 'length'
   ```
   Debería mostrar el número de bloques (alrededor de 100+).

## 📝 Estructura de las Colecciones

### `levels`
```javascript
{
  _id: ObjectId,
  levelNumber: Number,      // 1, 2, 3
  coinsCount: Number,       // Cantidad de monedas
  enemiesCount: Number,     // Cantidad de enemigos
  description: String,      // Descripción del nivel
  isActive: Boolean,         // Si el nivel está activo
  createdAt: Date,
  updatedAt: Date
}
```

### `users` (se crea automáticamente al registrar usuarios)
```javascript
{
  _id: ObjectId,
  email: String,
  password: String,          // Hasheado con bcrypt
  name: String,
  createdAt: Date,
  updatedAt: Date
}
```

### `blocks` (se crea al ejecutar seed:blocks)
```javascript
{
  _id: ObjectId,
  name: String,              // Nombre del bloque
  x: Number,                 // Posición X
  y: Number,                 // Posición Y
  z: Number,                 // Posición Z
  Role: String,              // 'vehicle', 'building', 'default', 'finalPrize'
  level: Number,             // Nivel al que pertenece (1, 2, 3)
  createdAt: Date,
  updatedAt: Date
}
```

### `gamescores` (se crea automáticamente al guardar puntuaciones)
```javascript
{
  _id: ObjectId,
  user: ObjectId,            // Referencia a users
  totalPoints: Number,
  pointsByLevel: {
    level1: Number,
    level2: Number,
    level3: Number
  },
  gameTime: Number,          // En segundos (opcional)
  createdAt: Date,
  updatedAt: Date
}
```

## 💡 Notas Importantes

- El script de seed es **idempotente**: puedes ejecutarlo múltiples veces sin problemas
- Si un nivel ya existe, se actualiza en lugar de crear un duplicado
- Los usuarios y puntuaciones se crean automáticamente cuando se usan los endpoints correspondientes
- La base de datos se llama `multimedia_db` (configurada en `docker-compose.yml`)

## 🔗 Comandos Útiles

```bash
# Ver logs del backend
docker compose logs -f backend

# Ver logs de MongoDB
docker compose logs -f mongodb

# Conectar a MongoDB interactivamente
docker exec -it backend-mongodb mongosh -u admin -p admin123 --authenticationDatabase=admin

# Ver estado de los contenedores
docker ps

# Reiniciar un contenedor
docker restart backend-express
docker restart backend-mongodb
```

