import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/database.js';
import { Block } from '../models/Block.js';

// Obtener el directorio actual del módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde la raíz del proyecto backend
const backendRoot = path.join(__dirname, '../..');
const envPath = path.join(backendRoot, '.env');
dotenv.config({ path: envPath });

// Mostrar qué variables se cargaron
console.log('📄 Cargando variables de entorno...');
if (process.env.MONGODB_URI) {
  const masked = process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`   MONGODB_URI: ${masked}`);
}

const seedBlocks = async () => {
  try {
    // Conectar a la base de datos
    await connectDB();
    console.log('✅ Conectado a MongoDB');

    // Archivos de bloques: el base (niveles 1-3) y un archivo por nivel para los niveles 4 y 5
    const dataDir = path.join(__dirname, '../../data');
    const blockFiles = ['toy_car_blocks.json', 'toy_car_blocks_nivel4.json', 'toy_car_blocks_nivel5.json'];
    const blocksData = [];

    for (const fileName of blockFiles) {
      const blocksPath = path.join(dataDir, fileName);

      if (!fs.existsSync(blocksPath)) {
        console.error(`❌ Archivo no encontrado: ${blocksPath}`);
        console.error(`💡 Asegúrate de que ${fileName} esté en backend/data/`);
        process.exit(1);
      }

      console.log(`📖 Leyendo archivo: ${blocksPath}`);
      const fileBlocks = JSON.parse(fs.readFileSync(blocksPath, 'utf8'));

      if (!Array.isArray(fileBlocks)) {
        console.error(`❌ ${fileName} no contiene un array válido`);
        process.exit(1);
      }

      console.log(`📦 Encontrados ${fileBlocks.length} bloques en ${fileName}`);
      blocksData.push(...fileBlocks);
    }

    console.log(`📦 Total a procesar: ${blocksData.length} bloques`);

    // Limpiar bloques existentes (opcional - descomentar si quieres limpiar)
    // await Block.deleteMany({});
    // console.log('🗑️ Bloques existentes eliminados');

    // Insertar o actualizar bloques
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const blockData of blocksData) {
      try {
        // Validar que tenga los campos requeridos
        if (!blockData.name || typeof blockData.x !== 'number' || 
            typeof blockData.y !== 'number' || typeof blockData.z !== 'number' ||
            !blockData.Role || typeof blockData.level !== 'number') {
          console.warn(`⚠️ Bloque inválido omitido:`, blockData);
          errors++;
          continue;
        }

        const existingBlock = await Block.findOne({ name: blockData.name, level: blockData.level });
        
        if (existingBlock) {
          // Actualizar bloque existente
          await Block.updateOne(
            { name: blockData.name, level: blockData.level },
            { $set: blockData }
          );
          updated++;
        } else {
          // Crear nuevo bloque
          await Block.create(blockData);
          created++;
        }
      } catch (blockError) {
        console.error(`❌ Error procesando bloque ${blockData.name}:`, blockError.message);
        errors++;
      }
    }

    // Mostrar resumen
    const totalBlocks = await Block.countDocuments();
    const blocksByLevel = await Block.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const blocksByRole = await Block.aggregate([
      { $group: { _id: '$Role', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Resumen de bloques en la base de datos:');
    console.log(`   Total: ${totalBlocks} bloques`);
    console.log(`   Creados: ${created}`);
    console.log(`   Actualizados: ${updated}`);
    if (errors > 0) {
      console.log(`   Errores: ${errors}`);
    }
    
    console.log('\n📊 Bloques por nivel:');
    blocksByLevel.forEach(item => {
      console.log(`   Nivel ${item._id}: ${item.count} bloques`);
    });

    console.log('\n📊 Bloques por rol:');
    blocksByRole.forEach(item => {
      console.log(`   ${item._id}: ${item.count} bloques`);
    });

    console.log('\n✅ Seed de bloques completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar seed de bloques:', error);
    process.exit(1);
  }
};

// Ejecutar seed
seedBlocks();

