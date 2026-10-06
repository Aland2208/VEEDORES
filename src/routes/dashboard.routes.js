import { Router } from 'express';
import { getDashboardVeedor } from '../controladores/dashboardC.js';

const router = Router();

router.get('/veedor/:id_usuario', getDashboardVeedor);

export default router;