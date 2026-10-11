import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { limitarSolicitudesRegistro } from '../src/middlewares/limitar-registro.js';

function ejecutarLimitador(ip, correo) {
    let siguiente = false;
    let status;
    let respuesta;
    const headers = {};
    const req = { ip, body: { correo } };
    const res = {
        set: (nombre, valor) => {
            headers[nombre] = valor;
            return res;
        },
        status: valor => {
            status = valor;
            return res;
        },
        json: valor => {
            respuesta = valor;
            return res;
        }
    };

    limitarSolicitudesRegistro(req, res, () => {
        siguiente = true;
    });

    return { siguiente, status, respuesta, headers };
}

test('limits registration attempts from a single IP to five per 15 minutes', () => {
    const ip = `test-ip-${crypto.randomUUID()}`;

    for (let intento = 0; intento < 5; intento += 1) {
        assert.equal(
            ejecutarLimitador(ip, `persona-${intento}@example.test`).siguiente,
            true
        );
    }

    const bloqueado = ejecutarLimitador(ip, 'persona-extra@example.test');
    assert.equal(bloqueado.siguiente, false);
    assert.equal(bloqueado.status, 429);
    assert.ok(Number(bloqueado.headers['Retry-After']) > 0);
});

test('limits requests for the same email to three per hour across IPs', () => {
    const correo = `persona-${crypto.randomUUID()}@example.test`;

    for (let intento = 0; intento < 3; intento += 1) {
        assert.equal(
            ejecutarLimitador(`test-email-ip-${intento}-${crypto.randomUUID()}`, correo).siguiente,
            true
        );
    }

    const bloqueado = ejecutarLimitador(`test-email-ip-final-${crypto.randomUUID()}`, correo);
    assert.equal(bloqueado.siguiente, false);
    assert.equal(bloqueado.status, 429);
});
