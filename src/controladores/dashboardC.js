import { conmysql } from '../db.js';

export const getDashboardVeedor = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Usuario no válido'
            });
        }

        // RESUMEN GENERAL DEL DÍA
        const [resumen] = await conmysql.query(`
            SELECT
                COUNT(c.id_captura) AS total_capturas,
                COALESCE(SUM(c.peso), 0) AS peso_total,
                COALESCE(AVG(d.porcentaje), 0) AS confianza_promedio,
                COUNT(DISTINCT d.id_especie) AS total_especies
            FROM capturas c
            INNER JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion
            WHERE c.id_usuario = ?
              AND c.estado = 1
              AND c.fecha_hora >= CURDATE()
              AND c.fecha_hora < CURDATE() + INTERVAL 1 DAY
        `, [idUsuario]);

        // DISTRIBUCIÓN POR ESPECIE
        const [especies] = await conmysql.query(`
            SELECT
                e.id_especie,
                e.nombre_comun,
                e.nombre_cientifico,
                COUNT(c.id_captura) AS total_capturas,
                COALESCE(SUM(c.peso), 0) AS peso_total,
                COALESCE(AVG(d.porcentaje), 0) AS confianza_promedio
            FROM capturas c
            INNER JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion
            INNER JOIN especies e
                ON d.id_especie = e.id_especie
            WHERE c.id_usuario = ?
              AND c.estado = 1
              AND c.fecha_hora >= CURDATE()
              AND c.fecha_hora < CURDATE() + INTERVAL 1 DAY
            GROUP BY
                e.id_especie,
                e.nombre_comun,
                e.nombre_cientifico
            ORDER BY total_capturas DESC
        `, [idUsuario]);

        return res.status(200).json({
            estado: 1,
            mensaje: 'Dashboard obtenido correctamente',
            data: {
                resumen: {
                    total_capturas: Number(resumen[0]?.total_capturas || 0),
                    peso_total: Number(resumen[0]?.peso_total || 0),
                    confianza_promedio: Number(resumen[0]?.confianza_promedio || 0),
                    total_especies: Number(resumen[0]?.total_especies || 0)
                },
                especies: especies.map(especie => ({
                    ...especie,
                    total_capturas: Number(especie.total_capturas || 0),
                    peso_total: Number(especie.peso_total || 0),
                    confianza_promedio: Number(especie.confianza_promedio || 0)
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error getDashboardVeedor:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al obtener el dashboard'
        });
    }
};