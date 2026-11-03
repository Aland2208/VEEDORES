
import { randomUUID } from 'node:crypto';
import { conmysql } from '../db.js';
import { getIO } from '../websocket/socket.js';

// CONFIGURACION DE TARA REMOTA
const DURACION_TARA = 60000;
let ordenTaraPendiente = null;

const fechaEcuador = () => new Date().toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    hour12: false
});

const verificarVencimientoTara = () => {
    if (!ordenTaraPendiente) return;
    if (Date.now() - ordenTaraPendiente.creada < DURACION_TARA) return;

    const id = ordenTaraPendiente.id;
    ordenTaraPendiente = null;

    getIO()?.emit('taraError', {
        id_orden: id,
        mensaje: 'La solicitud de tara expiró sin confirmación del ESP32.'
    });
};

// PROBAR CONTROLADOR
export const pruebaBalanza = (req, res) => {
    res.send('Controlador de balanza funcionando correctamente');
};

// REGISTRAR PESO EN MYSQL
export const registrarPeso = async (req, res) => {
    try {
        const { peso, id_usuario, id_deteccion } = req.body;

        if (peso == null || !Number.isFinite(Number(peso)) || Number(peso) < 0) {
            return res.status(400).json({
                estado: 0, mensaje: 'Debe enviar un peso válido'
            });
        }

        if (id_deteccion == null) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Debe enviar el id_deteccion de la especie clasificada'
            });
        }

        const usuario = id_usuario || 1;

        const [result] = await conmysql.query(
            `INSERT INTO capturas
            (id_deteccion, id_usuario, peso, fecha_hora, estado)
            VALUES (?, ?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00'), 1)`,
            [id_deteccion, usuario, Number(peso)]
        );

        const [registro] = await conmysql.query(
            `SELECT DATE_FORMAT(fecha_hora, '%Y-%m-%d %H:%i:%s') AS fecha_hora
             FROM capturas WHERE id_captura = ?`,
            [result.insertId]
        );

        const datos = {
            id_captura: result.insertId,
            id_deteccion: Number(id_deteccion),
            peso: Number(peso),
            fecha_hora: registro[0].fecha_hora
        };

        getIO()?.emit('nuevoPeso', datos);

        return res.status(201).json({
            estado: 1,
            mensaje: 'Peso registrado correctamente',
            ...datos
        });
    } catch (error) {
        console.error('Error registrando peso:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error del servidor'
        });
    }
};

// PESO EN TIEMPO REAL DESDE EL ESP32
export const pesoLive = (req, res) => {
    try {
        const peso = Number(req.body?.peso);

        if (req.body?.peso == null || !Number.isFinite(peso) || peso < 0) {
            return res.status(400).json({
                estado: 0, mensaje: 'Debe enviar un peso válido'
            });
        }

        getIO()?.emit('pesoActual', {
            peso,
            fecha_hora: fechaEcuador()
        });

        return res.json({
            estado: 1,
            mensaje: 'Peso enviado en tiempo real',
            peso
        });
    } catch (error) {
        console.error('Error en pesoLive:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error del servidor'
        });
    }
};

// OBTENER TODOS LOS PESOS
export const getPesos = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT c.id_captura, c.id_deteccion, c.peso,
                DATE_FORMAT(c.fecha_hora, '%Y-%m-%d %H:%i:%s') AS fecha_hora,
                c.estado, u.nombre, u.apellido
             FROM capturas c
             INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
             WHERE c.estado = 1
             ORDER BY c.id_captura DESC`
        );

        return res.json({
            cantidad: result.length,
            data: result
        });
    } catch (error) {
        console.error('Error obteniendo pesos:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error del servidor'
        });
    }
};

// OBTENER PESO POR ID
export const getPesoByID = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `SELECT id_captura, id_deteccion, id_usuario, peso,
                DATE_FORMAT(fecha_hora, '%Y-%m-%d %H:%i:%s') AS fecha_hora, estado
             FROM capturas
             WHERE id_captura = ? AND estado = 1`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                estado: 0, mensaje: 'Registro no encontrado'
            });
        }

        return res.json(result[0]);
    } catch (error) {
        console.error('Error obteniendo peso:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error del servidor'
        });
    }
};

// OBTENER ULTIMO PESO REGISTRADO
export const ultimoPeso = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT id_captura, id_deteccion, peso,
                DATE_FORMAT(fecha_hora, '%Y-%m-%d %H:%i:%s') AS fecha_hora
             FROM capturas
             WHERE estado = 1
             ORDER BY id_captura DESC LIMIT 1`
        );

        if (result.length === 0) {
            return res.json({
                estado: 0, mensaje: 'No existen registros'
            });
        }

        return res.json({
            estado: 1,
            data: result[0]
        });
    } catch (error) {
        console.error('Error obteniendo último peso:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error del servidor'
        });
    }
};

