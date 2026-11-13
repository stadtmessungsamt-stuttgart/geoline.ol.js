import {fail, ok, type Result} from './result.js';

/** Projektion von GeoJSON ohne Angabe eines CRS (RFC 7946). */
export const DEFAULT_GEOJSON_PROJECTION = 'EPSG:4326';

// Verschachtelungstiefe der Koordinaten: 0 = Position [x, y, …]
const DEPTH: Record<string, number> = {
    Point: 0,
    MultiPoint: 1,
    LineString: 1,
    MultiLineString: 2,
    Polygon: 2,
    MultiPolygon: 3,
};

class InvalidGeoJSON extends Error {}

function invalid(path: string, expected: string): never {
    throw new InvalidGeoJSON(path + ' muss ' + expected + ' sein');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function coordinates(value: unknown, depth: number, path: string): void {
    if (!Array.isArray(value)) {
        invalid(path, 'ein Array');
    }
    if (depth === 0) {
        if (value.length < 2 || !value.every((n) => typeof n === 'number' && Number.isFinite(n))) {
            invalid(path, 'eine Position aus mindestens zwei endlichen Zahlen');
        }
        return;
    }
    value.forEach((item, i) => coordinates(item, depth - 1, path + '[' + i + ']'));
}

function geometry(value: unknown, path: string): void {
    if (!isRecord(value)) {
        invalid(path, 'eine Geometrie');
    }
    if (value.type === 'GeometryCollection') {
        if (!Array.isArray(value.geometries)) {
            invalid(path + '.geometries', 'ein Array');
        }
        value.geometries.forEach((item, i) => geometry(item, path + '.geometries[' + i + ']'));
        return;
    }
    const depth = typeof value.type === 'string' ? DEPTH[value.type] : undefined;
    if (depth === undefined) {
        invalid(path + '.type', 'ein Geometrietyp');
    }
    coordinates(value.coordinates, depth, path + '.coordinates');
}

function feature(value: unknown, path: string): void {
    if (!isRecord(value) || value.type !== 'Feature') {
        invalid(path, 'ein Feature');
    }
    if (value.geometry != null) {
        geometry(value.geometry, path + '.geometry');
    }
    if (value.properties != null && !isRecord(value.properties)) {
        invalid(path + '.properties', 'ein Objekt oder null');
    }
}

function projection(crs: unknown): string {
    if (crs == null) {
        return DEFAULT_GEOJSON_PROJECTION;
    }
    if (!isRecord(crs) || crs.type !== 'name' || !isRecord(crs.properties) || typeof crs.properties.name !== 'string') {
        invalid('crs', 'null oder ein benanntes CRS {type: "name", properties: {name}}');
    }
    // CRS84 hat die Achsfolge Länge/Breite wie EPSG:4326 in GeoJSON
    return crs.properties.name === 'urn:ogc:def:crs:OGC:1.3:CRS84' ? DEFAULT_GEOJSON_PROJECTION : crs.properties.name;
}

/**
 * Prüft Struktur und Koordinaten eines GeoJSON-Objekts und ermittelt seine Projektion. Ein fehlendes oder `null`-CRS
 * bedeutet EPSG:4326.
 *
 * @param value GeoJSON-Objekt: FeatureCollection, Feature oder Geometrie
 * @returns Name der Projektion der Daten oder `INVALID_DATA` mit der ersten ungültigen Stelle in der Meldung
 */
export function parseGeoJSON(value: unknown): Result<string> {
    try {
        if (!isRecord(value)) {
            invalid('GeoJSON', 'ein Objekt');
        }
        if (value.type === 'FeatureCollection') {
            if (!Array.isArray(value.features)) {
                invalid('features', 'ein Array');
            }
            value.features.forEach((item, i) => feature(item, 'features[' + i + ']'));
        } else if (value.type === 'Feature') {
            feature(value, 'GeoJSON');
        } else {
            geometry(value, 'GeoJSON');
        }
        return ok(projection(value.crs));
    } catch (err) {
        if (err instanceof InvalidGeoJSON) {
            return fail('INVALID_DATA', 'Ungültiges GeoJSON: ' + err.message + '.');
        }
        throw err;
    }
}
