import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { GameScore } from '../models/GameScore.js';

const router = Router();

// POST /api/scores - Guardar puntuación (requiere autenticación)
router.post(
  '/',
  authenticate,
  [
    body('totalPoints')
      .isInt({ min: 0 })
      .withMessage('Los puntos totales deben ser un número entero positivo'),
    body('pointsByLevel.level1')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Los puntos del nivel 1 deben ser un número entero positivo'),
    body('pointsByLevel.level2')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Los puntos del nivel 2 deben ser un número entero positivo'),
    body('pointsByLevel.level3')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Los puntos del nivel 3 deben ser un número entero positivo'),
    body('gameTime')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('El tiempo de juego debe ser un número positivo'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const { totalPoints, pointsByLevel, gameTime } = req.body;
      const userId = req.user._id; // Del middleware de autenticación

      // Crear nueva puntuación
      const gameScore = new GameScore({
        user: userId,
        totalPoints,
        pointsByLevel: {
          level1: pointsByLevel?.level1 || 0,
          level2: pointsByLevel?.level2 || 0,
          level3: pointsByLevel?.level3 || 0,
        },
        gameTime: gameTime || null,
      });

      await gameScore.save();

      // Poblar datos del usuario
      await gameScore.populate('user', 'email name');

      res.status(201).json({
        success: true,
        message: 'Puntuación guardada exitosamente',
        data: gameScore,
      });
    } catch (error) {
      console.error('Error al guardar puntuación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al guardar puntuación',
        error: error.message,
      });
    }
  }
);

// GET /api/scores - Obtener ranking global (top 10 por defecto)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const limitValue = Math.min(Math.max(limit, 1), 100); // Entre 1 y 100

    const scores = await GameScore.getRanking(limitValue);

    res.json({
      success: true,
      data: scores,
      count: scores.length,
    });
  } catch (error) {
    console.error('Error al obtener ranking:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ranking',
      error: error.message,
    });
  }
});

// GET /api/scores/me - Obtener puntuaciones del usuario actual (requiere autenticación)
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    // Obtener todas las puntuaciones del usuario, ordenadas por puntos totales
    const scores = await GameScore.find({ user: userId })
      .sort({ totalPoints: -1, createdAt: -1 })
      .limit(10)
      .exec();

    // Obtener la mejor puntuación
    const bestScore = await GameScore.getBestScore(userId);

    res.json({
      success: true,
      data: {
        scores,
        bestScore: bestScore || null,
        totalGames: scores.length,
      },
    });
  } catch (error) {
    console.error('Error al obtener puntuaciones del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener puntuaciones',
      error: error.message,
    });
  }
});

// GET /api/scores/best - Obtener mejor puntuación del usuario actual (requiere autenticación)
router.get('/best', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const bestScore = await GameScore.getBestScore(userId);

    if (!bestScore) {
      res.json({
        success: true,
        message: 'No hay puntuaciones registradas',
        data: null,
      });
      return;
    }

    res.json({
      success: true,
      data: bestScore,
    });
  } catch (error) {
    console.error('Error al obtener mejor puntuación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mejor puntuación',
      error: error.message,
    });
  }
});

export default router;

