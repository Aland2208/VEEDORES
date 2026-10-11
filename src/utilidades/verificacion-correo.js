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
                <!doctype html>
                <html lang="es">
                <body style="margin:0;padding:0;background:#eef3f6;font-family:Arial,Helvetica,sans-serif;color:#183247">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f6;padding:32px 12px">
                        <tr>
                            <td align="center">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dce5ea;border-radius:16px;overflow:hidden">
                                    <tr>
                                        <td style="padding:25px 32px;background:#071f35;color:#f2f7fa">
                                            <div style="font-size:12px;font-weight:bold;letter-spacing:3px;color:#5eead4">SISTEMA DE OBSERVACIÓN PESQUERA</div>
                                            <div style="margin-top:7px;font-size:27px;font-weight:800;letter-spacing:4px">VIGÍA</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:34px 32px 18px">
                                            <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#e8f7f5;color:#087f79;font-size:11px;font-weight:bold;letter-spacing:1px">CONFIRMACIÓN DE CORREO</div>
                                            <h1 style="margin:18px 0 10px;color:#0a1f33;font-size:25px;line-height:1.25">Completa tu registro</h1>
                                            <p style="margin:0;color:#5a6b7a;font-size:15px;line-height:1.65">
                                                Recibimos una solicitud para crear una cuenta en VIGÍA con este correo.
                                                Confirma que tienes acceso a esta dirección; tu cuenta se creará al completar este paso.
                                            </p>
                                            <div style="padding:24px 0 20px;text-align:center">
                                                <a href="${urlVerificacion}" style="display:inline-block;padding:14px 26px;border-radius:9px;background:#12969e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:.5px">
                                                    CONFIRMAR CORREO
                                                </a>
                                            </div>
                                            <div style="padding:13px 15px;border:1px solid #dce5ea;border-radius:9px;background:#f5f9fb;color:#5a6b7a;font-size:13px;line-height:1.55">
                                                Por seguridad, este enlace vence en <strong style="color:#183247">15 minutos</strong> y solo puede utilizarse una vez.
                                            </div>
                                            <p style="margin:20px 0 0;color:#718391;font-size:12px;line-height:1.6">
                                                Si el botón no funciona, copia este enlace en tu navegador:<br>
                                                <a href="${urlVerificacion}" style="color:#087f79;word-break:break-all">${urlVerificacion}</a>
                                            </p>
                                            <p style="margin:19px 0 0;color:#718391;font-size:12px;line-height:1.6">
                                                Si no solicitaste esta cuenta, ignora este mensaje. No se creará una cuenta mientras no confirmes el correo.
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:17px 32px;background:#f5f9fb;border-top:1px solid #e5edf1;color:#8494a0;font-size:11px;line-height:1.5">
                                            VIGÍA · Registro de campo<br>
                                            Mensaje automático; no respondas a este correo.
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>`
        })
    });

    if (!respuesta.ok) {
        throw new Error('El proveedor de correo rechazó el envío de verificación.');
    }

    await respuesta.text();
}
