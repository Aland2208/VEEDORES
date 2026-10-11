import { Router } from 'express';
import {
    getObservadores,
    crearObservador,
    editarObservador,
    cambiarEstadoObservador
} from '../controladores/usuariosC.js';
import { requireAdmin, verifyToken } from '../middlewares/verifyToken.js';
import { limitarSolicitudesRegistro } from '../middlewares/limitar-registro.js';

const router=Router();

router.use(verifyToken, requireAdmin);
router.get('/observadores',getObservadores);
router.post('/observadores',limitarSolicitudesRegistro,crearObservador);
router.patch('/observadores/:id_usuario',editarObservador);
router.patch('/observadores/:id_usuario/estado',cambiarEstadoObservador);

export default router;