// DESACTIVAR CAPTURA
export const desactivarPeso = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            'UPDATE capturas SET estado = 0 WHERE id_captura = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                estado: 0, mensaje: 'Registro no encontrado'
            });
        }

        return res.json({
            estado: 1, mensaje: 'Registro desactivado correctamente'
        });
    } catch (error) {
        console.error('Error desactivando captura:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error del servidor'
        });
    }
};

// ACTIVAR CAPTURA
export const activarPeso = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            'UPDATE capturas SET estado = 1 WHERE id_captura = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                estado: 0, mensaje: 'Registro no encontrado'
            });
        }

        return res.json({
            estado: 1, mensaje: 'Registro activado correctamente'
        });
    } catch (error) {
        console.error('Error activando captura:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error del servidor'
        });
    }
};

// SOLICITUD DE TARA DESDE ANGULAR
export const solicitarTara = (req, res) => {
    try {
        verificarVencimientoTara();

        if (ordenTaraPendiente) {
            return res.status(409).json({
                estado: 0,
                mensaje: 'Ya existe una solicitud de tara pendiente'
            });
        }

        ordenTaraPendiente = {
            id: randomUUID(),
            creada: Date.now()
        };

        console.log('Nueva solicitud de tara:', ordenTaraPendiente.id);

        return res.status(202).json({
            estado: 1,
            mensaje: 'Solicitud recibida. Esperando confirmación del ESP32',
            id_orden: ordenTaraPendiente.id
        });
    } catch (error) {
        console.error('Error solicitando tara:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error solicitando tara'
        });
    }
};

// ESP32 CONSULTA SI EXISTE UNA ORDEN
export const consultarOrdenTara = (req, res) => {
    try {
        verificarVencimientoTara();
        res.set('Cache-Control', 'no-store');

        if (!ordenTaraPendiente) {
            return res.type('text/plain').send('NINGUNA');
        }

        return res.type('text/plain').send(
            `TARA:${ordenTaraPendiente.id}`
        );
    } catch (error) {
        console.error('Error consultando orden:', error);
        return res.status(500).send('ERROR');
    }
};

// CONFIRMACION DE TARA DESDE EL ESP32
export const taraRealizada = (req, res) => {
    try {
        verificarVencimientoTara();

        const { id_orden, tipo, exito, mensaje } = req.body || {};
        const io = getIO();

        // TARA REALIZADA CON EL BOTON FISICO
        if (tipo === 'fisica') {
            if (exito !== true) {
                return res.status(400).json({
                    estado: 0, mensaje: 'Confirmación de tara física inválida'
                });
            }

            const idPendiente = ordenTaraPendiente?.id || null;
            ordenTaraPendiente = null;

            io?.emit('taraRealizada', {
                id_orden: idPendiente,
                origen: 'fisica',
                mensaje: 'Tara física realizada correctamente',
                fecha_hora: fechaEcuador()
            });

            return res.json({
                estado: 1, mensaje: 'Tara física confirmada'
            });
        }

        // TARA REMOTA SOLICITADA DESDE VIGIA
        if (!ordenTaraPendiente || typeof id_orden !== 'string' ||
            id_orden !== ordenTaraPendiente.id) {
            return res.status(409).json({
                estado: 0, mensaje: 'No existe una orden pendiente válida'
            });
        }

        if (typeof exito !== 'boolean') {
            return res.status(400).json({
                estado: 0, mensaje: 'Debe indicar el resultado de la tara'
            });
        }

        const idConfirmado = ordenTaraPendiente.id;
        ordenTaraPendiente = null;

        if (!exito) {
            const motivo = typeof mensaje === 'string'
                ? mensaje.slice(0, 200) : 'El ESP32 rechazó la tara';

            io?.emit('taraError', {
                id_orden: idConfirmado,
                mensaje: motivo,
                fecha_hora: fechaEcuador()
            });

            return res.json({
                estado: 0,
                mensaje: 'El ESP32 no pudo realizar la tara'
            });
        }

        io?.emit('taraRealizada', {
            id_orden: idConfirmado,
            origen: 'web',
            mensaje: 'Balanza puesta en cero correctamente',
            fecha_hora: fechaEcuador()
        });

        console.log('Tara remota confirmada:', idConfirmado);

        return res.json({
            estado: 1,
            mensaje: 'Tara realizada correctamente'
        });
    } catch (error) {
        console.error('Error confirmando tara:', error);
        return res.status(500).json({
            estado: 0, mensaje: 'Error del servidor'
        });
    }
};
