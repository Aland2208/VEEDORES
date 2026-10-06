import { Router } from 'express';
import {
    getObservadores,
    crearObservador,
    editarObservador,
    cambiarEstadoObservador
} from '../controladores/usuariosC.js';

const router=Router();

router.get('/observadores',getObservadores);
router.post('/observadores',crearObservador);
router.patch('/observadores/:id_usuario',editarObservador);
router.patch('/observadores/:id_usuario/estado',cambiarEstadoObservador);

export default router;