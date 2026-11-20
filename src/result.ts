/**
 * Codes für erwartbare Dienst- und Datenfehler.
 *
 * Neue Codes können in Minor-Versionen hinzukommen; Auswertungen brauchen deshalb einen Default-Zweig.
 */
export type ErrorCode =
    | 'CONFIG_UNAVAILABLE'
    | 'SERVICE_UNAVAILABLE'
    | 'SERVICE_ERROR'
    | 'NOT_FOUND'
    | 'PROJECTION_MISMATCH'
    | 'INVALID_DATA'
    | 'ABORTED';

/**
 * Beschreibung eines erwartbaren Fehlers. `message` ist für Menschen gedacht, `cause` nur für die Diagnose.
 */
export interface GeolineError {
    code: ErrorCode;
    message: string;
    cause?: unknown;
}

/**
 * Ergebnis einer Methode mit erwartbaren Fehlern. Auswertbar ohne Typwissen über das Feld `ok`.
 */
export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; error: GeolineError };

/**
 * Erzeugt ein erfolgreiches Ergebnis.
 *
 * @param value Wert des Ergebnisses
 * @returns Ergebnis mit `ok: true`
 */
export function ok<T>(value: T): Result<T> {
    return {ok: true, value};
}

/**
 * Erzeugt ein fehlgeschlagenes Ergebnis.
 *
 * @param code Fehlercode
 * @param message Beschreibung für Menschen
 * @param cause Ursprünglicher Fehler zur Diagnose
 * @returns Ergebnis mit `ok: false`
 */
export function fail<T = never>(code: ErrorCode, message: string, cause?: unknown): Result<T> {
    const error: GeolineError = {code, message};
    if (cause !== undefined) {
        error.cause = cause;
    }
    return {ok: false, error};
}
