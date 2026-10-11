import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';
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
    if (
      !Number.isInteger(Number(decoded.id_usuario)) ||
      Number(decoded.id_usuario) <= 0 ||
      ![1, 2].includes(Number(decoded.id_rol))
    ) {
      return res.status(401).json({ estado: 0, mensaje: 'La sesión no es válida.' });
    }
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

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(Number(req.usuario?.id_rol))) {
    return res.status(403).json({
      estado: 0,
      mensaje: 'No tienes permisos para realizar esta operación.'
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

export const requireOwnAdminRequest = (req, res, next) => {
  if (Number(req.usuario?.id_rol) !== 1) {
    return res.status(403).json({
      estado: 0,
      mensaje: 'Solo un administrador puede realizar esta operación.'
    });
  }

  const ids = [
    req.params.id_administrador,
    req.body?.id_administrador,
    req.query.id_administrador
  ].filter(value => value !== undefined && value !== null && value !== '');

  if (
    ids.length === 0 ||
    ids.some(id => Number(id) !== Number(req.usuario?.id_usuario))
  ) {
    return res.status(403).json({
      estado: 0,
      mensaje: 'No tienes permiso para consultar los datos de este administrador.'
    });
  }

  next();
};

export const requireOwnUserId = (req, res, next) => {
  if (Number(req.params.id_usuario) !== Number(req.usuario?.id_usuario)) {
    return res.status(403).json({
      estado: 0,
      mensaje: 'No tienes permiso para consultar los datos de este usuario.'
    });
  }

  next();
};

export const requireOwnVeedorId = (req, res, next) => {
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

export const requireOwnUserRequest = (req, res, next) => {
  const idUsuario = Number(req.usuario?.id_usuario);
  const ids = [
    req.params.id_usuario,
    req.body?.id_usuario,
    req.query.id_usuario
  ].filter(value => value !== undefined && value !== null && value !== '');

  if (
    !Number.isInteger(idUsuario) ||
    ids.length === 0 ||
    ids.some(id => Number(id) !== idUsuario)
  ) {
    return res.status(403).json({
      estado: 0,
      mensaje: 'No tienes permiso para consultar los datos de este usuario.'
    });
  }

  next();
};

export const requireDeviceKey = (req, res, next) => {
  const configuredKey = process.env.DEVICE_API_KEY;
  const providedKey = req.get('x-device-key') || '';

  if (!configuredKey) {
    return res.status(503).json({
      estado: 0,
      mensaje: 'La autenticación del dispositivo no está configurada.'
    });
  }

  const expected = Buffer.from(configuredKey);
  const received = Buffer.from(providedKey);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return res.status(401).json({
      estado: 0,
      mensaje: 'El dispositivo no está autorizado.'
    });
  }

  next();
};
