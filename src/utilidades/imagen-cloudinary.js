const TAMANO_MAXIMO_IMAGEN_BYTES = 8 * 1024 * 1024;

export function esUrlImagenCloudinaryValida(valor) {
    if (typeof valor !== 'string' || valor.length > 2048) return false;

    try {
        const url = new URL(valor);
        return url.protocol === 'https:' &&
            url.hostname === 'res.cloudinary.com' &&
            !url.username &&
            !url.password &&
            !url.port &&
            /^\/[a-zA-Z0-9_-]+\/image\/upload\/[a-zA-Z0-9_./,%+-]+$/u.test(url.pathname);
    } catch {
        return false;
    }
}

export async function descargarImagenCloudinary(valor) {
    if (!esUrlImagenCloudinaryValida(valor)) return null;

    const respuesta = await fetch(valor, {
        signal: AbortSignal.timeout(10000),
        redirect: 'error'
    });
    if (!respuesta.ok || !respuesta.headers.get('content-type')?.startsWith('image/')) {
        return null;
    }

    const longitud = Number(respuesta.headers.get('content-length'));
    if (Number.isFinite(longitud) && longitud > TAMANO_MAXIMO_IMAGEN_BYTES) {
        return null;
    }

    const imagen = Buffer.from(await respuesta.arrayBuffer());
    if (imagen.length > TAMANO_MAXIMO_IMAGEN_BYTES) return null;
    return imagen;
}
