import { Router } from 'express';
import { Block } from '../models/Block.js';

const router = Router();

// GET /api/blocks - Obtener todos los bloques desde MongoDB
router.get('/', async (req, res) => {
  try {
    // Obtener parámetros de consulta opcionales
    const { level, role } = req.query;
    
    // Construir filtro
    const filter = {};
    if (level) {
      filter.level = parseInt(level);
    }
    if (role) {
      filter.Role = role;
    }

    // Obtener bloques desde MongoDB
    const blocks = await Block.find(filter).sort({ level: 1, name: 1 }).lean();
    
    console.log(`✅ Bloques cargados desde MongoDB: ${blocks.length} bloques${level ? ` (nivel ${level})` : ''}${role ? ` (rol ${role})` : ''}`);

    res.json(blocks);
  } catch (error) {
    console.error('Error al obtener bloques:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener bloques',
      error: error.message,
      blocks: [], // Devolver array vacío en caso de error
    });
  }
});

// GET /api/blocks/:levelId - Obtener bloques de un nivel específico
router.get('/:levelId', async (req, res) => {
  try {
    const levelId = parseInt(req.params.levelId);
    
    if (isNaN(levelId)) {
      res.status(400).json({
        success: false,
        message: 'El ID del nivel debe ser un número',
      });
      return;
    }

    const blocks = await Block.find({ level: levelId }).sort({ name: 1 }).lean();
    
    res.json({
      success: true,
      level: levelId,
      count: blocks.length,
      data: blocks,
    });
  } catch (error) {
    console.error('Error al obtener bloques del nivel:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener bloques del nivel',
      error: error.message,
    });
  }
});

export default router;

