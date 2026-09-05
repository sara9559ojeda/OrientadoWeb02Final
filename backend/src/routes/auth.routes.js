import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const router = Router();

// Generar token JWT
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'tu_secreto_jwt_super_seguro_cambiar_en_produccion',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    }
  );
};

// Registro de usuario
router.post(
  '/register',
  [
    body('email')
      .isEmail()
      .withMessage('Debe ser un email válido')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('name').optional().trim().escape(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password, name } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ message: 'El usuario ya existe con este email' });
        return;
      }

      // Crear nuevo usuario
      const user = new User({
        email,
        password,
        name: name || '',
      });

      await user.save();

      // Generar token
      const token = generateToken(user._id.toString());

      res.status(201).json({
        message: 'Usuario registrado exitosamente',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ message: 'Error al registrar usuario', error: error.message });
    }
  }
);

// Login de usuario
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Debe ser un email válido')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('La contraseña es requerida'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password } = req.body;

      // Buscar usuario y incluir password para comparar
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        res.status(401).json({ message: 'Credenciales inválidas' });
        return;
      }

      // Verificar contraseña
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        res.status(401).json({ message: 'Credenciales inválidas' });
        return;
      }

      // Generar token
      const token = generateToken(user._id.toString());

      res.json({
        message: 'Login exitoso',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
    }
  }
);

// Obtener perfil del usuario autenticado
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ message: 'No hay token, acceso denegado' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '');

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(401).json({ message: 'Token no válido' });
  }
});

export default router;

