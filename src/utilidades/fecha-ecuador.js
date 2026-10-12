const DESFASE_ECUADOR_MS = 5 * 60 * 60 * 1000;

export function fechaMysqlEcuador(fecha) {
    return new Date(fecha.getTime() - DESFASE_ECUADOR_MS)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
}
