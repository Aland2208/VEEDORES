import dns from 'node:dns/promises';

export const PASSWORD_MAX_BYTES = 72;
const MAX_CORREO = 150;
const CACHE_MS = 12 * 60 * 60 * 1000;
const FUENTES = [
    'https://disposable.github.io/disposable-email-domains/domains_mx.txt',
    'https://raw.githubusercontent.com/castle/disposable-email-domains/master/disposable-email-domains.txt'
];
const CONFIABLES = new Set([
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
    'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com', 'mac.com', 'proton.me',
    'protonmail.com', 'aol.com', 'zoho.com', 'zohomail.com', 'mail.com',
    'gmx.com', 'gmx.net', 'fastmail.com'
]);
const PROTEGIDOS = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com'];
const RESPALDO = new Set([
    '10minutemail.com', '10minutemail.net', '10minutemail.org', 'mailinator.com',
    'mailinator.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
    'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.net',
    'guerrillamail.org', 'sharklasers.com', 'grr.la', 'dispostable.com',
    'maildrop.cc', 'temp-mail.org', 'tempmail.com', 'tempmail.net',
    'throwawaymail.com', 'trashmail.com', 'trashmail.net', 'getnada.com',
    'fakeinbox.com', 'emailondeck.com', 'mohmal.com', 'mintemail.com', 'mytemp.email'
]);
let cache = new Set(RESPALDO);
let ultimaActualizacion = 0;
let descargaPendiente = null;

const dominiosEnv = (nombre) => String(process.env[nombre] || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
const allowlist = () => new Set(dominiosEnv('EMAIL_ALLOWLIST'));
const dominiosProtegidos = () => [...new Set([...PROTEGIDOS, ...dominiosEnv('EMAIL_PROTECTED_DOMAINS')])];

export function esCorreoValido(correo) {
    if (typeof correo !== 'string') return false;
    const valor = correo.trim().toLowerCase();
    if (!valor || valor.length > MAX_CORREO || /\s/u.test(valor)) return false;
    const formato = /^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
    if (!formato.test(valor)) return false;
    const [usuario, dominio] = valor.split('@');
    if (!usuario || !dominio || usuario.length > 64 || dominio.length > 253) return false;
    if (dominio.split('.').some(etiqueta => etiqueta.startsWith('xn--'))) return false;
    return true;
}

async function descargarFuente(url) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 7000);
    try {
        const respuesta = await fetch(url, { signal: controlador.signal, headers: { Accept: 'text/plain' } });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const texto = await respuesta.text();
        return texto.split(/\r?\n/).map(d => d.trim().toLowerCase()).filter(d => d && !d.startsWith('#') && d.length <= 253 && /^[a-z0-9.-]+$/i.test(d));
    } finally {
        clearTimeout(temporizador);
    }
}

async function actualizarTemporales() {
    if (ultimaActualizacion && Date.now() - ultimaActualizacion < CACHE_MS) return cache;
    if (descargaPendiente) return descargaPendiente;
    descargaPendiente = (async () => {
        const resultados = await Promise.allSettled(FUENTES.map(descargarFuente));
        const nuevaLista = new Set(cache);
        let disponible = false;
        for (const resultado of resultados) {
            if (resultado.status !== 'fulfilled') continue;
            disponible = true;
            for (const dominio of resultado.value) nuevaLista.add(dominio);
        }
        if (disponible) {
            for (const dominio of CONFIABLES) nuevaLista.delete(dominio);
            cache = nuevaLista;
            ultimaActualizacion = Date.now();
            console.log(`[Correo] Lista actualizada: ${cache.size} dominios temporales.`);
        } else {
            console.warn('[Correo] No se pudieron actualizar las listas. Se utilizará la caché.');
        }
        return cache;
    })();
    try {
        return await descargaPendiente;
    } finally {
        descargaPendiente = null;
    }
}

async function esDominioTemporal(dominio) {
    if (CONFIABLES.has(dominio) || allowlist().has(dominio)) return false;
    const lista = await actualizarTemporales();
    const partes = dominio.split('.');
    for (let i = 0; i < partes.length - 1; i++) {
        if (lista.has(partes.slice(i).join('.'))) return true;
    }
    return false;
}

function distanciaDamerau(a, b) {
    const matriz = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matriz[i][0] = i;
    for (let j = 0; j <= b.length; j++) matriz[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const costo = a[i - 1] === b[j - 1] ? 0 : 1;
            matriz[i][j] = Math.min(matriz[i - 1][j] + 1, matriz[i][j - 1] + 1, matriz[i - 1][j - 1] + costo);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                matriz[i][j] = Math.min(matriz[i][j], matriz[i - 2][j - 2] + 1);
            }
        }
    }
    return matriz[a.length][b.length];
}

function dominioSospechoso(dominio) {
    if (CONFIABLES.has(dominio) || allowlist().has(dominio)) return false;
    for (const oficial of dominiosProtegidos()) {
        if (dominio === oficial) return false;
        if (dominio.startsWith(`${oficial}.`) || dominio.includes(`.${oficial}.`)) return true;
        const marcaOficial = oficial.split('.')[0];
        const marcaCandidata = dominio.split('.')[0];
        if (marcaOficial.length < 5 || marcaCandidata.length < 5) continue;
        if (distanciaDamerau(marcaCandidata, marcaOficial) === 1) return true;
    }
    return false;
}

async function dominioTieneMX(dominio) {
    try {
        const registros = await dns.resolveMx(dominio);
        return registros.some(r => r.exchange && r.exchange.trim() !== '.');
    } catch {
        return false;
    }
}

export async function validarCorreoSeguro(correo) {
    const valor = String(correo || '').trim().toLowerCase();
    const error = (codigo, mensaje) => ({ valido: false, codigo, mensaje });
    if (!esCorreoValido(valor)) return error('FORMATO_INVALIDO', 'El correo electrónico no tiene un formato válido.');
    const dominio = valor.split('@')[1];
    if (dominioSospechoso(dominio)) return error('DOMINIO_SOSPECHOSO', 'El dominio del correo parece imitar a un proveedor o institución legítima.');
    if (await esDominioTemporal(dominio)) return error('CORREO_TEMPORAL', 'No se permiten correos electrónicos temporales o desechables.');
    if (!(await dominioTieneMX(dominio))) return error('DOMINIO_SIN_CORREO', 'El dominio indicado no está configurado para recibir correo electrónico.');
    return { valido: true, codigo: 'CORREO_VALIDO', mensaje: 'Correo electrónico válido.' };
}

export function passwordValida(password) {
    if (typeof password !== 'string') return false;
    return Buffer.byteLength(password, 'utf8') <= PASSWORD_MAX_BYTES &&
        password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) &&
        /[0-9]/.test(password) && /[^A-Za-z0-9\s]/.test(password);
}