import { Router } from 'express';
import { publicError } from '../config/env.js';
import { Block } from '../models/Block.js';

const router = Router();

// GET /api/blocks - Obtener todos los bloques desde MongoDB
router.get('/', async (req, res) => {
  try {
    // Obtener parámetros de consulta opcionales
    const { level, role } = req.query;

    // Validar los parámetros: llegan de la URL y no deben producir errores 500
    // ni permitir operadores de MongoDB (p. ej. ?role[$ne]=x).
    const filter = {};
    if (level !== undefined && level !== '') {
      const levelNumber = typeof level === 'string' ? Number(level) : NaN;
      if (!Number.isInteger(levelNumber)) {
        res.status(400).json({
          success: false,
          message: 'El parámetro level debe ser un número entero',
        });
        return;
      }
      filter.level = levelNumber;
    }
    if (role !== undefined && role !== '') {
      if (typeof role !== 'string') {
        res.status(400).json({
          success: false,
          message: 'El parámetro role debe ser un texto',
        });
        return;
      }
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
      error: publicError(error),
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
      error: publicError(error),
    });
  }
});

export default router;

