import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const jwtSecretOriginal = process.env.JWT_SECRET;
process.env.JWT_SECRET ||= 'test-jwt-secret';

const [
    { conmysql },
    { registrarUsuario, verificarCorreo, loginUsuario },
    { crearObservador }
] = await Promise.all([
    import('../src/db.js'),
    import('../src/controladores/authC.js'),
    import('../src/controladores/usuariosC.js')
]);

test('creates the account only after the email verification request succeeds', async t => {
    const previousApiKey = process.env.API_BREVO;
    const previousFrontendUrl = process.env.FRONTEND_URL;
    const previousFetch = globalThis.fetch;
    let emailBody;
    let pendingRequest;
    let createdUser;
    let userInsertions = 0;
    const statements = [];

    process.env.API_BREVO = 'test-api-key';
    process.env.FRONTEND_URL = 'https://example.com';
    process.env.JWT_SECRET = 'test-jwt-secret';
    globalThis.fetch = async (_url, options) => {
        emailBody = JSON.parse(options.body);
        return { ok: true, text: async () => '' };
    };

    const connection = {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        query: async (sql, params = []) => {
            statements.push(sql);

            if (sql.includes('INSERT INTO solicitudes_registro')) {
                assert.match(sql, /fecha_creacion[\s\S]*DATE_SUB\(UTC_TIMESTAMP\(\), INTERVAL 5 HOUR\)/);
                pendingRequest = {
                    id_solicitud: 1,
                    nombre: params[0],
                    apellido: params[1],
                    correo: params[2],
                    password_hash: params[3],
                    id_rol: params[4],
                    id_administrador: null,
                    token_hash: params[5],
                    expira: params[6]
                };
                return [{ affectedRows: 1, insertId: 1 }, []];
            }

            if (sql.includes('WHERE token_hash = ?')) {
                assert.match(sql, /expira > DATE_SUB\(UTC_TIMESTAMP\(\), INTERVAL 5 HOUR\)/);
                return [[pendingRequest], []];
            }

            if (sql.includes('INSERT INTO usuarios')) {
                userInsertions += 1;
                createdUser = {
                    id_usuario: 42,
                    nombre: params[0],
                    apellido: params[1],
                    correo: params[2],
                    password_hash: params[3],
                    id_rol: params[4],
                    estado: 1,
                    token_verificacion_correo: null
                };
                return [{ affectedRows: 1, insertId: 42 }, []];
            }

            if (sql.includes('FROM usuarios')) {
                return [[], []];
            }

            return [{ affectedRows: 1 }, []];
        }
    };
    t.mock.method(conmysql, 'getConnection', async () => connection);

    const createResponse = () => ({
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    });

    try {
        const registrationResponse = createResponse();
        await registrarUsuario({
            body: {
                nombre: 'Maria',
                apellido: 'Vargas',
                correo: 'maria.vargas@example.com',
                password: 'StrongPass1!',
                id_rol: 2
            }
        }, registrationResponse);

        assert.equal(registrationResponse.statusCode, 201);
        assert.equal(userInsertions, 0);
        assert.ok(pendingRequest);
        assert.notEqual(pendingRequest.password_hash, 'StrongPass1!');

        const token = emailBody.htmlContent.match(
            /verificar-correo\?token=([a-f0-9]{64})/
        )?.[1];
        assert.ok(token);
        assert.notEqual(pendingRequest.token_hash, token);
        assert.equal(
            pendingRequest.token_hash,
            crypto.createHash('sha256').update(token).digest('hex')
        );

        const verificationResponse = createResponse();
        await verificarCorreo({ body: { token } }, verificationResponse);

        assert.equal(verificationResponse.statusCode, 200);
        assert.equal(userInsertions, 1);
        assert.equal(
            statements.filter(sql => sql.includes('INSERT INTO usuarios')).length,
            1
        );

        t.mock.method(conmysql, 'query', async () => [[createdUser], []]);
        const loginResponse = createResponse();
        await loginUsuario({
            body: {
                correo: 'maria.vargas@example.com',
                password: 'StrongPass1!'
            }
        }, loginResponse);

        assert.equal(loginResponse.statusCode, 200);
        assert.ok(loginResponse.body.token);
        assert.equal(loginResponse.body.data.id_usuario, 42);
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
        if (jwtSecretOriginal === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = jwtSecretOriginal;
        }
    }
});

