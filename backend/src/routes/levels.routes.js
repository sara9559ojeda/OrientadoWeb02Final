import { Router } from 'express';
import { Level } from '../models/Level.js';

const router = Router();

// GET /api/levels - Obtener todos los niveles
router.get('/', async (req, res) => {
  try {
    const levels = await Level.find({ isActive: true }).sort({ levelNumber: 1 });
    res.json({
      success: true,
      data: levels,
      count: levels.length,
    });
  } catch (error) {
    console.error('Error al obtener niveles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener niveles',
      error: error.message,
    });
  }
});

// GET /api/levels/:levelId - Obtener configuración de un nivel específico
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

    const level = await Level.findOne({ levelNumber: levelId, isActive: true });

    if (!level) {
      res.status(404).json({
        success: false,
        message: `Nivel ${levelId} no encontrado`,
      });
      return;
    }

    res.json({
      success: true,
      data: level,
    });
  } catch (error) {
    console.error('Error al obtener nivel:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el nivel',
      error: error.message,
    });
  }
});

// GET /api/levels/:levelId/coins-count - Obtener solo cantidad de coins de un nivel
router.get('/:levelId/coins-count', async (req, res) => {
  try {
    const levelId = parseInt(req.params.levelId);
    
    if (isNaN(levelId)) {
      res.status(400).json({
        success: false,
        message: 'El ID del nivel debe ser un número',
      });
      return;
    }

    const level = await Level.findOne({ levelNumber: levelId, isActive: true });

    if (!level) {
      res.status(404).json({
        success: false,
        message: `Nivel ${levelId} no encontrado`,
        coinsCount: 10, // Valor por defecto
      });
      return;
    }

    res.json({
      success: true,
      levelNumber: level.levelNumber,
      coinsCount: level.coinsCount,
    });
  } catch (error) {
    console.error('Error al obtener cantidad de coins:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cantidad de coins',
      error: error.message,
      coinsCount: 10, // Valor por defecto en caso de error
    });
  }
});

export default router;

