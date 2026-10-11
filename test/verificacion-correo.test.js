import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
    crearTokenVerificacionCorreo,
    enviarCorreoVerificacion,
    servicioVerificacionCorreoConfigurado
} from '../src/utilidades/verificacion-correo.js';

test('creates a random verification token with a hashed storage value and 15-minute expiry', () => {
    const before = Date.now();
    const first = crearTokenVerificacionCorreo();
    const second = crearTokenVerificacionCorreo();

    assert.match(first.token, /^[a-f0-9]{64}$/);
    assert.notEqual(first.token, second.token);
    assert.equal(
        first.tokenHash,
        crypto.createHash('sha256').update(first.token).digest('hex')
    );
    assert.equal(first.expira.getTime() >= before + 15 * 60 * 1000, true);
});

test('requires both email and frontend configuration', () => {
    const previousApiKey = process.env.API_BREVO;
    const previousFrontendUrl = process.env.FRONTEND_URL;

    delete process.env.API_BREVO;
    process.env.FRONTEND_URL = 'https://example.com';
    assert.equal(servicioVerificacionCorreoConfigurado(), false);

    process.env.API_BREVO = 'test-api-key';
    assert.equal(servicioVerificacionCorreoConfigurado(), true);

    if (previousApiKey === undefined) {
        delete process.env.API_BREVO;
    } else {
        process.env.API_BREVO = previousApiKey;
    }
    if (previousFrontendUrl === undefined) {
        delete process.env.FRONTEND_URL;
    } else {
        process.env.FRONTEND_URL = previousFrontendUrl;
    }
});

test('sends the verification link to the requested email address', async () => {
    const previousApiKey = process.env.API_BREVO;
    const previousFrontendUrl = process.env.FRONTEND_URL;
    const previousFetch = globalThis.fetch;
    let requestBody;

    process.env.API_BREVO = 'test-api-key';
    process.env.FRONTEND_URL = 'https://example.com/';
    globalThis.fetch = async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return { ok: true, text: async () => '' };
    };

    try {
        await enviarCorreoVerificacion('observador@example.com', 'verification-token');

        assert.equal(requestBody.to[0].email, 'observador@example.com');
        assert.match(
            requestBody.htmlContent,
            /https:\/\/example\.com\/verificar-correo\?token=verification-token/
        );
        assert.match(requestBody.htmlContent, /vence en 15 minutos/);
    } finally {
        globalThis.fetch = previousFetch;
        if (previousApiKey === undefined) {
            delete process.env.API_BREVO;
        } else {
            process.env.API_BREVO = previousApiKey;
        }
        if (previousFrontendUrl === undefined) {
            delete process.env.FRONTEND_URL;
        } else {
            process.env.FRONTEND_URL = previousFrontendUrl;
        }
    }
});

test('does not treat a rejected email-provider response as a successful send', async () => {
    const previousApiKey = process.env.API_BREVO;
    const previousFrontendUrl = process.env.FRONTEND_URL;
    const previousFetch = globalThis.fetch;

    process.env.API_BREVO = 'test-api-key';
    process.env.FRONTEND_URL = 'https://example.com';
    globalThis.fetch = async () => ({ ok: false });

    try {
        await assert.rejects(
            enviarCorreoVerificacion('observador@example.com', 'verification-token'),
            /proveedor de correo rechazó/
        );
    } finally {
        globalThis.fetch = previousFetch;
        if (previousApiKey === undefined) {
            delete process.env.API_BREVO;
        } else {
            process.env.API_BREVO = previousApiKey;
        }
        if (previousFrontendUrl === undefined) {
            delete process.env.FRONTEND_URL;
        } else {
            process.env.FRONTEND_URL = previousFrontendUrl;
        }
    }
});
