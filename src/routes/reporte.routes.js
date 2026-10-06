import { Router } from "express";

import {getReporteCapturas, getReporteCapturasPorFecha, getResumenEspecies, getTiposReporte } from "../controladores/reporteC.js";


const router = Router();


// ==========================================
// TIPOS DE REPORTE
// ==========================================

router.get(
    '/tipos',
    getTiposReporte
);


// ==========================================
// REPORTE DE CAPTURAS
// ==========================================

router.get(
    '/capturas/:id_usuario',
    getReporteCapturas
);


// ==========================================
// REPORTE POR RANGO DE FECHAS
// ==========================================

router.get(
    '/capturas/:id_usuario/fecha',
    getReporteCapturasPorFecha
);


// ==========================================
// RESUMEN POR ESPECIE
// ==========================================

router.get(
    '/especies/:id_usuario',
    getResumenEspecies
);


export default router;