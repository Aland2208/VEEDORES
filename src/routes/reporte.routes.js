import { Router } from "express";

import {
    getReporteCapturas,
    getReportePorFechas,
    getResumenEspecies,
    getTiposReporte,
    getReportesPendientesHoy

} from "../controladores/reporteC.js";


const router = Router();


router.get(
    "/tipos",
    getTiposReporte
);


router.get(
    "/pendientes/hoy/:id_usuario",
    getReportesPendientesHoy
);


router.get(
    "/capturas/:id_usuario/fecha",
    getReportePorFechas
);


router.get(
    "/capturas/:id_usuario",
    getReporteCapturas
);


router.get(
    "/especies/:id_usuario",
    getResumenEspecies
);


export default router;