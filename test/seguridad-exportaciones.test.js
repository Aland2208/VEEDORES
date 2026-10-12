import test from 'node:test';
import assert from 'node:assert/strict';
import { esUrlImagenCloudinaryValida } from '../src/utilidades/imagen-cloudinary.js';
import { escaparValorCSV } from '../src/utilidades/seguridad-exportaciones.js';

test('accepts Cloudinary image URLs and rejects untrusted destinations', () => {
    assert.equal(
        esUrlImagenCloudinaryValida(
            'https://res.cloudinary.com/demo/image/upload/v123/captura.jpg'
        ),
        true
    );
    assert.equal(esUrlImagenCloudinaryValida('http://res.cloudinary.com/demo/image/upload/a.jpg'), false);
    assert.equal(esUrlImagenCloudinaryValida('https://127.0.0.1/private'), false);
    assert.equal(esUrlImagenCloudinaryValida('https://res.cloudinary.com.attacker.test/demo/image/upload/a.jpg'), false);
    assert.equal(esUrlImagenCloudinaryValida('https://res.cloudinary.com@127.0.0.1/demo/image/upload/a.jpg'), false);
    assert.equal(esUrlImagenCloudinaryValida('https://res.cloudinary.com/demo/image/upload/a.jpg/../..'), false);
});

test('escapes spreadsheet formula prefixes in CSV fields', () => {
    assert.equal(escaparValorCSV('=1+1'), `"'=1+1"`);
    assert.equal(escaparValorCSV('  @SUM(A1:A2)'), `"'  @SUM(A1:A2)"`);
    assert.equal(escaparValorCSV('\t-2+3'), `"'\t-2+3"`);
    assert.equal(escaparValorCSV('O"Connor'), `"O""Connor"`);
    assert.equal(escaparValorCSV(null), '');
});
