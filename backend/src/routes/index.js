import { Router } from 'express';
import authRoutes from './auth.routes.js';
import blocksRoutes from './blocks.routes.js';
import levelsRoutes from './levels.routes.js';
import scoresRoutes from './scores.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/blocks', blocksRoutes);
router.use('/levels', levelsRoutes);
router.use('/scores', scoresRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

export default router;

