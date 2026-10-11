import { Router } from 'express';
import { getDashboardVeedor, getDashboardAdministrador } from '../controladores/dashboardC.js';
import {
    requireAdmin,
    requireOwnAdminId,
    requireOwnVeedorId,
    verifyToken
} from '../middlewares/verifyToken.js';

const router = Router();

router.get('/veedor/:id_usuario', verifyToken, requireOwnVeedorId, getDashboardVeedor);
router.get(
    '/admin/:id_administrador',
    verifyToken,
    requireAdmin,
    requireOwnAdminId,
    getDashboardAdministrador
);

export default router;