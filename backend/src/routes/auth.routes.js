import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { getJwtSecret, publicError } from '../config/env.js';
import { User } from '../models/User.js';

const router = Router();

// No devolver el valor enviado (evita reflejar contraseñas en la respuesta); se conserva msg/path.
const safeErrors = (result) => result.array().map(({ value, ...rest }) => rest);

// Generar token JWT
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    getJwtSecret(),
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
      .isString()
      .withMessage('Debe ser un email válido')
      .bail()
      .isLength({ max: 254 })
      .withMessage('El email es demasiado largo')
      .bail()
      .isEmail()
      .withMessage('Debe ser un email válido')
      .normalizeEmail(),
    body('password')
      .isString()
      .withMessage('La contraseña debe ser un texto')
      .bail()
      .isLength({ min: 6, max: 72 })
      .withMessage('La contraseña debe tener entre 6 y 72 caracteres'),
    body('name')
      .optional({ values: 'falsy' })
      .isString()
      .withMessage('El nombre debe ser un texto')
      .bail()
      .trim()
      .isLength({ max: 50 })
      .withMessage('El nombre no puede superar 50 caracteres')
      .escape(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: safeErrors(errors) });
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
      // Carrera entre dos registros simultáneos con el mismo email (índice único)
      if (error?.code === 11000) {
        res.status(400).json({ message: 'El usuario ya existe con este email' });
        return;
      }
      if (error?.name === 'ValidationError') {
        res.status(400).json({ message: 'Datos de registro no válidos' });
        return;
      }
      console.error('Error en registro:', error);
      res.status(500).json({ message: 'Error al registrar usuario', error: publicError(error) });
    }
  }
);

// Login de usuario
router.post(
  '/login',
  [
    body('email')
      .isString()
      .withMessage('Debe ser un email válido')
      .bail()
      .isLength({ max: 254 })
      .withMessage('Debe ser un email válido')
      .bail()
      .isEmail()
      .withMessage('Debe ser un email válido')
      .normalizeEmail(),
    body('password')
      .isString()
      .withMessage('La contraseña es requerida')
      .bail()
      .notEmpty()
      .withMessage('La contraseña es requerida')
      .bail()
      .isLength({ max: 72 })
      .withMessage('Credenciales inválidas'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: safeErrors(errors) });
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
      res.status(500).json({ message: 'Error al iniciar sesión', error: publicError(error) });
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

    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

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

