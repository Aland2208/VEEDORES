import { Router } from 'express';
import { getDashboardVeedor, getDashboardAdministrador } from '../controladores/dashboardC.js';

const router = Router();

router.get('/veedor/:id_usuario', getDashboardVeedor);
router.get('/admin/:id_administrador',getDashboardAdministrador);

export default router;