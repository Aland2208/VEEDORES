
import { Router } from 'express';

import {
    buscarAdministradorPorCorreo,
    getUsuariosAdministrador,
    getUsuariosDisponibles,
    asignarUsuario,
    reasignarUsuario,
    quitarUsuarioAdministrador,
    getHistorialUsuario,
    getAdministradorActual,
    getVeedoresHistorial,
    getReportesHistorialVeedor,
    guardarUrlCamaraAdmin,
    obtenerUrlCamaraVinculada,
    cambiarVisualizacionCamara
} from '../controladores/administradorC.js';

import {
    requireOwnAdminRequest,
    requireAdmin,
    requireOwnAdminId,
    requireOwnUserId,
    requireOwnUserRequest,
    requireRole,
    verifyToken
} from '../middlewares/verifyToken.js';

const router = Router();

// =====================================================
// 1. BÚSQUEDA DE ADMINISTRADORES
// =====================================================

router.get(
    '/buscar',
    verifyToken,
    requireRole(2),
    buscarAdministradorPorCorreo
);

// =====================================================
// 2. GESTIÓN DE VEEDORES
// =====================================================

router.get(
    '/usuarios/:id_administrador',
    verifyToken,
    requireAdmin,
    requireOwnAdminId,
    getUsuariosAdministrador
);

router.get(
    '/disponibles',
    verifyToken,
    requireAdmin,
    getUsuariosDisponibles
);

router.post(
    '/asignar/:id_administrador',
    verifyToken,
    requireRole(2),
    requireOwnUserRequest,
    asignarUsuario
);

router.patch(
    '/reasignar/:id_usuario',
    verifyToken,
    requireRole(2),
    requireOwnUserId,
    reasignarUsuario
);

router.patch(
    '/quitar/:id_administrador/:id_usuario',
    verifyToken,
    requireOwnAdminRequest,
    quitarUsuarioAdministrador
);

router.get(
    '/actual/:id_usuario',
    verifyToken,
    requireOwnUserId,
    getAdministradorActual
);

// =====================================================
// 3. HISTORIAL DE ASIGNACIONES
// =====================================================

router.get(
    '/historial/:id_usuario',
    verifyToken,
    requireOwnUserId,
    getHistorialUsuario
);

router.get(
    '/:id_administrador/veedores/historial',
    verifyToken,
    requireOwnAdminRequest,
    getVeedoresHistorial
);

router.get(
    '/:id_administrador/veedores/:id_usuario/reportes',
    verifyToken,
    requireOwnAdminRequest,
    getReportesHistorialVeedor
);

// =====================================================
// 4. CONFIGURACIÓN DE CÁMARA
// =====================================================

router.post(
    '/config/url-camara',
    verifyToken,
    requireOwnAdminRequest,
    guardarUrlCamaraAdmin
);

router.get(
    '/config/url-camara/:id_usuario',
    verifyToken,
    requireOwnUserRequest,
    obtenerUrlCamaraVinculada
);

// =====================================================
// 5. CONTROL DE VISUALIZACIÓN DE CÁMARA
// =====================================================

router.patch(
    '/config/camara/:id_administrador/visualizacion',
    verifyToken,
    requireAdmin,
    requireOwnAdminId,
    cambiarVisualizacionCamara
);

export default router;
