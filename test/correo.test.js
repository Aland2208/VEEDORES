import test from 'node:test';
import assert from 'node:assert/strict';
import { esCorreoValido, passwordValida } from '../src/utilidades/correo.js';

test('accepts valid addresses on public and custom domains', () => {
    assert.equal(esCorreoValido('persona.apellido+registro@gmail.com'), true);
    assert.equal(esCorreoValido('persona@upse.edu.ec'), true);
    assert.equal(esCorreoValido(' Persona@Outlook.com '), true);
    assert.equal(esCorreoValido('persona@empresa.example'), true);
});

test('rejects malformed and overlong addresses', () => {
    assert.equal(esCorreoValido('.persona@gmail.com'), false);
    assert.equal(esCorreoValido('persona..apellido@gmail.com'), false);
    assert.equal(esCorreoValido('persona@-gmail.com'), false);
    assert.equal(esCorreoValido('persona@gmail-.com'), false);
    assert.equal(esCorreoValido('persona@localhost'), false);
    assert.equal(esCorreoValido('persona@-empresa.example'), false);
    assert.equal(esCorreoValido(`persona${'a'.repeat(145)}@gmail.com`), false);
});

test('enforces the password policy and bcrypt byte limit', () => {
    assert.equal(passwordValida('ClaveSegura1!'), true);
    assert.equal(passwordValida('cort1!'), false);
    assert.equal(passwordValida('ClaveSegura1!' + 'a'.repeat(60)), false);
    assert.equal(passwordValida('ClaveSegura1!' + 'ñ'.repeat(30)), false);
});
