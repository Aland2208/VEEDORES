import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

export const verifyToken = (req, res, next) => {
  const header = req.headers['authorization'];

  if (!header) {
    return res.status(403).json({ estado: 0, error: 'Token requerido' });
  }

  const token = header.split(' ')[1]; // formato: Bearer <token>

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded; // token válido
    next();
  } catch (error) {
    return res.status(401).json({ estado: 0, error: 'Token inválido o expirado' });
  }
};
