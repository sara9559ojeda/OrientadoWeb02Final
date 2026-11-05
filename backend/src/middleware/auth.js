import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';
import { User } from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ message: 'No hay token, acceso denegado' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401).json({ message: 'Token no válido, usuario no encontrado' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token no válido' });
  }
};

