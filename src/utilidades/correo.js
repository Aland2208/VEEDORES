export function esCorreoValido(correo) {
    const valor = String(correo || '').trim().toLowerCase();
    const formatoValido = /^(?!.*\.\.)[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

    if (valor.length > 150 || !formatoValido.test(valor)) return false;

    const [usuario, dominio] = valor.split('@');
    return usuario.length <= 64 && dominio.length <= 253;
}

export function passwordValida(password) {
    const valor = String(password || '');
    return Buffer.byteLength(valor, 'utf8') <= 72 &&
        valor.length >= 8 &&
        /[a-z]/.test(valor) &&
        /[A-Z]/.test(valor) &&
        /[0-9]/.test(valor) &&
        /[^A-Za-z0-9\s]/.test(valor);
}
