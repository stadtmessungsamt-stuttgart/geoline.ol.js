// Prüfungen für Eingaben an der öffentlichen API. Verstöße sind Programmierfehler und werfen sofort (ADR 5).

const MIGRATION_HINT = 'siehe MIGRATION_3-4.md';

function describe(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'Array';
    return typeof value;
}

/**
 * Weist Funktionen ab der früheren Callback-Position zurück. In 4.0 liefern die Methoden ihr Ergebnis als Rückgabewert.
 *
 * @param args Argumente des Aufrufs (`arguments`)
 * @param from Index der früheren Callback-Position
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn ab `from` eine Funktion übergeben wurde
 */
export function assertNoCallback(args: ArrayLike<unknown>, from: number, method: string): void {
    for (let i = from; i < args.length; i++) {
        if (typeof args[i] === 'function') {
            throw new TypeError(
                `${method}: Callback-Parameter entfallen in geoline.ol.js 4.0. ` +
                `Das Ergebnis ist der Rückgabewert der Methode (${MIGRATION_HINT}).`
            );
        }
    }
}

/**
 * Prüft auf einen nicht leeren String.
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn `value` kein nicht leerer String ist
 */
export function assertString(value: unknown, name: string, method: string): asserts value is string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new TypeError(`${method}: ${name} muss ein nicht leerer String sein, erhalten: ${describe(value)}.`);
    }
}

/**
 * Prüft auf eine ganze Zahl.
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn `value` keine ganze Zahl ist
 */
export function assertInteger(value: unknown, name: string, method: string): asserts value is number {
    if (!Number.isInteger(value)) {
        throw new TypeError(`${method}: ${name} muss eine ganze Zahl sein, erhalten: ${describe(value)}.`);
    }
}

/**
 * Prüft auf einen Wahrheitswert.
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn `value` kein Boolean ist
 */
export function assertBoolean(value: unknown, name: string, method: string): asserts value is boolean {
    if (typeof value !== 'boolean') {
        throw new TypeError(`${method}: ${name} muss true oder false sein, erhalten: ${describe(value)}.`);
    }
}

/**
 * Prüft auf eine Funktion.
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn `value` keine Funktion ist
 */
export function assertFunction(value: unknown, name: string, method: string): asserts value is (...args: never[]) => unknown {
    if (typeof value !== 'function') {
        throw new TypeError(`${method}: ${name} muss eine Funktion sein, erhalten: ${describe(value)}.`);
    }
}

/**
 * Prüft auf ein optionales Parameterobjekt. `undefined` und `null` gelten als nicht angegeben.
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn `value` angegeben, aber kein Objekt ist
 */
export function assertOptionalObject(value: unknown, name: string, method: string): asserts value is Record<string, unknown> | null | undefined {
    if (value != null && (typeof value !== 'object' || Array.isArray(value))) {
        throw new TypeError(`${method}: ${name} muss ein Objekt sein, erhalten: ${describe(value)}.`);
    }
}

/**
 * Prüft auf eine absolute URL und liefert sie geparst zurück.
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @returns Die geparste URL
 * @throws {TypeError} wenn `value` keine absolute URL ist
 */
export function assertUrl(value: unknown, name: string, method: string): URL {
    assertString(value, name, method);
    try {
        return new URL(value);
    } catch {
        throw new TypeError(`${method}: ${name} muss eine absolute URL sein, erhalten: ${value}.`);
    }
}

/**
 * Prüft auf eine Liste von Koordinatenpaaren `[[x, y], …]` mit endlichen Zahlen.
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn `value` keine solche Liste ist
 */
export function assertCoordinateList(value: unknown, name: string, method: string): asserts value is Array<[number, number]> {
    const valid = Array.isArray(value) && value.every((pair) =>
        Array.isArray(pair) && pair.length === 2 && pair.every((n) => Number.isFinite(n)));
    if (!valid) {
        throw new TypeError(`${method}: ${name} muss eine Liste von Koordinatenpaaren [[x, y], …] sein.`);
    }
}

/**
 * Prüft auf ein Objekt (kein Array, nicht `null`).
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn `value` kein Objekt ist
 */
export function assertObject(value: unknown, name: string, method: string): asserts value is Record<string, unknown> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${method}: ${name} muss ein Objekt sein, erhalten: ${describe(value)}.`);
    }
}

/**
 * Prüft auf einen optionalen OpenLayers-Style: Style-Objekt, Array von Styles oder Style-Funktion.
 *
 * @param value Zu prüfender Wert
 * @param name Name des Parameters für die Fehlermeldung
 * @param method Name der aufgerufenen Methode für die Fehlermeldung
 * @throws {TypeError} wenn `value` angegeben, aber weder Objekt, Array noch Funktion ist
 */
export function assertOptionalStyle(value: unknown, name: string, method: string): void {
    if (value != null && typeof value !== 'object' && typeof value !== 'function') {
        throw new TypeError(`${method}: ${name} muss ein Style, ein Array von Styles oder eine Style-Funktion sein, erhalten: ${describe(value)}.`);
    }
}
