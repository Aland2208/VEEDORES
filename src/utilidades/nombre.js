const palabrasProhibidas = new Set([
    'mama', 'tanga', 'papa', 'culo', 'puta', 'puto', 'mierda', 'verga', 'pito',
    'pendejo', 'pendeja', 'idiota', 'maricon', 'perra', 'perro', 'chucha', 'hdp',
    'admin', 'administrador', 'root', 'test', 'prueba', 'usuario', 'null', 'undefined',
    'anonimo', 'nobody', 'fake', 'bot', 'observador', 'veedor', 'tonto', 'bobo', 'loco',
    'waos', 'asdf', 'asdfg', 'qwerty', 'qwert', 'zxcv', 'zxcvb', 'lorem', 'ipsum',
    'foobar', 'username', 'nombrefalso',
    'nombrefake', 'usuariotest', 'cuentatest', 'pruebatest', 'demouser', 'guest',
    'anonymous', 'unknown', 'fakeuser', 'testuser', 'example', 'xxxx',
    'xxxxx', 'abcde', 'abcdef', 'abcdefg', 'qazwsx', 'poiuyt', 'mnbvcx',
    'asdfasdf', 'qwertyuiop', '123abc', 'abc123', 'soybot', 'robot', 'spam',
    'basura', 'basurero', 'mierdero', 'pajero', 'caca', 'pipi', 'falso', 'falsa',
    'inventado', 'inventada', 'sin nombre', 'noexiste', 'noexisto', 'ninguno',
    'ninguna', 'desconocido', 'desconocida', 'placeholder', 'changeme', 'deleted',
    'eliminado', 'eliminada', 'invitado', 'invitada', 'visitante', 'pruebauno',
    'pruebados', 'pruebatres', 'usuariouno', 'usuariodos', 'testtest', 'botbot'
]);

const frasesProhibidas = new Set(['sin nombre']);
const nombresBrevesReconocidos = new Set(['ng']);
const letrasNombre = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const posicionesTeclado = new Map([
    ...'qwertyuiop'.split('').map((letra, indice) => [letra, [0, indice]]),
    ...'asdfghjkl'.split('').map((letra, indice) => [letra, [1, indice + 0.5]]),
    ...'zxcvbnm'.split('').map((letra, indice) => [letra, [2, indice + 1]])
]);

function pareceRecorridoDeTeclado(texto) {
    for (let inicio = 0; inicio <= texto.length - 5; inicio++) {
        let recorridoContinuo = true;

        for (let indice = inicio + 1; indice < inicio + 5; indice++) {
            const anterior = posicionesTeclado.get(texto[indice - 1]);
            const actual = posicionesTeclado.get(texto[indice]);

            if (!anterior || !actual) {
                recorridoContinuo = false;
                break;
            }

            const filas = Math.abs(anterior[0] - actual[0]);
            const columnas = Math.abs(anterior[1] - actual[1]);
            if (filas > 1 || columnas > 1.5 || (filas === 0 && columnas > 1)) {
                recorridoContinuo = false;
                break;
            }
        }

        if (recorridoContinuo) return true;
    }

    return false;
}

export function esNombreValido(texto) {
    const limpio = String(texto || '').trim().replace(/\s+/g, ' ');

    if (limpio.length < 2 || limpio.length > 30 || !letrasNombre.test(limpio)) {
        return false;
    }

    const fraseNormalizada = limpio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (frasesProhibidas.has(fraseNormalizada)) {
        return false;
    }

    const palabras = limpio.split(/[ -]/);
    if (palabras.length > 3) {
        return false;
    }

    for (const palabra of palabras) {
        if (palabra.length < 2 || palabra.length > 14) {
            return false;
        }

        const normalizada = palabra
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const vocales = normalizada.match(/[aeiouyæøåœ]/g) || [];

        if (palabrasProhibidas.has(normalizada)) {
            return false;
        }

        if (nombresBrevesReconocidos.has(normalizada)) {
            continue;
        }

        if (/^[a-z]+$/.test(normalizada) && pareceRecorridoDeTeclado(normalizada)) {
            return false;
        }

        if (/[^\p{Script=Latin}\p{M}]/u.test(normalizada)) {
            continue;
        }

        if (
            /([a-z])\1\1/i.test(normalizada) ||
            vocales.length === 0 ||
            /[bcdfghjklmnpqrstvwxyz]{3,}/i.test(normalizada) ||
            /[aeiou]{3,}/i.test(normalizada) ||
            /^(.)(.)\1\2(?:\1)?$/i.test(normalizada) ||
            /(.)\1{2,}/i.test(normalizada) ||
            /(.{2,})\1{2,}/i.test(normalizada)
        ) {
            return false;
        }

        if (
            normalizada.length >= 6 &&
            (vocales.length / normalizada.length < 0.25 ||
                vocales.length / normalizada.length > 0.7)
        ) {
            return false;
        }
    }

    return true;
}
