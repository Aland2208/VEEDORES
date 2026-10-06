import { Router } from "express";

import {

    getReporteCapturas,

    getReportePorFechas,

    getResumenEspecies,

    getTiposReporte

} from "../controladores/reporteC.js";


const router = Router();


// ==========================================
// TIPOS DE REPORTE
// ==========================================

router.get(

    "/tipos",

    getTiposReporte

);


// ==========================================
// TODAS LAS CAPTURAS DE UN USUARIO
// ==========================================

router.get(

    "/capturas/:id_usuario",

    getReporteCapturas

);


// ==========================================
// CAPTURAS POR RANGO DE FECHAS
// ==========================================
//
// Ejemplo:
//
// /api/reporte/capturas/1/fecha
// ?fecha_inicio=2026-10-01
// &fecha_fin=2026-10-06
//
// ==========================================

router.get(

    "/capturas/:id_usuario/fecha",

    getReportePorFechas

);


// ==========================================
// RESUMEN POR ESPECIES
// ==========================================

router.get(

    "/especies/:id_usuario",

    getResumenEspecies

);


export default router;