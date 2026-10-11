import crypto from 'node:crypto';

const VENTANA_IP_MS = 15 * 60 * 1000;
const MAX_REGISTROS_IP = 5;
const VENTANA_CORREO_MS = 60 * 60 * 1000;
const MAX_REGISTROS_CORREO = 3;
const MAX_CLAVES_POR_TIPO = 10000;
const INTERVALO_LIMPIEZA_MS = 60 * 1000;

const intentosPorIp = new Map();
const intentosPorCorreo = new Map();

function registrarIntento(registros, clave, maximo, duracionMs) {
    const ahora = Date.now();
    let registro = registros.get(clave);

    if (!registro || registro.venceEn <= ahora) {
        if (!registro && registros.size >= MAX_CLAVES_POR_TIPO) {
            return { permitido: false, saturado: true };
        }

        registro = { cantidad: 0, venceEn: ahora + duracionMs };
        registros.set(clave, registro);
    }

    if (registro.cantidad >= maximo) {
        return {
            permitido: false,
            reintentarEn: Math.max(1, Math.ceil((registro.venceEn - ahora) / 1000))
        };
    }

    registro.cantidad += 1;
    return { permitido: true };
}

function eliminarIntentosVencidos() {
    const ahora = Date.now();
    for (const registros of [intentosPorIp, intentosPorCorreo]) {
        for (const [clave, registro] of registros) {
            if (registro.venceEn <= ahora) {
                registros.delete(clave);
            }
        }
    }
}

const temporizadorLimpieza = setInterval(
    eliminarIntentosVencidos,
    INTERVALO_LIMPIEZA_MS
);
temporizadorLimpieza.unref();

export function limitarSolicitudesRegistro(req, res, next) {
    eliminarIntentosVencidos();

    const ip = String(req.ip || req.socket?.remoteAddress || 'desconocida');
    const resultadoIp = registrarIntento(
        intentosPorIp,
        ip,
        MAX_REGISTROS_IP,
        VENTANA_IP_MS
    );

    if (!resultadoIp.permitido) {
        if (resultadoIp.saturado) {
            return res.status(503).json({
                estado: 0,
                mensaje: 'El registro está temporalmente ocupado. Intenta más tarde.'
            });
        }

        res.set('Retry-After', String(resultadoIp.reintentarEn));
        return res.status(429).json({
            estado: 0,
            mensaje: 'Se alcanzó el límite de registros desde esta conexión. Intenta más tarde.'
        });
    }

    const correo = typeof req.body?.correo === 'string'
        ? req.body.correo.trim().toLowerCase()
        : '';

    if (correo) {
        const hashCorreo = crypto
            .createHash('sha256')
            .update(correo)
            .digest('hex');
        const resultadoCorreo = registrarIntento(
            intentosPorCorreo,
            hashCorreo,
            MAX_REGISTROS_CORREO,
            VENTANA_CORREO_MS
        );

        if (!resultadoCorreo.permitido) {
            if (resultadoCorreo.saturado) {
                return res.status(503).json({
                    estado: 0,
                    mensaje: 'El registro está temporalmente ocupado. Intenta más tarde.'
                });
            }

            res.set('Retry-After', String(resultadoCorreo.reintentarEn));
            return res.status(429).json({
                estado: 0,
                mensaje: 'Se alcanzó el límite de solicitudes para este correo. Intenta más tarde.'
            });
        }
    }

    return next();
}
