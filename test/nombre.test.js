import test from 'node:test';
import assert from 'node:assert/strict';
import { esNombreValido } from '../src/utilidades/nombre.js';

test('accepts plausible names with accents, spaces, hyphens, and apostrophes', () => {
    assert.equal(esNombreValido('María José'), true);
    assert.equal(esNombreValido('De la Cruz'), true);
    assert.equal(esNombreValido("O'Connor"), true);
    assert.equal(esNombreValido('Ana-María'), true);
});

test('rejects repeated alternating text and malformed name input', () => {
    assert.equal(esNombreValido('ADADA'), false);
    assert.equal(esNombreValido('qwrty'), false);
    assert.equal(esNombreValido('Ana123'), false);
    assert.equal(esNombreValido('Admin'), false);
    assert.equal(esNombreValido(''), false);
});

test("does not claim to verify a person's identity from their name", () => {
    assert.equal(esNombreValido('Asad'), true);
});
