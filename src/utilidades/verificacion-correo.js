import crypto from 'crypto';

const DURACION_TOKEN_VERIFICACION_MS = 15 * 60 * 1000;

export function crearTokenVerificacionCorreo() {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expira = new Date(Date.now() + DURACION_TOKEN_VERIFICACION_MS);

    return { token, tokenHash, expira };
}

export function servicioVerificacionCorreoConfigurado() {
    return Boolean(process.env.API_BREVO && process.env.FRONTEND_URL);
}

export async function enviarCorreoVerificacion(correo, token) {
    if (!servicioVerificacionCorreoConfigurado()) {
        throw new Error('El servicio de verificación de correo no está configurado.');
    }

    const urlFrontend = process.env.FRONTEND_URL.replace(/\/+$/, '');
    const urlVerificacion = `${urlFrontend}/verificar-correo?token=${encodeURIComponent(token)}`;
    const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'api-key': process.env.API_BREVO
        },
        body: JSON.stringify({
            sender: { name: 'VIGÍA', email: 'veedoresbu@gmail.com' },
            to: [{ email: correo }],
            subject: 'Confirma tu correo electrónico | VIGÍA',
            htmlContent: `
                <div style="font-family:Arial,sans-serif;color:#071627;max-width:600px;margin:auto">
                    <h1>Confirma tu correo</h1>
                    <p>Para activar tu cuenta de VIGÍA, confirma que puedes recibir mensajes en esta dirección.</p>
                    <p><a href="${urlVerificacion}">Verificar correo electrónico</a></p>
                    <p>Este enlace vence en 15 minutos. Si no solicitaste esta cuenta, ignora este mensaje.</p>
                </div>`
        })
    });

    if (!respuesta.ok) {
        throw new Error('El proveedor de correo rechazó el envío de verificación.');
    }

    await respuesta.text();
}
