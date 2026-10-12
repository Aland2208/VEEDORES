export function escaparValorCSV(valor) {
    if (valor === null || valor === undefined) return '';

    let texto = String(valor);
    if (/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/u.test(texto)) {
        texto = `'${texto}`;
    }

    return `"${texto.replace(/"/g, '""')}"`;
}
