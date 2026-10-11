import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

export const verifyToken = (req, res, next) => {
  const header = req.headers['authorization'];

  if (!header) {
    return res.status(401).json({ estado: 0, mensaje: 'Debes iniciar sesión para continuar.' });
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ estado: 0, mensaje: 'La sesión no es válida.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch {
    return res.status(401).json({ estado: 0, mensaje: 'La sesión venció. Inicia sesión nuevamente.' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (Number(req.usuario?.id_rol) !== 1) {
    return res.status(403).json({
      estado: 0,
      mensaje: 'Solo un administrador puede gestionar observadores.'
    });
  }

  next();
};

export const requireOwnAdminId = (req, res, next) => {
  if (Number(req.params.id_administrador) !== Number(req.usuario?.id_usuario)) {
    return res.status(403).json({
      estado: 0,
      mensaje: 'No tienes permiso para consultar los usuarios de otro administrador.'
    });
  }

  next();
};

export const requireOwnUserId = (req, res, next) => {
  if (
    Number(req.usuario?.id_rol) !== 2 ||
    Number(req.params.id_usuario) !== Number(req.usuario?.id_usuario)
  ) {
    return res.status(403).json({
      estado: 0,
      mensaje: 'No tienes permiso para consultar los datos de este usuario.'
    });
  }

  next();
};
