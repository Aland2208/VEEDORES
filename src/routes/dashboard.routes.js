import { Router } from 'express';
import { getDashboardVeedor, getDashboardAdministrador } from '../controladores/dashboardC.js';
import {
    requireAdmin,
    requireOwnAdminId,
    requireOwnUserId,
    verifyToken
} from '../middlewares/verifyToken.js';

const router = Router();

router.get('/veedor/:id_usuario', verifyToken, requireOwnUserId, getDashboardVeedor);
router.get(
    '/admin/:id_administrador',
    verifyToken,
    requireAdmin,
    requireOwnAdminId,
    getDashboardAdministrador
);

export default router;