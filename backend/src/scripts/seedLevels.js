import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/database.js';
import { Level } from '../models/Level.js';

// Obtener el directorio actual del módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde la raíz del proyecto backend
// Buscar .env en la raíz del backend (2 niveles arriba desde src/scripts/)
const backendRoot = join(__dirname, '../..');
const envPath = join(backendRoot, '.env');

// Cargar .env (dotenv.config() sin path busca en el directorio actual y padres)
dotenv.config({ path: envPath });

// Mostrar qué variables se cargaron (sin mostrar valores sensibles)
console.log('📄 Cargando variables de entorno...');
if (process.env.MONGODB_URI) {
  const masked = process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`   MONGODB_URI: ${masked}`);
} else if (process.env.DATABASE_URL) {
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log(`   DATABASE_NAME: ${process.env.DATABASE_NAME || 'multimedia_db'}`);
  console.log(`   DATABASE_USERNAME: ${process.env.DATABASE_USERNAME ? '***' : 'No definido'}`);
} else {
  console.warn('⚠️ No se encontraron variables de MongoDB. Verifica tu archivo .env');
}

const seedLevels = async () => {
  try {
    // Conectar a la base de datos
    await connectDB();
    console.log('✅ Conectado a MongoDB');

    // Datos iniciales de los niveles
    const levelsData = [
    {
      levelNumber: 1,
      coinsCount: 10,
      enemiesCount: 1,
      description: 'Nivel 1: Campamento - Tiendas de campaña',
      isActive: true,
    },
    {
      levelNumber: 2,
      coinsCount: 10,
      enemiesCount: 3,
      description: 'Nivel 2: Medieval - Castillos y casas antiguas',
      isActive: true,
    },
    {
      levelNumber: 3,
      coinsCount: 10,
      enemiesCount: 5,
      description: 'Nivel 3: Nocturno / Fantasía - Molinos, torres y cuarteles',
      isActive: true,
    },
    {
      levelNumber: 4,
      coinsCount: 10,
      enemiesCount: 7,
      description: 'Nivel 4: Bosque / Campo - Árboles y piezas de ajedrez',
      isActive: true,
    },
    {
      levelNumber: 5,
      coinsCount: 10,
      enemiesCount: 10,
      description: 'Nivel 5: Nieve - Casas nevadas, iglesia y montañas',
      isActive: true,
    },
  ];

    // Limpiar niveles existentes (opcional - comentar si quieres mantener datos existentes)
    // await Level.deleteMany({});
    // console.log('🗑️ Niveles existentes eliminados');

    // Insertar o actualizar niveles
    for (const levelData of levelsData) {
      const existingLevel = await Level.findOne({ levelNumber: levelData.levelNumber });
      
      if (existingLevel) {
        // Actualizar nivel existente
        await Level.updateOne(
          { levelNumber: levelData.levelNumber },
          { $set: levelData }
        );
        console.log(`🔄 Nivel ${levelData.levelNumber} actualizado`);
      } else {
        // Crear nuevo nivel
        await Level.create(levelData);
        console.log(`✅ Nivel ${levelData.levelNumber} creado`);
      }
    }

    // Mostrar resumen
    const allLevels = await Level.find({ isActive: true }).sort({ levelNumber: 1 });
    console.log('\n📊 Resumen de niveles en la base de datos:');
    allLevels.forEach(level => {
      console.log(`   Nivel ${level.levelNumber}: ${level.coinsCount} coins, ${level.enemiesCount} enemigos`);
    });

    console.log('\n✅ Seed completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar seed:', error);
    process.exit(1);
  }
};

// Ejecutar seed
seedLevels();

