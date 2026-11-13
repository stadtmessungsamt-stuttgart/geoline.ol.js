import {fail, ok, type Result} from './result.js';

/** ArcGIS-Dienst des Stadtmessungsamtes. */
export interface AGSServiceEntry {
    ags_host: string;
    ags_instance: string;
    ags_service: string;
}

/** WMTS-Dienst des Stadtmessungsamtes. */
export interface WMTSServiceEntry {
    host: string;
    instance: string;
    service: string;
    matrix: string;
}

/** WMS-Dienst des Stadtmessungsamtes. */
export interface WMSServiceEntry {
    host: string;
    instance: string;
    service: string;
    tiled: boolean;
}

/**
 * Konfiguration der Kartendienste des Stadtmessungsamtes, wie sie der Konfigurationsdienst liefert. Dieselbe Form
 * nimmt `initMap(…, {config})` entgegen, z. B. für die Offline-Nutzung.
 */
export interface GeolineConfig {
    ags_host: string;
    ags_instance: string;
    wmts_host: string;
    wmts_instance: string;
    wmts_matrix: string;
    wms_host: string;
    wms_instance: string;
    wms_tiled: boolean;
    ags_services: Record<string, AGSServiceEntry>;
    wmts_services: Record<string, WMTSServiceEntry>;
    wms_services: Record<string, WMSServiceEntry>;
}

/** Art eines Kartendienstes. */
export type ServiceKind = 'ags' | 'wmts' | 'wms';

// Hostname mit optionalem Port; schließt Schema, Credentials, Pfad und Query aus
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/i;
// Pfadsegmente ohne leere Segmente, ohne . und ..; ':' kommt in GeoServer-Layernamen vor
const SEGMENT = /^(?!\.{1,2}$)[A-Za-z0-9._~:-]+$/;

class InvalidConfig extends Error {}

function invalid(path: string, expected: string): never {
    throw new InvalidConfig(path + ' muss ' + expected + ' sein');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function host(value: unknown, path: string): string {
    if (typeof value !== 'string' || !HOST.test(value)) {
        invalid(path, 'ein Hostname ohne Schema, Zugangsdaten und Pfad');
    }
    return value.toLowerCase();
}

function urlPath(value: unknown, path: string): string {
    if (typeof value !== 'string' || !value.split('/').every((segment) => SEGMENT.test(segment))) {
        invalid(path, 'ein relativer Pfad ohne leere Segmente, . und ..');
    }
    return value;
}

function bool(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') {
        invalid(path, 'true oder false');
    }
    return value;
}

function entries<T>(value: unknown, path: string, read: (entry: unknown, path: string) => T): Record<string, T> {
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        invalid(path, 'ein Objekt mit Diensten je Name');
    }
    // Ohne Prototyp: Namen wie "toString" oder "__proto__" sind gewöhnliche Schlüssel
    const result: Record<string, T> = Object.create(null);
    for (const name of Object.keys(value)) {
        result[name] = read(value[name], path + '.' + name);
    }
    return result;
}

function record(value: unknown, path: string): Record<string, unknown> {
    if (!isRecord(value)) {
        invalid(path, 'ein Objekt');
    }
    return value;
}

/**
 * Prüft eine Konfiguration und liefert eine bereinigte Kopie. Unbekannte Felder entfallen, Hosts sind
 * kleingeschrieben, Dienste werden nur aus eigenen Schlüsseln gelesen.
 *
 * @param value Antwort des Konfigurationsdienstes oder manuell gesetzte Konfiguration
 * @returns Bereinigte Konfiguration oder `INVALID_DATA` mit dem ersten ungültigen Feld in der Meldung
 */
export function parseConfig(value: unknown): Result<GeolineConfig> {
    try {
        const raw = record(value, 'config');
        return ok({
            ags_host: host(raw.ags_host, 'ags_host'),
            ags_instance: urlPath(raw.ags_instance, 'ags_instance'),
            wmts_host: host(raw.wmts_host, 'wmts_host'),
            wmts_instance: urlPath(raw.wmts_instance, 'wmts_instance'),
            wmts_matrix: urlPath(raw.wmts_matrix, 'wmts_matrix'),
            wms_host: host(raw.wms_host, 'wms_host'),
            wms_instance: urlPath(raw.wms_instance, 'wms_instance'),
            wms_tiled: bool(raw.wms_tiled, 'wms_tiled'),
            ags_services: entries(raw.ags_services, 'ags_services', (entry, path) => {
                const e = record(entry, path);
                return {
                    ags_host: host(e.ags_host, path + '.ags_host'),
                    ags_instance: urlPath(e.ags_instance, path + '.ags_instance'),
                    ags_service: urlPath(e.ags_service, path + '.ags_service'),
                };
            }),
            wmts_services: entries(raw.wmts_services, 'wmts_services', (entry, path) => {
                const e = record(entry, path);
                return {
                    host: host(e.host, path + '.host'),
                    instance: urlPath(e.instance, path + '.instance'),
                    service: urlPath(e.service, path + '.service'),
                    matrix: urlPath(e.matrix, path + '.matrix'),
                };
            }),
            wms_services: entries(raw.wms_services, 'wms_services', (entry, path) => {
                const e = record(entry, path);
                return {
                    host: host(e.host, path + '.host'),
                    instance: urlPath(e.instance, path + '.instance'),
                    service: urlPath(e.service, path + '.service'),
                    tiled: bool(e.tiled, path + '.tiled'),
                };
            }),
        });
    } catch (err) {
        if (err instanceof InvalidConfig) {
            return fail('INVALID_DATA', 'Ungültige Konfiguration: ' + err.message + '.');
        }
        throw err;
    }
}

/**
 * Hostnamen der Dienste einer Art: der Standard-Host und die Hosts aller benannten Dienste.
 *
 * @param config Geprüfte Konfiguration
 * @param kind Art des Dienstes
 * @returns Hostnamen ohne Port, zum exakten Vergleich mit `URL.hostname`
 */
export function stmaHostnames(config: GeolineConfig, kind: ServiceKind): string[] {
    const hosts = kind === 'ags'
        ? [config.ags_host, ...Object.values(config.ags_services).map((entry) => entry.ags_host)]
        : kind === 'wmts'
            ? [config.wmts_host, ...Object.values(config.wmts_services).map((entry) => entry.host)]
            : [config.wms_host, ...Object.values(config.wms_services).map((entry) => entry.host)];
    return [...new Set(hosts.map((value) => value.replace(/:\d+$/, '')))];
}

/**
 * Dienst mit dem Namen `name`, nur aus eigenen Schlüsseln.
 *
 * @param services Dienste einer Art
 * @param name Name des Dienstes
 * @returns Der Dienst oder `undefined`
 */
export function serviceEntry<T>(services: Record<string, T>, name: string): T | undefined {
    return Object.prototype.hasOwnProperty.call(services, name) ? services[name] : undefined;
}

/**
 * Prüft, ob `hostname` die Domain selbst oder eine echte Subdomain davon ist.
 *
 * @param hostname Hostname aus `URL.hostname`
 * @param domain Domain, z. B. `arcgis.com`
 * @returns `true` bei Gleichheit oder Subdomain
 */
export function isHostOrSubdomain(hostname: string, domain: string): boolean {
    return hostname === domain || hostname.endsWith('.' + domain);
}
