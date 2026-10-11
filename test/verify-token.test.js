import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../src/config.js';
import {
    requireAdmin,
    requireOwnAdminId,
    requireOwnVeedorId,
    requireOwnUserId,
    requireDeviceKey,
    verifyToken
} from '../src/middlewares/verifyToken.js';

function createResponse() {
    return {
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
}

test('rejects missing bearer tokens', () => {
    const response = createResponse();
    verifyToken({ headers: {} }, response, () => {
        assert.fail('next must not run without a token');
    });

    assert.equal(response.statusCode, 401);
});

test('verifies a bearer token and restricts user management to its owner admin', () => {
    const token = jwt.sign({ id_usuario: 12, id_rol: 1 }, JWT_SECRET);
    const request = {
        headers: { authorization: `Bearer ${token}` },
        params: { id_administrador: '12' }
    };
    const response = createResponse();
    let authenticated = false;

    verifyToken(request, response, () => {
        authenticated = true;
    });
    assert.equal(authenticated, true);

    let authorized = false;
    requireAdmin(request, response, () => {
        authorized = true;
    });
    assert.equal(authorized, true);

    let ownsAdminId = false;
    requireOwnAdminId(request, response, () => {
        ownsAdminId = true;
    });
    assert.equal(ownsAdminId, true);

    request.params.id_administrador = '13';
    requireOwnAdminId(request, response, () => {
        assert.fail('an admin cannot query another admin');
    });
    assert.equal(response.statusCode, 403);
});

test('rejects a valid token belonging to a non-admin user', () => {
    const request = {
        usuario: { id_usuario: 21, id_rol: 2 }
    };
    const response = createResponse();
    requireAdmin(request, response, () => {
        assert.fail('non-admin users must not manage observers');
    });

    assert.equal(response.statusCode, 403);
});

test('restricts veedor dashboards to the authenticated user', () => {
    const request = {
        usuario: { id_usuario: 21, id_rol: 2 },
        params: { id_usuario: '21' }
    };
    const response = createResponse();
    let authorized = false;

    requireOwnVeedorId(request, response, () => {
        authorized = true;
    });
    assert.equal(authorized, true);

    request.params.id_usuario = '22';
    requireOwnVeedorId(request, response, () => {
        assert.fail('a user cannot query another user dashboard');
    });
    assert.equal(response.statusCode, 403);
});

test('requires a configured device key and rejects invalid keys', () => {
    const previousKey = process.env.DEVICE_API_KEY;
    process.env.DEVICE_API_KEY = 'test-device-key';
    const response = createResponse();

    requireDeviceKey({ get: () => 'wrong-key' }, response, () => {
        assert.fail('invalid device keys must be rejected');
    });
    assert.equal(response.statusCode, 401);

    const authorizedResponse = createResponse();
    let authorized = false;
    requireDeviceKey({ get: () => 'test-device-key' }, authorizedResponse, () => {
        authorized = true;
    });
    assert.equal(authorized, true);

    if (previousKey === undefined) {
        delete process.env.DEVICE_API_KEY;
    } else {
        process.env.DEVICE_API_KEY = previousKey;
    }
});