test('continues to verify legacy pending accounts using their stored token hash', async t => {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    let legacyLookupHash;
    const connection = {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        query: async (sql, params = []) => {
            if (sql.includes('WHERE token_hash = ?')) return [[], []];
            if (sql.includes('token_verificacion_correo = ?')) {
                assert.match(sql, /verificacion_correo_expira > DATE_SUB\(UTC_TIMESTAMP\(\), INTERVAL 5 HOUR\)/);
                legacyLookupHash = params[0];
                return [[{ id_usuario: 77 }], []];
            }
            if (sql.includes('UPDATE usuarios')) {
                return [{ affectedRows: 1 }, []];
            }
            return [[], []];
        }
    };
    t.mock.method(conmysql, 'getConnection', async () => connection);

    const response = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };

    await verificarCorreo({ body: { token } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(legacyLookupHash, tokenHash);
});

test('creates an administrator-requested observer only after confirmation and links the account', async t => {
    const previousApiKey = process.env.API_BREVO;
    const previousFrontendUrl = process.env.FRONTEND_URL;
    const previousFetch = globalThis.fetch;
    let emailBody;
    let pendingRequest;
    let userInsertions = 0;
    let assignment;

    process.env.API_BREVO = 'test-api-key';
    process.env.FRONTEND_URL = 'https://example.com';
    globalThis.fetch = async (_url, options) => {
        emailBody = JSON.parse(options.body);
        return { ok: true, text: async () => '' };
    };

    const connection = {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        query: async (sql, params = []) => {
            if (sql.includes('WHERE id_usuario=? AND id_rol=1')) {
                return [[{ id_usuario: 10 }], []];
            }
            if (sql.includes('LOWER(correo)')) return [[], []];
            if (sql.includes('SELECT id_solicitud')) return [[], []];
            if (sql.includes('INSERT INTO solicitudes_registro')) {
                assert.match(sql, /fecha_creacion[\s\S]*DATE_SUB\(UTC_TIMESTAMP\(\), INTERVAL 5 HOUR\)/);
                pendingRequest = {
                    id_solicitud: 2,
                    nombre: params[0],
                    apellido: params[1],
                    correo: params[2],
                    password_hash: params[3],
                    id_rol: 2,
                    id_administrador: params[4],
                    token_hash: params[5]
                };
                return [{ affectedRows: 1, insertId: 2 }, []];
            }
            if (sql.includes('WHERE token_hash = ?')) {
                assert.match(sql, /expira > DATE_SUB\(UTC_TIMESTAMP\(\), INTERVAL 5 HOUR\)/);
                return [[pendingRequest], []];
            }
            if (sql.includes('WHERE correo = ?')) return [[], []];
            if (sql.includes('WHERE id_usuario = ?') && sql.includes('id_rol = 1')) {
                return [[{ id_usuario: 10 }], []];
            }
            if (sql.includes('INSERT INTO usuarios')) {
                userInsertions += 1;
                return [{ affectedRows: 1, insertId: 42 }, []];
            }
            if (sql.includes('INSERT INTO administrador')) {
                assignment = params;
                return [{ affectedRows: 1, insertId: 1 }, []];
            }
            return [{ affectedRows: 1 }, []];
        }
    };
    t.mock.method(conmysql, 'getConnection', async () => connection);

    const response = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };

    try {
        await crearObservador({
            usuario: { id_usuario: 10 },
            body: {
                nombre: 'Maria',
                apellido: 'Vargas',
                correo: 'maria.observadora@example.com',
                password: 'StrongPass1!'
            }
        }, response);

        assert.equal(response.statusCode, 201);
        assert.equal(userInsertions, 0);
        assert.equal(pendingRequest.id_administrador, 10);

        const token = emailBody.htmlContent.match(
            /verificar-correo\?token=([a-f0-9]{64})/
        )?.[1];
        assert.ok(token);

        const verificationResponse = {
            ...response,
            statusCode: 200,
            body: null
        };
        await verificarCorreo({ body: { token } }, verificationResponse);

        assert.equal(verificationResponse.statusCode, 200);
        assert.equal(userInsertions, 1);
        assert.deepEqual(assignment, [10, 42]);
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
