function isProtectedAssetURL(value) { return false; }
const BUILT_APP_CONFIG = {"features":{"sphPlatformCorrection":{"enabled":true,"highArcCalibration":{"enabled":true,"mapId":"bakurani","profile":[[780,0,-15.4,-26.2],[815,16,-15.4,-26.2],[900,13,-7.5,-30.4],[1057,8,-39,-29.5],[1266,2,-40.2,-33.8],[1461.1,13,-46,-26],[1650,0,-46,-26]],"fullDeltaZWindowMeters":5,"fadeDeltaZWindowMeters":20,"fullYawWindowDegrees":5,"fadeYawWindowDegrees":20},"dispersionRadiusMeters":25}},"assetGateway":{"enabled":false,"mode":"preclearance","origin":"https://assets.wardogs-artillery.com","directOrigin":"https://assets-v2.wardogs-artillery.com","probePath":"/releases/assets-v1/maps/tiles/bakurani/revisions/s2-20261016/zoom_0/0_0.webp","verificationPath":"/releases/assets-v1/access-check.html","sessionPath":"/__session","turnstile":{"enabled":true,"siteKey":"0x4AAAAAAFFbvfOulm2XKPH9","action":"asset-session"}},"collab":{"enabled":true,"serverUrl":"https://lobby.wardogs-artillery.com","maxParticipants":8,"roomLifetimeHours":6,"maxRoomsPerDay":250,"maxChangeBatchesPerDay":20000,"maxChangeBatchesPerRoom":1000,"batchDelayMs":300,"allowedOrigins":["https://wardogs-artillery.com"],"developmentOrigins":["http://localhost:8000","http://127.0.0.1:8000"],"maxRoomsPerAdmission":25,"admissionLifetimeMinutes":30,"maxInvalidMessages":5,"turnstile":{"enabled":true,"siteKey":"0x4AAAAAAEsqj3RkFZ7z3IfY","hostname":"wardogs-artillery.com","action":"create-lobby"}},"feedback":{"enabled":true,"serverUrl":"https://lobby.wardogs-artillery.com"},"mapTools":{"shortcuts":{"ruler":"r","pencil":"p","zone":"z","polygon":"g","eraser":"e","marker":"m","coordinateSearch":"f","layers":"l","fireAdjust":"i","clearTool":"escape","undo":"ctrl+z","redo":"ctrl+y","redoAlt":"ctrl+shift+z"}},"site":{"lastModified":"2026-10-15","footer":{"disclaimer":"Unofficial community project. Not affiliated with or endorsed by BULKHEAD or the WARDOGS development team.","productName":"WARDOGS Artillery Calculator","authorLabel":"by","authorName":"Apollyon","authorUrl":"https://discord.com/users/202109460238434304","sourceCodeUrl":"https://github.com/apollyon-sys/wardogs-calculator","version":"1.10.5"}},"map":{"camera":{"maxZoom":100,"mobileMaxZoom":40,"panSpeed":800}}};

/* js/core/core.js */
const REGISTRY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const RESERVED_REGISTRY_IDS = new Set([
    ...Object.getOwnPropertyNames(Object.prototype),
    'prototype'
].map(value => value.toLowerCase()));

function createSafeRegistry() {
    return Object.create(null);
}

function isValidRegistryId(value) {
    return (
        typeof value === 'string' &&
        REGISTRY_ID_PATTERN.test(value) &&
        !RESERVED_REGISTRY_IDS.has(value.toLowerCase())
    );
}

function hasRegistryEntry(registry, id) {
    return (
        registry !== null &&
        typeof registry === 'object' &&
        typeof id === 'string' &&
        Object.hasOwn(registry, id)
    );
}

let WEAPONS = createSafeRegistry();
let APP_CONFIG = {};
// The optional lobby runtime is never loaded when collaboration is disabled.
let lobby = null;

const S = {
    w: 16,
    h: 16,

    zoom: 1,

    mode: 'origin',

    map: 'bakurani',

    mapStyle: 'grayscale',

    weapon: null,

    origin: {
        x: 5,
        y: 5
    },

    target: {
        x: 5.5,
        y: 5.5
    },

    panX: 0,
    panY: 0
};

let LANG = 'en';
let DEFAULT_LANG = 'en';

let LANGUAGES = [];
let I18N = {};
let MAPS = createSafeRegistry();
let MAP_ASSETS = createSafeRegistry();

let drag = null;
let pan = null;

let savedTargets = [];

const SAVED_TARGETS_KEY =
    'wardogs-saved-targets';

const SAVE_ARTILLERY_KEY =
    'wardogs-save-artillery-position';

const MAP_POINTS_KEY =
    'wardogs-map-points';

const APP_SELECTIONS_KEY =
    'wardogs-app-selections';

const MAP_STYLE_STORAGE_KEY =
    'wardogs-map-style';

/* =========================
   PERSISTED APP SELECTIONS
   ========================= */

function loadAppSelections() {
    loadMapStylePreference();

    try {
        const raw =
            localStorage.getItem(
                APP_SELECTIONS_KEY
            );

        if (!raw) {
            return;
        }

        const parsed =
            JSON.parse(raw);

        if (
            typeof parsed?.map ===
                'string' &&
            parsed.map.trim()
        ) {
            S.map =
                parsed.map.trim();
        }

        if (
            typeof parsed?.weapon ===
                'string' &&
            parsed.weapon.trim()
        ) {
            S.weapon =
                parsed.weapon.trim();
        }

    } catch (error) {
        console.warn(
            'Failed to load app selections:',
            error
        );
    }
}

function persistAppSelections() {
    if (lobby?.active) { lobby.capture(); return; }
    try {
        localStorage.setItem(
            APP_SELECTIONS_KEY,
            JSON.stringify({
                map: S.map,
                weapon: S.weapon
            })
        );
    } catch (error) {
        console.warn(
            'Failed to save app selections:',
            error
        );
    }
}



/* =========================
   MAP STYLE PREFERENCE
   ========================= */

function loadMapStylePreference() {
    try {
        const saved =
            localStorage.getItem(
                MAP_STYLE_STORAGE_KEY
            );

        if (
            typeof saved === 'string' &&
            saved.trim()
        ) {
            S.mapStyle =
                saved.trim();
        }
    } catch (error) {
        console.warn(
            'Failed to load map style preference:',
            error
        );
    }
}

function persistMapStylePreference() {
    try {
        localStorage.setItem(
            MAP_STYLE_STORAGE_KEY,
            S.mapStyle
        );
    } catch (error) {
        console.warn(
            'Failed to save map style preference:',
            error
        );
    }
}

/* =========================
   KEYBOARD SHORTCUTS
   ========================= */

/*
 * event.key follows the active keyboard layout (KeyR becomes "к" on a
 * Russian layout). Shortcut bindings describe physical keys, so prefer
 * event.code for letters/digits and fall back to event.key for everything
 * else. This keeps shortcuts layout-independent without changing displayed
 * shortcut labels.
 */
function getKeyboardShortcutKey(event) {
    const code =
        String(event?.code || '');

    if (/^Key[A-Z]$/.test(code)) {
        return code.slice(3).toLowerCase();
    }

    if (/^Digit[0-9]$/.test(code)) {
        return code.slice(5);
    }

    const codeKeys = {
        Escape: 'escape',
        ArrowUp: 'arrowup',
        ArrowRight: 'arrowright',
        ArrowDown: 'arrowdown',
        ArrowLeft: 'arrowleft',
        Equal: event?.shiftKey ? '+' : '=',
        NumpadAdd: '+',
        Minus: event?.shiftKey ? '_' : '-',
        NumpadSubtract: '-',
        Enter: 'enter',
        NumpadEnter: 'enter',
        Backspace: 'backspace',
        Delete: 'delete'
    };

    return (
        codeKeys[code] ||
        String(event?.key || '')
            .toLowerCase()
    );
}


/* =========================
   MAP POINT HIT TESTING
   ========================= */

function getNearestUnlockedMapPoint(
    originDistance,
    targetDistance,
    hitThreshold
) {
    const nearest = [
        {
            type: 'origin',
            distance: originDistance
        },
        {
            type: 'target',
            distance: targetDistance
        }
    ]
        .filter(
            point =>
                Number.isFinite(
                    point.distance
                ) &&
                !isPointMapLocked(
                    point.type
                )
        )
        .sort(
            (a, b) =>
                a.distance -
                b.distance
        )[0];

    return (
        nearest &&
        nearest.distance <= hitThreshold
    )
        ? nearest.type
        : null;
}


/* =========================
   ZOOM
   ========================= */

const MIN_ZOOM = 0.4;

const ZOOM_BUTTON_FACTOR = 1.25;
const ZOOM_WHEEL_IN = 1.15;
const ZOOM_WHEEL_OUT = 0.87;


/* =========================
   TILE DEFAULTS
   ========================= */

/*
 * These are only fallback values.
 *
 * Real map-specific values belong
 * inside the map JSON.
 */
const DEFAULT_TILE_SIZE = 256;
const DEFAULT_TILE_MIN_ZOOM = 0;
const DEFAULT_TILE_MAX_ZOOM = 5;
const DEFAULT_TILE_EXTENSION = 'webp';

const TILE_CACHE =
    new Map();

const MARKER_IMAGE_CACHE =
    new Map();


/* =========================
   DOM
   ========================= */

const $ = id =>
    document.getElementById(id);

/*
 * Writing the same string back still dirties layout, and the readouts are
 * rewritten on every pointer move while barely changing between frames.
 */
const setText = (el, value) => {
    if (el && el.textContent !== value) {
        el.textContent = value;
    }
};

const setStyle = (el, prop, value) => {
    if (el && el.style[prop] !== value) {
        el.style[prop] = value;
    }
};

const c =
    $('canvas');

const wrap =
    document.querySelector('.map');

const ctx =
    c.getContext('2d');

const BASE_PATH =
    new URL(
        '.',
        document.baseURI
    );

;

/* js/core/resources.js */
/* =========================
   RESOURCES
   ========================= */

const STATIC_JSON_FETCH_ATTEMPTS = 2;
const STATIC_JSON_RETRY_DELAY = 500;

function resourceURL(path) {
    return new URL(
        path,
        BASE_PATH
    ).href;
}

function getStaticResourceVersion() {
    const script =
        document.querySelector(
            'script[src*="js/app.bundle.js"], ' +
            'script[src*="js/mobile.bundle.js"], ' +
            'script[src*="js/main.js"]'
        );

    if (!script?.src) {
        return '';
    }

    try {
        return (
            new URL(script.src)
                .searchParams
                .get('v') ||
            ''
        );
    } catch {
        return '';
    }
}

function versionStaticResource(url) {
    const version =
        getStaticResourceVersion();

    if (!version) {
        return {
            url,
            versioned: false
        };
    }

    try {
        const resolved =
            new URL(url);

        resolved.searchParams.set(
            'v',
            version
        );

        return {
            url: resolved.href,
            versioned: true
        };
    } catch {
        return {
            url,
            versioned: false
        };
    }
}

function classifyStaticJsonResource(path) {
    const normalized =
        String(path || '')
            .split(/[?#]/, 1)[0]
            .replace(/^\.\//, '')
            .toLowerCase();

    const fixed = {
        'config/app.json': 'app-config',
        'data/weapons.json': 'weapons',
        'locales/index.json': 'locales-index',
        'maps/index.json': 'maps-index',
        'maps/assets.json': 'map-assets'
    };

    if (fixed[normalized]) {
        return fixed[normalized];
    }

    const localeMatch =
        normalized.match(
            /^locales\/([^/]+)\.json$/
        );

    if (localeMatch) {
        return `locale-${localeMatch[1]}`
            .slice(0, 64);
    }

    const mapMatch =
        normalized.match(
            /^maps\/([^/]+)\.json$/
        );

    if (mapMatch) {
        return `map-${mapMatch[1]}`
            .slice(0, 64);
    }

    return 'static-json';
}

function isRetryableStaticJsonFailure(code) {
    if (
        code === 'network' ||
        code === 'decode'
    ) {
        return true;
    }

    const match =
        String(code || '')
            .match(/^http-(\d{3})$/);

    if (!match) {
        return false;
    }

    const status =
        Number(match[1]);

    return (
        status === 408 ||
        status === 429 ||
        (
            status >= 500 &&
            status <= 599
        )
    );
}

function waitForStaticJsonRetry() {
    return new Promise(
        resolve =>
            window.setTimeout(
                resolve,
                STATIC_JSON_RETRY_DELAY
            )
    );
}

async function fetchJSON(path) {
    const load = () => fetchStaticJSON(path);
    return typeof trackAssetLoadingProgress === 'function'
        ? trackAssetLoadingProgress(`static:${path}`, load)
        : load();
}

async function fetchStaticJSON(path) {

    const resource =
        versionStaticResource(
            resourceURL(path)
        );

    const url =
        resource.url;

    const normalizedPath =
        String(path || '');

    const mapMatch =
        normalizedPath.match(
            /^maps\/([^/]+)\.json(?:[?#].*)?$/i
        );

    const isMapResource =
        normalizedPath.startsWith(
            'maps/'
        );

    const resourceId =
        classifyStaticJsonResource(
            normalizedPath
        );

    let lastError = null;
    let failureCode = 'network';
    let previousFailureCode = '';
    let responseStatus = 0;
    let responseContentType = '';
    let responseContentLength = '';
    let responseHost = '';

    for (
        let attempt = 1;
        attempt <= STATIC_JSON_FETCH_ATTEMPTS;
        attempt++
    ) {
        failureCode = 'network';
        responseStatus = 0;
        responseContentType = '';
        responseContentLength = '';
        responseHost = '';

        const retryingDecode =
            attempt > 1 &&
            previousFailureCode === 'decode';

        let requestUrl = url;

        if (retryingDecode) {
            try {
                const retryUrl = new URL(url);
                retryUrl.searchParams.set(
                    '_wd_retry',
                    String(attempt)
                );
                requestUrl = retryUrl.href;
            } catch (_) {
                requestUrl = url;
            }
        }

        try {
            const response =
                await fetch(
                    requestUrl,
                    {
                        /*
                         * Production JSON URLs carry the current build fingerprint,
                         * so cached data is invalidated automatically on deploy.
                         * A decode failure gets one cache-busting reload in case a
                         * browser/proxy/CDN edge returned a truncated or non-JSON body.
                         */
                        cache:
                            retryingDecode
                                ? 'reload'
                                : resource.versioned
                                    ? 'force-cache'
                                    : 'no-cache'
                    }
                );

            responseStatus = response.status;
            responseContentType =
                String(
                    response.headers.get(
                        'content-type'
                    ) || ''
                ).slice(0, 64);
            responseContentLength =
                String(
                    response.headers.get(
                        'content-length'
                    ) || ''
                ).slice(0, 32);

            try {
                responseHost =
                    new URL(response.url)
                        .hostname
                        .slice(0, 64);
            } catch (_) {
                responseHost = '';
            }

            if (!response.ok) {
                failureCode =
                    `http-${response.status}`;

                throw new Error(
                    `Failed to load ${url}: ${response.status} ${response.statusText}`
                );
            }

            failureCode =
                'decode';

            return await response.json();

        } catch (error) {
            lastError = error;
            previousFailureCode = failureCode;

            if (
                attempt < STATIC_JSON_FETCH_ATTEMPTS &&
                isRetryableStaticJsonFailure(
                    failureCode
                )
            ) {
                await waitForStaticJsonRetry();
                continue;
            }

            if (
                typeof trackOperationalFailure ===
                    'function'
            ) {
                const mapId =
                    mapMatch &&
                    ![
                        'index',
                        'assets'
                    ].includes(
                        mapMatch[1].toLowerCase()
                    )
                        ? mapMatch[1]
                        : '';

                trackOperationalFailure(
                    isMapResource
                        ? 'map-load-failed'
                        : 'asset-load-failed',
                    {
                        area:
                            isMapResource
                                ? 'maps'
                                : 'resources',
                        type: 'json',
                        map: mapId,
                        code: failureCode,
                        resource: resourceId,
                        attempts: attempt,
                        status: responseStatus,
                        contentType: responseContentType,
                        contentLength: responseContentLength,
                        responseHost
                    }
                );
            }

            throw error;
        }
    }

    throw lastError;
}

;

/* js/core/config.js */
/* =========================
   APPLICATION CONFIG
   ========================= */

const DEFAULT_APP_CONFIG = {
    assetGateway: {
        enabled: false,
        mode: 'session-cookie',
        origin:
            'https://assets.wardogs-artillery.com',
        directOrigin:
            'https://assets-v2.wardogs-artillery.com',
        sessionPath: '/__session',
        turnstile: {
            enabled: true,
            siteKey: '',
            action: 'asset-session'
        }
    },

    features: {
        sphPlatformCorrection: {
            enabled: false,
            highArcCalibration: {
                enabled: false,
                mapId: 'bakurani',
                profile: [],
                fullDeltaZWindowMeters: 5,
                fadeDeltaZWindowMeters: 20,
                fullYawWindowDegrees: 5,
                fadeYawWindowDegrees: 20
            },
            dispersionRadiusMeters: 0
        }
    },

    map: {
        camera: {
            maxZoom: 100,
            mobileMaxZoom: 40,
            panSpeed: 800
        }
    },

    site: {
        footer: {
            disclaimer:
                'Unofficial community project. Not affiliated with or endorsed by BULKHEAD or the WARDOGS development team.',
            productName:
                'WARDOGS Artillery Calculator',
            authorLabel:
                'by',
            authorName:
                'Apollyon',
            authorUrl:
                'https://discord.com/users/202109460238434304',
            sourceCodeUrl:
                'https://github.com/apollyon-sys/wardogs-calculator',
            version:
                '1.10.5'
        }
    },

    mapTools: {
        shortcuts: {
            ruler: 'r',
            pencil: 'p',
            zone: 'z',
            polygon: 'g',
            eraser: 'e',
            marker: 'm',
            coordinateSearch: 'f',
            layers: 'l',
            fireAdjust: 'i',
            clearTool: 'escape',
            undo: 'ctrl+z',
            redo: 'ctrl+y',
            redoAlt: 'ctrl+shift+z'
        }
    }
};

const APP_CONFIG_LOAD_STATE = { failed: false, pending: null };

function mergeAppConfig(base, override) {
    return {
        ...base,
        ...(override || {}),

        assetGateway: {
            ...base.assetGateway,
            ...(override?.assetGateway || {}),
            turnstile: {
                ...base.assetGateway.turnstile,
                ...(override?.assetGateway?.turnstile || {})
            }
        },

        map: {
            ...base.map,
            ...(override?.map || {}),
            camera: {
                ...base.map.camera,
                ...(override?.map?.camera || {})
            }
        },

        site: {
            ...base.site,
            ...(override?.site || {}),
            footer: {
                ...base.site.footer,
                ...(override?.site?.footer || {})
            }
        },

        mapTools: {
            ...base.mapTools,
            ...(override?.mapTools || {}),
            shortcuts: {
                ...base.mapTools.shortcuts,
                ...(override?.mapTools?.shortcuts || {})
            }
        },

        features: {
            ...base.features,
            ...(override?.features || {}),
            sphPlatformCorrection: {
                ...base.features.sphPlatformCorrection,
                ...(override?.features?.sphPlatformCorrection || {}),
                highArcCalibration: {
                    ...base.features.sphPlatformCorrection.highArcCalibration,
                    ...(override?.features?.sphPlatformCorrection
                        ?.highArcCalibration || {})
                }
            }
        }
    };
}

async function loadAppConfig() {
    if (APP_CONFIG_LOAD_STATE.pending) return APP_CONFIG_LOAD_STATE.pending;
    APP_CONFIG_LOAD_STATE.pending = (async () => {
        try {
            const loaded = await fetchJSON('config/app.json');
            if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded) ||
                typeof loaded.assetGateway?.enabled !== 'boolean') {
                throw new Error('app-config-invalid');
            }
            APP_CONFIG = mergeAppConfig(DEFAULT_APP_CONFIG, loaded);
            APP_CONFIG_LOAD_STATE.failed = false;
            return true;
        } catch (error) {
            // The production bundle carries the configuration from the same
            // build. A failed JSON request must not disable asset admission or
            // silently discard the deployed ballistics and lobby settings.
            const embedded = typeof BUILT_APP_CONFIG === 'object' && BUILT_APP_CONFIG;
            APP_CONFIG = mergeAppConfig(DEFAULT_APP_CONFIG, embedded || {});
            APP_CONFIG_LOAD_STATE.failed = !embedded;
            console.warn('Failed to load config/app.json; using build configuration when available.', error);
            if (typeof trackAnalytics === 'function') {
                try { trackAnalytics('app-config-failed', { recovery: embedded ? 'embedded' : 'pending' }); } catch {}
            }
            return Boolean(embedded);
        }
    })();
    try {
        return await APP_CONFIG_LOAD_STATE.pending;
    } finally {
        APP_CONFIG_LOAD_STATE.pending = null;
    }
}

function getMapToolShortcut(action) {
    return String(
        APP_CONFIG
            ?.mapTools
            ?.shortcuts
            ?.[action] || ''
    )
        .trim()
        .toLowerCase();
}

function isSphPlatformCorrectionEnabled() {
    return (
        APP_CONFIG
            ?.features
            ?.sphPlatformCorrection
            ?.enabled === true
    );
}

function normalizeConfiguredHttpUrl(
    value,
    {
        allowLocalhost = false,
        allowSearchAndHash = true
    } = {}
) {
    try {
        const url = new URL(
            String(value || '').trim(),
            document.baseURI
        );

        const localHttp =
            allowLocalhost &&
            url.protocol === 'http:' &&
            (
                url.hostname === 'localhost' ||
                url.hostname === '127.0.0.1' ||
                url.hostname === '[::1]'
            );

        if (url.protocol !== 'https:' && !localHttp) {
            return null;
        }

        if (url.username || url.password) {
            return null;
        }

        if (
            !allowSearchAndHash &&
            (url.search || url.hash)
        ) {
            return null;
        }

        return url.href;
    } catch {
        return null;
    }
}

function getCameraPanSpeed() {
    const configured =
        Number(
            APP_CONFIG
                ?.map
                ?.camera
                ?.panSpeed
        );

    return (
        Number.isFinite(configured) &&
        configured > 0
            ? configured
            : DEFAULT_APP_CONFIG.map.camera.panSpeed
    );
}

function getMaxCameraZoom() {
    const mobile =
        document.body
            ?.classList
            .contains('mobile-app') === true;

    const camera =
        APP_CONFIG
            ?.map
            ?.camera;

    const configured =
        Number(
            mobile
                ? camera?.mobileMaxZoom
                : camera?.maxZoom
        );

    const fallback =
        mobile
            ? DEFAULT_APP_CONFIG.map.camera.mobileMaxZoom
            : DEFAULT_APP_CONFIG.map.camera.maxZoom;

    return (
        Number.isFinite(configured) &&
        configured > 0
            ? configured
            : fallback
    );
}

;

/* js/core/asset-access.js */
/* =========================
   PROTECTED ASSET ACCESS
   ========================= */

const ASSET_ACCESS_STATE = {
    expiresAt: 0,
    mode: '',
    pending: null,
    refreshTimer: null,
    turnstileLoader: null,
    turnstileWidget: null,
    challengeResolve: null,
    challengeReject: null,
    challengeTimer: null,
    lastFailureRefresh: 0,
    regionalFallback: false,
    directVerified: false,
    verificationRequired: false,
    verificationReturn: false,
    stage: 'idle',
    retryAt: 0,
    retryTimer: null,
    noticeTimer: null,
    automaticRetries: 0,
    awaitingRetry: false,
    lastError: null,
    failureGeneration: 0,
    retryListeners: new Set(),
    environmentListenersAdded: false,
    lastEnvironmentRetry: 0,
    failureTelemetryKey: ''
};

const ASSET_RETRY_DELAY_MS = 10000;
const ASSET_AUTOMATIC_RETRIES = 2;
const ASSET_SESSION_TIMEOUT_MS = 30000;
const ASSET_TURNSTILE_SCRIPT_TIMEOUT_MS = 30000;
const ASSET_CHALLENGE_TIMEOUT_MS = 60000;
const ASSET_VERIFICATION_RETURN_KEY = 'wardogs-asset-verification-return';
const ASSET_VERIFICATION_RETURN_HASH = '#asset-access-verified';

function assetAccessText(key, fallback) {
    const translated = typeof tr === 'function' ? tr(key) : '';
    return translated && translated !== key ? translated : fallback;
}

function assetFailureCode(error) {
    const message = String(error?.message || '');
    if (/^(turnstile-(?:unavailable|not-configured|expired|timeout|unsupported|\d{3,8})|asset-session-(?:invalid|http-\d{3})|asset-http-\d{3}|asset-clearance-required|asset-config-unavailable|session-cookie-unavailable|session-required|gateway-not-configured|challenge-(?:required|unavailable|failed)|rate-limited|forbidden-origin|unavailable)$/.test(message)) {
        return message;
    }
    if (error?.name === 'TimeoutError') return 'timeout';
    if (error?.name === 'TypeError') return 'network-or-cors';
    return 'unavailable';
}

function assetFailureContext(error, stage, url = '') {
    error.stage = stage;
    if (url) {
        try { error.requestHost = new URL(url).hostname; } catch { /* No URL data in diagnostics. */ }
    }
    return error;
}

function invalidateAssetSession() {
    ASSET_ACCESS_STATE.expiresAt = 0;
    ASSET_ACCESS_STATE.directVerified = false;
    clearAssetRefreshTimer();
}

/* Explicit allowlist: never expose cookies, tokens or the response body. */
function getAssetAccessDiagnostics() {
    const state = ASSET_ACCESS_STATE;
    const error = state.lastError;
    const response = error?.response;
    return {
        enabled: isAssetGatewayEnabled(),
        configuredMode: getAssetGatewayMode(),
        stage: state.stage,
        sessionMode: state.mode || null,
        deliveryOrigin: shouldUseDirectAssetOrigin()
            ? getAssetDirectOrigin() : getAssetGatewayOrigin(),
        sessionValid: hasValidAssetAccess(),
        expiresAt: state.expiresAt || null,
        pending: Boolean(state.pending),
        regionalFallback: state.regionalFallback,
        directVerified: state.directVerified,
        verificationRequired: state.verificationRequired,
        paused: isAssetAccessPaused(),
        awaitingManualRetry: state.awaitingRetry,
        retryAt: state.retryAt || null,
        automaticRetries: state.automaticRetries,
        lastFailure: error ? {
            stage: error.stage || state.stage,
            code: assetFailureCode(error),
            requestHost: error.requestHost || null,
            status: error.status || response?.status || null,
            name: error.name || 'Error',
            cfRay: response?.headers?.get('CF-Ray') || null,
            mitigation: response?.headers?.get('CF-Mitigated') || null,
            retryAfter: response?.headers?.get('Retry-After') || null
        } : null
    };
}

function assetRetryAfter(response, fallbackMs = ASSET_RETRY_DELAY_MS) {
    const value = response?.headers?.get('Retry-After')?.trim();
    const seconds = value && /^\d+(?:\.\d+)?$/.test(value)
        ? Number(value)
        : NaN;
    const date = value && !Number.isFinite(seconds)
        ? Date.parse(value)
        : NaN;

    return Math.max(
        Date.now() + fallbackMs,
        Number.isFinite(seconds)
            ? Date.now() + seconds * 1000
            : Number.isFinite(date) ? date : 0
    );
}

function getAssetAccessRetryAt() {
    return ASSET_ACCESS_STATE.awaitingRetry
        ? Infinity
        : ASSET_ACCESS_STATE.retryAt;
}

function isAssetAccessPaused() {
    return getAssetAccessRetryAt() > Date.now();
}

function onAssetAccessRetry(listener) {
    ASSET_ACCESS_STATE.retryListeners.add(listener);
}

function resumeAssetLoads() {
    for (const listener of ASSET_ACCESS_STATE.retryListeners) {
        listener();
    }
}

function assetAccessBlockedError() {
    const error = new Error('asset-access-paused');
    error.status = ASSET_ACCESS_STATE.lastError?.status || 0;
    error.retryAt = getAssetAccessRetryAt();
    error.retryable = true;
    return error;
}

function assetResponseError(response, message = `asset-http-${response.status}`) {
    const error = new Error(message);
    error.status = response.status;
    error.response = response;
    error.retryable = response.status === 401 || response.status === 403 ||
        response.status === 408 || response.status === 425 ||
        response.status === 429 || response.status >= 500;
    return error;
}

function reportAssetAccessFailure(error) {
    if (typeof trackAnalytics !== 'function') return;
    const code = assetFailureCode(error);
    const key = `${error.stage}:${code}:${error.requestHost || ''}:${error.status || 0}`;
    if (ASSET_ACCESS_STATE.failureTelemetryKey === key) return;
    ASSET_ACCESS_STATE.failureTelemetryKey = key;
    try {
        trackAnalytics('asset-access-failed', {
            build: typeof getAnalyticsBuildId === 'function' ? getAnalyticsBuildId() : '',
            area: 'asset-access',
            type: error.stage === 'asset-fetch' ? 'delivery' : 'session',
            phase: error.stage,
            code,
            resource: error.requestHost || '',
            map: typeof S === 'object' ? S?.map : '',
            status: error.status,
            attempts: ASSET_ACCESS_STATE.automaticRetries + 1
        });
    } catch {
        // Diagnostics must not interrupt map recovery.
    }
}

function pauseAssetAccess(error, response = null) {
    if (!error.stage) error.stage = ASSET_ACCESS_STATE.stage;
    const delay = Math.min(
        60000,
        ASSET_RETRY_DELAY_MS * 2 ** ASSET_ACCESS_STATE.automaticRetries
    );
    const retryAt = assetRetryAfter(response, Math.max(
        delay,
        error.status === 401 || error.status === 403 ? 30000 : 0
    ));

    // Concurrent failures share a deadline and one recovery attempt.
    ASSET_ACCESS_STATE.retryAt = Math.max(ASSET_ACCESS_STATE.retryAt, retryAt);
    ASSET_ACCESS_STATE.lastError = error;
    ASSET_ACCESS_STATE.verificationRequired = Boolean(error.requiresVerification);
    reportAssetAccessFailure(error);
    ASSET_ACCESS_STATE.failureGeneration++;
    ASSET_ACCESS_STATE.awaitingRetry =
        ASSET_ACCESS_STATE.automaticRetries >= ASSET_AUTOMATIC_RETRIES;
    error.retryable = true;
    error.retryAt = getAssetAccessRetryAt();

    window.clearTimeout(ASSET_ACCESS_STATE.retryTimer);
    ASSET_ACCESS_STATE.retryTimer = window.setTimeout(() => {
        ASSET_ACCESS_STATE.retryTimer = null;
        if (ASSET_ACCESS_STATE.retryAt > Date.now()) {
            return;
        }
        updateAssetAccessNotice();
        if (window.navigator?.onLine === false || document.visibilityState === 'hidden') {
            return;
        }
        if (!ASSET_ACCESS_STATE.awaitingRetry) {
            ASSET_ACCESS_STATE.automaticRetries++;
            resumeAssetLoads();
        }
    }, Math.min(2147483647, ASSET_ACCESS_STATE.retryAt - Date.now()));

    updateAssetAccessNotice();
    return error;
}

function clearAssetAccessFailure() {
    if (isAssetAccessPaused()) {
        return;
    }
    if (ASSET_ACCESS_STATE.lastError && typeof trackAnalytics === 'function') {
        try {
            trackAnalytics('asset-access-recovered', {
                mode: ASSET_ACCESS_STATE.mode,
                map: typeof S === 'object' ? S?.map : ''
            });
        } catch {
            // Loading must work even when analytics is unavailable.
        }
    }
    ASSET_ACCESS_STATE.lastError = null;
    ASSET_ACCESS_STATE.verificationRequired = false;
    ASSET_ACCESS_STATE.failureTelemetryKey = '';
    ASSET_ACCESS_STATE.retryAt = 0;
    ASSET_ACCESS_STATE.automaticRetries = 0;
    window.clearTimeout(ASSET_ACCESS_STATE.retryTimer);
    window.clearTimeout(ASSET_ACCESS_STATE.noticeTimer);
    ASSET_ACCESS_STATE.retryTimer = null;
    ASSET_ACCESS_STATE.noticeTimer = null;
    updateAssetAccessNotice();
}

async function retryAssetAccess() {
    if (Date.now() < ASSET_ACCESS_STATE.retryAt) {
        return false;
    }
    ASSET_ACCESS_STATE.awaitingRetry = false;
    ASSET_ACCESS_STATE.retryAt = 0;
    ASSET_ACCESS_STATE.automaticRetries = 0;
    ASSET_ACCESS_STATE.expiresAt = 0;
    const pending = ensureAssetAccess();
    updateAssetAccessNotice();
    const allowed = await pending;
    if (allowed) {
        resumeAssetLoads();
    }
    updateAssetAccessNotice();
    return allowed;
}

function retryAssetAccessAfterEnvironmentChange() {
    const now = Date.now();
    if (!ASSET_ACCESS_STATE.lastError || ASSET_ACCESS_STATE.pending ||
        window.navigator?.onLine === false || document.visibilityState === 'hidden' ||
        now < ASSET_ACCESS_STATE.retryAt ||
        now - ASSET_ACCESS_STATE.lastEnvironmentRetry < 60000) {
        return;
    }
    ASSET_ACCESS_STATE.lastEnvironmentRetry = now;
    void retryAssetAccess();
}

function initializeAssetAccessRecovery() {
    if (ASSET_ACCESS_STATE.environmentListenersAdded) return;
    ASSET_ACCESS_STATE.environmentListenersAdded = true;
    window.addEventListener?.('online', retryAssetAccessAfterEnvironmentChange);
    window.addEventListener?.('focus', retryAssetAccessAfterEnvironmentChange);
    document.addEventListener?.('visibilitychange', retryAssetAccessAfterEnvironmentChange);
}

function assetVerificationURL() {
    if (!usesPreclearanceAssetDelivery() || ASSET_ACCESS_STATE.regionalFallback) return '';
    const base = new URL(document.baseURI);
    // The production verification page only returns to the official site.
    if (base.origin !== 'https://wardogs-artillery.com') return '';
    const path = getAssetGatewayConfig().verificationPath;
    if (typeof path !== 'string' || !path.startsWith('/releases/assets-v1/') || /[?#]/.test(path)) return '';
    const url = new URL(path, getAssetDirectOrigin());
    if (!url.pathname.startsWith('/releases/assets-v1/')) return '';
    url.hash = new URLSearchParams({ return: window.location.pathname || base.pathname }).toString();
    return url.href;
}

function rememberAssetVerificationReturn() {
    try {
        // Private URL parameters stay on the application origin, not in the
        // verification page URL, logs or analytics.
        window.sessionStorage.setItem(ASSET_VERIFICATION_RETURN_KEY, window.location.href);
    } catch { /* The clean locale/mobile path is still a usable return URL. */ }
}

function restoreAssetVerificationReturn() {
    if (window.location.hash !== ASSET_VERIFICATION_RETURN_HASH) return;
    ASSET_ACCESS_STATE.verificationReturn = true;
    let target = new URL(window.location.href || document.baseURI);
    target.hash = '';
    try {
        const saved = window.sessionStorage.getItem(ASSET_VERIFICATION_RETURN_KEY);
        window.sessionStorage.removeItem(ASSET_VERIFICATION_RETURN_KEY);
        if (saved) {
            const parsed = new URL(saved);
            if (parsed.origin === target.origin && !parsed.username && !parsed.password) target = parsed;
        }
    } catch { /* Storage may be disabled. */ }
    window.history?.replaceState(null, '', target.href);
}

function updateAssetAccessNotice() {
    const hasProgress = typeof queueAssetLoadingProgressUpdate === 'function' &&
        queueAssetLoadingProgressUpdate() !== false;
    window.clearTimeout(ASSET_ACCESS_STATE.noticeTimer);
    ASSET_ACCESS_STATE.noticeTimer = null;
    let notice = document.getElementById('assetAccessNotice');

    const pending = Boolean(ASSET_ACCESS_STATE.pending);
    if (!ASSET_ACCESS_STATE.lastError && (!pending || hasProgress)) {
        if (notice) notice.hidden = true;
        return;
    }
    // The existing local-copy warning already explains this case.
    if (shouldShowLocalAssetWarning()) {
        return;
    }
    if (!notice) {
        const map = document.querySelector('.map');
        if (!map) return;
        notice = document.createElement('aside');
        notice.id = 'assetAccessNotice';
        notice.className = 'local-asset-warning asset-access-notice';
        const content = document.createElement('div');
        content.className = 'local-asset-warning-content';
        const title = document.createElement('strong');
        title.setAttribute('role', 'status');
        title.setAttribute('aria-live', 'polite');
        const message = document.createElement('p');
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.addEventListener('click', () => { void retryAssetAccess(); });
        const verify = document.createElement('a');
        verify.className = 'asset-access-verify';
        verify.addEventListener('click', rememberAssetVerificationReturn);
        content.append(title, message, retry, verify);
        notice.append(content);
        map.append(notice);
    }

    const text = assetAccessText;
    const seconds = Math.max(0, Math.ceil(
        (ASSET_ACCESS_STATE.retryAt - Date.now()) / 1000
    ));
    notice.hidden = false;
    const title = notice.querySelector('strong');
    const titleText = pending
        ? text('assetAccessLoading', 'Loading the map…')
        : text('assetAccessUnavailable', 'Map loading is temporarily unavailable');
    // Keep the live-region text stable while the silent countdown updates.
    if (title.textContent !== titleText) title.textContent = titleText;
    notice.querySelector('p').textContent = pending
        ? text('assetAccessLoadingHint', 'Please wait. You can continue using the calculator.')
        : seconds
            ? text('assetAccessWaiting', 'Try again in {seconds} s.').replace('{seconds}', seconds)
            : text('assetAccessRetryHint', 'Retry loading the map and terrain data.');
    const verificationURL = ASSET_ACCESS_STATE.verificationRequired ? assetVerificationURL() : '';
    const verify = notice.querySelector('a');
    verify.hidden = !verificationURL || pending;
    if (verificationURL) {
        verify.href = verificationURL;
        verify.textContent = text('assetAccessVerify', 'Verify map access');
        if (!pending) notice.querySelector('p').textContent = text(
            'assetAccessVerifyHint', 'Complete a browser check, then return to the calculator.'
        );
    }
    const retry = notice.querySelector('button');
    retry.hidden = pending;
    retry.disabled = seconds > 0 || Boolean(ASSET_ACCESS_STATE.pending);
    retry.textContent = text('assetAccessRetry', 'Retry loading');
    if (seconds > 0 || ASSET_ACCESS_STATE.pending) {
        ASSET_ACCESS_STATE.noticeTimer = window.setTimeout(updateAssetAccessNotice, 1000);
    }
}

const LOCAL_ASSET_DOCUMENTATION_URL =
    'https://github.com/apollyon-sys/wardogs-calculator/blob/main/docs/cdn.md#forks-and-self-hosted-deployments';

const LOCAL_ASSET_WARNING_SESSION_KEY =
    'wardogs-local-asset-warning-dismissed';

function isLocalAssetWarningDismissed() {
    try {
        return sessionStorage.getItem(
            LOCAL_ASSET_WARNING_SESSION_KEY
        ) === 'true';
    } catch {
        return false;
    }
}

function dismissLocalAssetWarning(warning) {
    try {
        sessionStorage.setItem(
            LOCAL_ASSET_WARNING_SESSION_KEY,
            'true'
        );
    } catch {
        /* Closing must still work when session storage is unavailable. */
    }

    warning.remove();
}

function isLocalAssetCopyHost(value = window.location.hostname) {
    const hostname = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, '');

    if (
        hostname === 'localhost' ||
        hostname === '::1' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local')
    ) {
        return true;
    }

    const match = hostname.match(
        /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    );

    if (!match) {
        return false;
    }

    const octets = match.slice(1).map(Number);
    if (octets.some(octet => octet > 255)) {
        return false;
    }

    return (
        octets[0] === 10 ||
        octets[0] === 127 ||
        (
            octets[0] === 172 &&
            octets[1] >= 16 &&
            octets[1] <= 31
        ) ||
        (
            octets[0] === 192 &&
            octets[1] === 168
        )
    );
}

function shouldShowLocalAssetWarning() {
    if (!isLocalAssetCopyHost()) {
        return false;
    }

    return [
        getAssetGatewayOrigin(),
        getAssetDirectOrigin()
    ].some(origin =>
        origin ===
            'https://assets.wardogs-artillery.com' ||
        origin ===
            'https://assets-v2.wardogs-artillery.com'
    );
}

function showLocalAssetWarning() {
    if (
        !shouldShowLocalAssetWarning() ||
        isLocalAssetWarningDismissed() ||
        document.getElementById(
            'localAssetWarning'
        )
    ) {
        return;
    }

    const map =
        document.querySelector('.map');

    if (!map) {
        return;
    }

    const warning =
        document.createElement('aside');
    warning.id = 'localAssetWarning';
    warning.className = 'local-asset-warning';
    warning.setAttribute('role', 'alert');
    warning.setAttribute('aria-live', 'polite');

    const icon =
        document.createElement('span');
    icon.className = 'local-asset-warning-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⚠';

    const content =
        document.createElement('div');
    content.className = 'local-asset-warning-content';

    const title =
        document.createElement('strong');
    title.textContent =
        tr('localAssetWarningTitle');

    const body =
        document.createElement('p');
    body.textContent =
        tr('localAssetWarningBody');

    const link =
        document.createElement('a');
    link.href = LOCAL_ASSET_DOCUMENTATION_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent =
        tr('localAssetWarningLink');

    const close =
        document.createElement('button');
    const closeLabel =
        tr('localAssetWarningClose');
    close.type = 'button';
    close.className =
        'local-asset-warning-close';
    close.title = closeLabel;
    close.setAttribute(
        'aria-label',
        closeLabel
    );
    close.textContent = '×';
    close.addEventListener(
        'click',
        () => dismissLocalAssetWarning(
            warning
        )
    );

    content.append(title, body, link);
    warning.append(icon, content, close);
    map.appendChild(warning);
}

function getAssetGatewayConfig() {
    return (
        APP_CONFIG?.assetGateway ||
        DEFAULT_APP_CONFIG.assetGateway
    );
}

function getAssetGatewayMode() {
    const mode =
        String(
            getAssetGatewayConfig()
                ?.mode ||
            'session-cookie'
        )
            .trim()
            .toLowerCase();

    return (
        mode === 'preclearance'
            ? 'preclearance'
            : 'session-cookie'
    );
}

function normalizeAssetOrigin(value) {
    const normalized =
        normalizeConfiguredHttpUrl(
            value,
            {
                allowLocalhost: true,
                allowSearchAndHash: false
            }
        );

    if (!normalized) {
        return '';
    }

    try {
        return new URL(
            normalized
        ).origin;
    } catch {
        return '';
    }
}

function getAssetGatewayOrigin() {
    return normalizeAssetOrigin(
        getAssetGatewayConfig()
            ?.origin
    );
}

function getAssetDirectOrigin() {
    return normalizeAssetOrigin(
        getAssetGatewayConfig()
            ?.directOrigin
    );
}

function isAssetGatewayEnabled() {
    const config =
        getAssetGatewayConfig();

    if (
        config?.enabled !== true ||
        !getAssetGatewayOrigin()
    ) {
        return false;
    }

    return (
        getAssetGatewayMode() !==
            'preclearance' ||
        Boolean(
            getAssetDirectOrigin()
        )
    );
}

function usesPreclearanceAssetDelivery() {
    return (
        isAssetGatewayEnabled() &&
        getAssetGatewayMode() ===
            'preclearance'
    );
}

function _DISABLED_isProtectedAssetURL(value) {
    try {
        const origin =
            new URL(
                value,
                document.baseURI
            ).origin;

        return [
            getAssetGatewayOrigin(),
            getAssetDirectOrigin()
        ]
            .filter(Boolean)
            .includes(origin);
    } catch {
        return false;
    }
}

function shouldUseDirectAssetOrigin() {
    return (
        usesPreclearanceAssetDelivery() &&
        ASSET_ACCESS_STATE.mode ===
            'standard' &&
        !ASSET_ACCESS_STATE.regionalFallback
    );
}

function resolveProtectedAssetURL(value) {
    let source;

    try {
        source = new URL(
            value,
            document.baseURI
        );
    } catch {
        return value;
    }

    if (
        !isProtectedAssetURL(source.href) ||
        !isAssetGatewayEnabled()
    ) {
        return source.href;
    }

    const deliveryOrigin = shouldUseDirectAssetOrigin()
        ? getAssetDirectOrigin()
        : getAssetGatewayOrigin();

    if (!deliveryOrigin) {
        return source.href;
    }

    const target =
        new URL(
            source.pathname +
                source.search +
                source.hash,
            deliveryOrigin
        );

    return target.href;
}

function hasValidAssetAccess() {
    if (typeof APP_CONFIG_LOAD_STATE === 'object' && APP_CONFIG_LOAD_STATE.failed) return false;
    return (
        !isAssetGatewayEnabled() ||
        (ASSET_ACCESS_STATE.expiresAt > Date.now() + 15000 &&
            (!usesPreclearanceAssetDelivery() || ASSET_ACCESS_STATE.mode === 'restricted' ||
                ASSET_ACCESS_STATE.directVerified))
    );
}

function assetSessionURL() {
    const config =
        getAssetGatewayConfig();

    const origin =
        normalizeConfiguredHttpUrl(
            config.origin,
            {
                allowLocalhost: true,
                allowSearchAndHash: false
            }
        );

    if (!origin) {
        throw new Error(
            'asset-gateway-not-configured'
        );
    }

    const path =
        String(
            config.sessionPath ||
            '/__session'
        );

    if (
        !path.startsWith('/') ||
        path.includes('..') ||
        /[?#]/.test(path)
    ) {
        throw new Error(
            'asset-session-path-invalid'
        );
    }

    return new URL(
        path,
        origin
    ).href;
}

function clearAssetRefreshTimer() {
    if (ASSET_ACCESS_STATE.refreshTimer) {
        window.clearTimeout(
            ASSET_ACCESS_STATE.refreshTimer
        );
    }

    ASSET_ACCESS_STATE.refreshTimer = null;
}

function rememberAssetSession(data) {
    const expiresAt =
        Number(data?.expiresAt || 0);

    if (
        !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now()
    ) {
        throw new Error(
            'asset-session-invalid'
        );
    }

    ASSET_ACCESS_STATE.expiresAt =
        expiresAt;

    ASSET_ACCESS_STATE.mode =
        data.mode === 'restricted'
            ? 'restricted'
            : 'standard';

    ASSET_ACCESS_STATE.regionalFallback =
        ASSET_ACCESS_STATE.mode ===
            'restricted';
    ASSET_ACCESS_STATE.directVerified = false;

    clearAssetRefreshTimer();

    const delay =
        Math.max(
            30000,
            expiresAt - Date.now() - 60000
        );

    ASSET_ACCESS_STATE.refreshTimer =
        window.setTimeout(
            () => {
                refreshAssetAccess()
                    .catch(error => {
                        console.warn(
                            '[asset-access] Session refresh failed.',
                            error
                        );
                    });
            },
            delay
        );
}

function assetChallengeConfig() {
    return (
        getAssetGatewayConfig()
            ?.turnstile ||
        {}
    );
}

function loadAssetTurnstile() {
    if (window.turnstile) {
        return Promise.resolve();
    }

    if (ASSET_ACCESS_STATE.turnstileLoader) {
        return ASSET_ACCESS_STATE.turnstileLoader;
    }

    ASSET_ACCESS_STATE.turnstileLoader =
        new Promise((resolve, reject) => {
            let settled = false;

            const finish = (
                callback,
                value
            ) => {
                if (settled) {
                    return;
                }

                settled = true;
                window.clearTimeout(timer);
                callback(value);
            };

            const timer =
                window.setTimeout(
                    () => finish(
                        reject,
                        new Error(
                            'turnstile-unavailable'
                        )
                    ),
                    ASSET_TURNSTILE_SCRIPT_TIMEOUT_MS
                );

            const existing =
                document.querySelector(
                    'script[data-wardogs-turnstile]'
                );

            if (existing) {
                existing.addEventListener(
                    'load',
                    () => finish(resolve),
                    { once: true }
                );
                existing.addEventListener(
                    'error',
                    () => finish(
                        reject,
                        new Error(
                            'turnstile-unavailable'
                        )
                    ),
                    { once: true }
                );
                return;
            }

            const script =
                document.createElement(
                    'script'
                );

            script.src =
                'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.dataset.wardogsTurnstile = '1';
            script.addEventListener(
                'load',
                () => finish(resolve),
                { once: true }
            );
            script.addEventListener(
                'error',
                () => finish(
                    reject,
                    new Error(
                        'turnstile-unavailable'
                    )
                ),
                { once: true }
            );

            document.head.appendChild(
                script
            );
        }).catch(error => {
            ASSET_ACCESS_STATE.turnstileLoader = null;
            document.querySelector('script[data-wardogs-turnstile]')?.remove();
            throw error;
        });

    return ASSET_ACCESS_STATE.turnstileLoader;
}

function settleAssetChallenge(
    method,
    value
) {
    const callback =
        method === 'resolve'
            ? ASSET_ACCESS_STATE.challengeResolve
            : ASSET_ACCESS_STATE.challengeReject;

    if (!callback) {
        return;
    }

    window.clearTimeout(
        ASSET_ACCESS_STATE.challengeTimer
    );

    ASSET_ACCESS_STATE.challengeResolve = null;
    ASSET_ACCESS_STATE.challengeReject = null;
    ASSET_ACCESS_STATE.challengeTimer = null;

    const panel = document.getElementById('assetAccessChallenge');
    if (panel) panel.hidden = true;

    callback(value);
}

function assetChallengePanel() {
    let panel = document.getElementById('assetAccessChallenge');
    if (!panel) {
        panel = document.createElement('aside');
        panel.id = 'assetAccessChallenge';
        panel.className = 'asset-access-challenge';
        const title = document.createElement('strong');
        title.setAttribute('role', 'status');
        title.setAttribute('aria-live', 'polite');
        const hint = document.createElement('p');
        const holder = document.createElement('div');
        holder.id = 'assetAccessTurnstile';
        panel.append(title, hint, holder);
        (document.querySelector('.map') || document.body).appendChild(panel);
    }
    panel.querySelector('strong').textContent = assetAccessText(
        'assetAccessVerificationTitle', 'Verify to load the map'
    );
    panel.querySelector('p').textContent = assetAccessText(
        'assetAccessVerificationHint', 'Complete the check below to continue loading.'
    );
    return panel;
}

function setAssetChallengeInteractive(interactive) {
    const panel = document.getElementById('assetAccessChallenge');
    if (!panel) return;
    panel.classList.toggle('is-interactive', interactive);
    panel.querySelector('strong').hidden = !interactive;
    panel.querySelector('p').hidden = !interactive;
}

async function requestAssetChallenge() {
    const challenge =
        assetChallengeConfig();

    if (
        challenge.enabled !== true ||
        typeof challenge.siteKey !== 'string' ||
        !challenge.siteKey.trim()
    ) {
        throw new Error(
            'turnstile-not-configured'
        );
    }

    ASSET_ACCESS_STATE.stage = 'turnstile-script';
    await loadAssetTurnstile();

    if (
        !window.turnstile ||
        typeof window.turnstile.render !== 'function' ||
        typeof window.turnstile.execute !== 'function'
    ) {
        throw new Error(
            'turnstile-unavailable'
        );
    }

    ASSET_ACCESS_STATE.stage = 'turnstile-challenge';
    const panel = assetChallengePanel();
    setAssetChallengeInteractive(false);
    // Let Turnstile control its own visibility while running automatically.
    // The panel is styled and announced only if interaction is required.
    panel.hidden = false;

    return new Promise((resolve, reject) => {
        ASSET_ACCESS_STATE.challengeResolve = resolve;
        ASSET_ACCESS_STATE.challengeReject = reject;
        ASSET_ACCESS_STATE.challengeTimer = window.setTimeout(
            () => settleAssetChallenge('reject', new Error('turnstile-timeout')),
            ASSET_CHALLENGE_TIMEOUT_MS
        );
        try {
            if (ASSET_ACCESS_STATE.turnstileWidget === null) {
                ASSET_ACCESS_STATE.turnstileWidget = window.turnstile.render(
                    '#assetAccessTurnstile',
                    {
                        sitekey:
                            challenge.siteKey,
                        action:
                            challenge.action ||
                            'asset-session',
                        execution: 'execute',
                        appearance: 'interaction-only',
                        size: 'compact',
                        'response-field': false,
                        retry: 'never',
                        'refresh-expired': 'manual',
                        'refresh-timeout': 'manual',
                        callback: token =>
                            settleAssetChallenge(
                                'resolve',
                                token
                            ),
                        'error-callback': code =>
                            settleAssetChallenge(
                                'reject',
                                new Error(
                                    /^\d{3,8}$/.test(String(code))
                                        ? `turnstile-${code}` : 'turnstile-unavailable'
                                )
                            ),
                        'expired-callback': () =>
                            settleAssetChallenge(
                                'reject',
                                new Error(
                                    'turnstile-expired'
                                )
                            ),
                        'before-interactive-callback': () => {
                            if (ASSET_ACCESS_STATE.challengeResolve) setAssetChallengeInteractive(true);
                        },
                        'after-interactive-callback': () => setAssetChallengeInteractive(false),
                        'timeout-callback': () => settleAssetChallenge('reject', new Error('turnstile-timeout')),
                        'unsupported-callback': () => settleAssetChallenge('reject', new Error('turnstile-unsupported'))
                    }
                );
            } else if (window.turnstile.reset) {
                window.turnstile.reset(ASSET_ACCESS_STATE.turnstileWidget);
            }
            window.turnstile.execute(ASSET_ACCESS_STATE.turnstileWidget);
        } catch (error) {
            settleAssetChallenge('reject', error);
        }
    });
}

async function parseAssetSessionResponse(response) {
    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw assetResponseError(
            response,
            data.error ||
            `asset-session-http-${response.status}`
        );
    }

    rememberAssetSession(data);
    return true;
}

async function probeAssetSession(stage = 'session-probe') {
    ASSET_ACCESS_STATE.stage = stage;
    const response =
        await fetch(
            assetSessionURL(),
            {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
                signal:
                    AbortSignal.timeout(ASSET_SESSION_TIMEOUT_MS)
            }
        );

    if (response.status === 401) {
        ASSET_ACCESS_STATE.regionalFallback =
            response.headers.get(
                'X-Wardogs-Asset-Fallback'
            ) === 'restricted';

        return false;
    }

    return parseAssetSessionResponse(
        response
    );
}

async function verifyDirectAssetAccess() {
    if (!usesPreclearanceAssetDelivery() || ASSET_ACCESS_STATE.mode !== 'standard') return;
    const path = getAssetGatewayConfig().probePath ||
        '/releases/assets-v1/maps/tiles/bakurani/zoom_0/0_0.webp';
    const url = new URL(path, getAssetDirectOrigin());
    if (url.origin !== getAssetDirectOrigin() ||
        !url.pathname.startsWith('/releases/assets-v1/') || url.search || url.hash) {
        throw new Error('asset-config-unavailable');
    }
    ASSET_ACCESS_STATE.stage = 'delivery-check';
    let response;
    try {
        // One body-free request per admission, shared by all tiles and terrain
        // callers. A signed Worker session is not proof of R2 pre-clearance.
        response = await fetch(url.href, {
            method: 'HEAD', credentials: 'include', cache: 'no-store',
            referrerPolicy: 'no-referrer', redirect: 'error',
            signal: AbortSignal.timeout(ASSET_SESSION_TIMEOUT_MS)
        });
    } catch (error) {
        error.requiresVerification = true;
        throw assetFailureContext(error, 'delivery-check', url.href);
    }
    if (!response.ok) {
        const error = assetResponseError(response);
        error.requiresVerification = response.status === 401 || response.status === 403;
        if (error.requiresVerification) error.message = 'asset-clearance-required';
        throw assetFailureContext(error, 'delivery-check', url.href);
    }
    if (response.headers.get('cf-mitigated') === 'challenge' ||
        !/^image\/webp(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
        const error = new Error('asset-clearance-required');
        error.requiresVerification = true;
        throw assetFailureContext(error, 'delivery-check', url.href);
    }
    ASSET_ACCESS_STATE.directVerified = true;
    ASSET_ACCESS_STATE.verificationRequired = false;
}

async function createAssetSession() {
    let challengeToken = '';

    if (!ASSET_ACCESS_STATE.regionalFallback) {
        challengeToken =
            await requestAssetChallenge();
    }

    ASSET_ACCESS_STATE.stage = 'session-create';
    const response =
        await fetch(
            assetSessionURL(),
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    token: challengeToken
                }),
                credentials: 'include',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
                signal:
                    AbortSignal.timeout(ASSET_SESSION_TIMEOUT_MS)
            }
        );

    await parseAssetSessionResponse(response);
    if (ASSET_ACCESS_STATE.mode === 'restricted' &&
        !await probeAssetSession('session-confirm')) {
        const error = new Error('session-cookie-unavailable');
        error.status = 401;
        throw error;
    }
    await verifyDirectAssetAccess();
    return true;
}

async function ensureAssetAccess({
    force = false
} = {}) {
    const configurationFailed = typeof APP_CONFIG_LOAD_STATE === 'object' && APP_CONFIG_LOAD_STATE.failed;
    if (!configurationFailed && !isAssetGatewayEnabled()) {
        return true;
    }

    if (isAssetAccessPaused()) {
        return false;
    }

    if (ASSET_ACCESS_STATE.pending) {
        return ASSET_ACCESS_STATE.pending;
    }

    if (!force && hasValidAssetAccess()) {
        return true;
    }

    ASSET_ACCESS_STATE.pending =
        (async () => {
            if (configurationFailed) {
                ASSET_ACCESS_STATE.stage = 'app-config';
                if (!await loadAppConfig()) throw new Error('asset-config-unavailable');
                if (!isAssetGatewayEnabled()) return true;
            }
            // Re-probe even on a forced refresh: the connection/region may
            // have changed, and the server decides the permitted delivery path.
            const reused = await probeAssetSession();

            // After a full-page challenge, test its real result before running
            // another embedded widget that might replace the working clearance.
            if (reused && ASSET_ACCESS_STATE.verificationReturn && usesPreclearanceAssetDelivery() &&
                ASSET_ACCESS_STATE.mode === 'standard') {
                ASSET_ACCESS_STATE.verificationReturn = false;
                await verifyDirectAssetAccess();
                ASSET_ACCESS_STATE.stage = 'ready';
                return true;
            }
            ASSET_ACCESS_STATE.verificationReturn = false;

            if (
                reused &&
                (!usesPreclearanceAssetDelivery() ||
                    ASSET_ACCESS_STATE.mode === 'restricted')
            ) {
                ASSET_ACCESS_STATE.stage = 'ready';
                return true;
            }

            const created = await createAssetSession();
            ASSET_ACCESS_STATE.stage = 'ready';
            return created;
        })()
            .catch(error => {
                ASSET_ACCESS_STATE.expiresAt = 0;
                ASSET_ACCESS_STATE.directVerified = false;
                ASSET_ACCESS_STATE.mode = '';
                clearAssetRefreshTimer();
                pauseAssetAccess(assetFailureContext(error, error.stage || ASSET_ACCESS_STATE.stage,
                    error.requestHost ? '' : ASSET_ACCESS_STATE.stage === 'app-config' ? document.baseURI : getAssetGatewayOrigin()), error.response);

                console.warn(
                    '[asset-access] Protected map assets are unavailable.',
                    error
                );

                return false;
            })
            .finally(() => {
                ASSET_ACCESS_STATE.pending = null;
                updateAssetAccessNotice();
            });

    updateAssetAccessNotice();
    return ASSET_ACCESS_STATE.pending;
}

function refreshAssetAccess() {
    return ensureAssetAccess({
        force: true
    });
}

async function recoverAssetAccessAfterFailure() {
    if (!isAssetGatewayEnabled() || isAssetAccessPaused()) {
        return false;
    }

    if (ASSET_ACCESS_STATE.pending) {
        return ASSET_ACCESS_STATE.pending;
    }

    const now = Date.now();

    if (
        now -
            ASSET_ACCESS_STATE.lastFailureRefresh <
        30000
    ) {
        return hasValidAssetAccess();
    }

    ASSET_ACCESS_STATE.lastFailureRefresh = now;
    ASSET_ACCESS_STATE.expiresAt = 0;
    return refreshAssetAccess();
}

async function fetchAssetResource(
    input,
    options = {}
) {
    const sourceUrl =
        new URL(
            input,
            document.baseURI
        ).href;

    if (!isProtectedAssetURL(sourceUrl)) {
        return fetch(
            sourceUrl,
            options
        );
    }

    if (!await ensureAssetAccess()) {
        throw assetAccessBlockedError();
    }

    if (isAssetAccessPaused()) {
        throw assetAccessBlockedError();
    }

    const requestOptions = {
        ...options,
        credentials: 'include',
        referrerPolicy: 'no-referrer'
    };
    const generation = ASSET_ACCESS_STATE.failureGeneration;

    let requestUrl =
        resolveProtectedAssetURL(
            sourceUrl
        );

    let response;

    try {
        response =
            await fetch(
                requestUrl,
                requestOptions
            );
    } catch (error) {
        if (error.name === 'AbortError' || options.signal?.aborted) {
            throw error;
        }
        // A WAF response without CORS headers also appears as a network
        // error. Do not launch new challenges or immediate request loops.
        // Re-check admission after the shared cooldown. A CORS-blocked WAF
        // response cannot be distinguished from a transport failure here.
        invalidateAssetSession();
        throw pauseAssetAccess(assetFailureContext(error, 'asset-fetch', requestUrl));
    }

    if (
        response.status === 401 ||
        response.status === 403
    ) {
        if (await recoverAssetAccessAfterFailure()) {
            if (isAssetAccessPaused()) {
                throw assetAccessBlockedError();
            }
            requestUrl =
                resolveProtectedAssetURL(
                    sourceUrl
                );

            try {
                response = await fetch(requestUrl, requestOptions);
            } catch (error) {
                if (error.name === 'AbortError' || options.signal?.aborted) {
                    throw error;
                }
                invalidateAssetSession();
                throw pauseAssetAccess(assetFailureContext(error, 'asset-fetch', requestUrl));
            }
        } else if (isAssetAccessPaused()) {
            throw assetAccessBlockedError();
        }
    }

    if (
        response.status === 401 || response.status === 403 ||
        response.status === 408 || response.status === 425 ||
        response.status === 429 || response.status >= 500
    ) {
        throw pauseAssetAccess(assetFailureContext(assetResponseError(response), 'asset-fetch', requestUrl), response);
    }

    if (response.ok && generation === ASSET_ACCESS_STATE.failureGeneration) {
        clearAssetAccessFailure();
    }

    return response;
}

async function initializeAssetAccess() {
    restoreAssetVerificationReturn();
    showLocalAssetWarning();
    initializeAssetAccessRecovery();
    return ensureAssetAccess();
}

;

/* js/ui/asset-progress.js */
/* =========================
   MAP ASSET LOADING PROGRESS
   ========================= */

const ASSET_LOADING_PROGRESS = {
    resources: new Map(),
    timer: null,
    hideTimer: null,
    panel: null,
    context: '',
    wasBusy: false,
    showUntil: 0,
    completed: false
};

// Observe existing loads only. This UI must never fetch or prefetch assets.
function beginAssetLoadingProgress(key, { mapId = null, kind = 'assets' } = {}) {
    // Once startup finishes, later loads must never restart this indicator.
    if (ASSET_LOADING_PROGRESS.completed) return () => {};
    const task = { mapId, kind, state: 'loading' };
    ASSET_LOADING_PROGRESS.resources.set(key, task);
    queueAssetLoadingProgressUpdate();
    return (success = true) => {
        if (ASSET_LOADING_PROGRESS.completed ||
            ASSET_LOADING_PROGRESS.resources.get(key) !== task) return;
        task.state = success ? 'loaded' : 'failed';
        queueAssetLoadingProgressUpdate();
    };
}

async function trackAssetLoadingProgress(key, operation, options) {
    const finish = beginAssetLoadingProgress(key, options);
    try {
        const value = await operation();
        finish();
        return value;
    } catch (error) {
        finish(false);
        throw error;
    }
}

function assetLoadingMapId(url) {
    try {
        return new URL(url, document.baseURI).pathname
            .match(/\/data\/terrain\/([^/]+)\//)?.[1] || null;
    } catch {
        return null;
    }
}

function getAssetLoadingProgress() {
    const mapId = typeof S === 'object' ? S.map : null;
    const style = typeof S === 'object' ? S.mapStyle : '';
    const tiles = typeof getVisibleTileLoadingProgress === 'function'
        ? getVisibleTileLoadingProgress() : { total: 0, loaded: 0, failed: 0 };
    const tasks = [...ASSET_LOADING_PROGRESS.resources.values()]
        .filter(task => !task.mapId || task.mapId === mapId);
    const pending = tasks.filter(task => task.state === 'loading');
    const total = tiles.total + tasks.length;
    const loaded = tiles.loaded + tasks.filter(task => task.state === 'loaded').length;
    const failed = tiles.failed + tasks.filter(task => task.state === 'failed').length;
    const waiting = total - loaded - failed;
    const access = typeof ASSET_ACCESS_STATE === 'object' ? ASSET_ACCESS_STATE : null;
    const initializing = document.documentElement.dataset.appInitState === 'loading';
    const preparing = Boolean(access?.pending);
    const busy = preparing || initializing || waiting > 0;
    const blocked = Boolean(access?.lastError);
    const percent = total > 0 ? Math.floor(loaded / total * 100) : 0;
    return {
        context: `${mapId || ''}:${style || ''}`,
        total, loaded, failed, waiting, busy, blocked,
        indeterminate: preparing || (busy && total === 0),
        percent: busy ? Math.min(99, percent) : percent,
        terrainOnly: waiting > 0 && tiles.total === tiles.loaded + tiles.failed &&
            pending.length > 0 && pending.every(task => task.kind === 'terrain')
    };
}

function queueAssetLoadingProgressUpdate() {
    if (ASSET_LOADING_PROGRESS.completed) return false;
    if (ASSET_LOADING_PROGRESS.timer !== null) return true;
    ASSET_LOADING_PROGRESS.timer = window.setTimeout(() => {
        ASSET_LOADING_PROGRESS.timer = null;
        updateAssetLoadingProgress();
    }, 100);
    return true;
}

function createAssetLoadingProgress() {
    const map = document.querySelector('.map');
    if (!map) return null;
    const panel = document.createElement('aside');
    panel.id = 'assetLoadingProgress';
    panel.className = 'asset-loading-progress';
    panel.hidden = true;

    const heading = document.createElement('div');
    heading.className = 'asset-loading-progress-heading';
    const title = document.createElement('strong');
    title.id = 'assetLoadingProgressTitle';
    title.setAttribute('role', 'status');
    title.setAttribute('aria-live', 'polite');
    title.setAttribute('aria-atomic', 'true');
    const percentage = document.createElement('span');
    percentage.className = 'asset-loading-progress-percentage';
    percentage.setAttribute('aria-hidden', 'true');
    heading.append(title, percentage);

    const bar = document.createElement('div');
    bar.className = 'asset-loading-progress-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-labelledby', title.id);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    for (const [name, className] of [
        ['ProgressBar_Background.svg', 'asset-loading-progress-background'],
        ['ProgressBar_Fill.svg', 'asset-loading-progress-fill']
    ]) {
        const image = document.createElement('img');
        image.src = resourceURL(`assets/ui/${name}`);
        image.className = className;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        image.draggable = false;
        bar.append(image);
    }
    const detail = document.createElement('small');
    detail.className = 'asset-loading-progress-detail';
    // Per-file updates stay outside the live region.
    detail.setAttribute('aria-hidden', 'true');
    panel.append(heading, bar, detail);
    map.append(panel);
    return { panel, title, percentage, bar, detail };
}

function updateAssetLoadingProgress() {
    const state = ASSET_LOADING_PROGRESS;
    const now = Date.now();
    if (state.completed) {
        if (now >= state.showUntil) {
            if (state.panel) state.panel.panel.hidden = true;
            state.resources.clear();
        }
        return;
    }
    const progress = getAssetLoadingProgress();
    if (progress.context !== state.context) {
        state.context = progress.context;
        state.wasBusy = false;
        state.showUntil = 0;
        window.clearTimeout(state.hideTimer);
    }
    // Admission errors already have a countdown and accessible retry button.
    if (progress.blocked) {
        if (state.panel) state.panel.panel.hidden = true;
        state.wasBusy = false;
        state.showUntil = 0;
        state.completed = true;
        state.resources.clear();
        window.clearTimeout(state.hideTimer);
        return;
    }
    if (progress.busy) {
        state.wasBusy = true;
        state.showUntil = 0;
        window.clearTimeout(state.hideTimer);
    } else if (state.wasBusy) {
        state.wasBusy = false;
        state.completed = true;
        const duration = progress.failed ? 3500 : 900;
        state.showUntil = now + duration;
        state.hideTimer = window.setTimeout(updateAssetLoadingProgress, duration);
    } else if (now >= state.showUntil) {
        state.completed = true;
        if (state.panel) state.panel.panel.hidden = true;
        state.resources.clear();
        return;
    }

    if (!state.panel) state.panel = createAssetLoadingProgress();
    if (!state.panel) return;
    const { panel, title, percentage, bar, detail } = state.panel;
    const text = typeof assetAccessText === 'function' ? assetAccessText : (_key, fallback) => fallback;
    const titleText = progress.indeterminate
        ? text('assetLoadingPreparing', 'Preparing the map…')
        : progress.busy
            ? progress.terrainOnly
                ? text('assetLoadingTerrain', 'Loading terrain data')
                : text('assetLoadingTitle', 'Loading map assets')
            : progress.failed
                ? text('assetLoadingPartial', 'Some assets could not be loaded')
                : text('assetLoadingReady', 'Map assets ready');
    if (title.textContent !== titleText) title.textContent = titleText;
    const percent = !progress.busy && !progress.failed ? 100 : progress.percent;
    percentage.textContent = progress.indeterminate ? '…' : `${percent}%`;
    panel.style.setProperty('--asset-loading-progress', `${percent}%`);
    panel.classList.toggle('is-indeterminate', progress.indeterminate);
    panel.classList.toggle('is-partial', !progress.busy && progress.failed > 0);
    const detailText = text('assetLoadingScope', 'Current view · {loaded}/{total} assets ready')
        .replace('{loaded}', String(progress.loaded)).replace('{total}', String(progress.total));
    detail.textContent = detailText;
    detail.hidden = progress.indeterminate || progress.total === 0;
    bar.setAttribute('aria-valuetext', progress.indeterminate ? titleText : `${percent}% · ${detailText}`);
    if (progress.indeterminate) bar.removeAttribute('aria-valuenow');
    else bar.setAttribute('aria-valuenow', String(percent));
    panel.hidden = false;
}

;

/* js/core/analytics.js */
/* =========================
   ANALYTICS
   ========================= */

/* GoatCounter receives fixed event paths, never arbitrary event properties. */
const ANALYTICS_QUEUE = [];
const ANALYTICS_MAX_QUEUE = 16;
const ANALYTICS_FLUSH_INTERVAL = 750;
const ANALYTICS_FLUSH_ATTEMPTS = 40;
const ANALYTICS_CALCULATION_DELAY = 900;
const ANALYTICS_CALCULATION_SAMPLE_RATE = 0.2;
const ANALYTICS_MAX_SESSION_KEYS = 128;
const ANALYTICS_SESSION_DEDUPE_KEY = 'wardogs-goatcounter-session-v1';
const ANALYTICS_SESSION_SAMPLE_KEY = 'wardogs-goatcounter-sample-v1';

const ANALYTICS_ALLOWED_EVENTS = new Set([
    'calculation', 'map-style-changed', 'target-saved', 'target-restored',
    'target-exported', 'targets-exported', 'targets-imported',
    'coordinate-search', 'fire-adjusted', 'terrain3d-toggle', 'contours-toggle',
    'ruler-used', 'drawing-created', 'zone-created', 'polygon-created',
    'user-marker-placed', 'map-changes-exported', 'map-changes-imported',
    'partner-click', 'donation-click', 'donation-dialog-opened',
    'feedback-opened', 'feedback-sent', 'feedback-failed', 'desktop-version',
    'lobby-opened', 'lobby-connected', 'lobby-failed', 'lobby-disconnected',
    'lobby-left', 'lobby-invite-copied', 'lobby-recovery-exported',
    'lobby-admission-fallback', 'client-error', 'map-load-failed',
    'asset-load-failed', 'terrain-load-failed', 'asset-access-failed',
    'asset-access-recovered', 'map-first-tiles-ready', 'app-config-failed'
]);
const ANALYTICS_REPEATABLE_EVENTS = new Set([
    'donation-click', 'partner-click', 'feedback-sent',
    'lobby-connected', 'lobby-left'
]);
const ANALYTICS_ACTION_TIMES = new Map();

let analyticsLastSentAt = -Infinity;
let analyticsFlushTimer = null;
let analyticsFlushAttempts = 0;
let analyticsCalculationTimer = null;
let analyticsCalculationInitialized = false;
let analyticsLastCalculationFingerprint = null;
let analyticsSessionKeys = loadAnalyticsSessionKeys();
let analyticsSessionSampleBucket = loadAnalyticsSessionSampleBucket();
let analyticsMapLayerHooksInstalled = false;

function getGoatCounterEventPath(name, data) {
    if (!ANALYTICS_ALLOWED_EVENTS.has(name)) return null;
    const parts = [name];
    const append = (value, allowed) => {
        if (allowed.includes(value)) parts.push(value);
    };
    append(data?.map, ['bakurani', 'ozeti', 'zestafona']);

    if (name === 'calculation') append(data?.weapon, ['mortar', 'spg']);
    if (name === 'map-style-changed') append(data?.style, ['grayscale', 'color']);
    if (name === 'donation-click') append(data?.service, ['ko-fi', 'boosty', 'buymeacoffee']);
    if (name === 'partner-click') append(data?.partner, ['wardogs-hub']);
    if (name === 'feedback-sent' || name === 'feedback-failed') {
        append(data?.type, ['bug', 'feature', 'general']);
    }
    if (name === 'lobby-connected') append(data?.method, ['create', 'join', 'reconnect']);
    if (name === 'lobby-failed') {
        append(data?.reason, ['invalid-invite', 'admission-limit', 'daily-limit',
            'rate-limited', 'security', 'connection']);
    }
    if (name === 'terrain3d-toggle' || name === 'contours-toggle') {
        if (typeof data?.enabled === 'boolean') parts.push(data.enabled ? 'on' : 'off');
    }
    if (name === 'asset-access-failed') {
        append(data?.phase, ['app-config', 'session-probe', 'turnstile-script',
            'turnstile-challenge', 'session-create', 'session-confirm', 'delivery-check', 'asset-fetch']);
        const code = String(data?.code || '');
        const category = /^turnstile-/.test(code) ? 'turnstile'
            : /^asset-(?:session-http-|http-)/.test(code) ? 'http'
                : code;
        append(category, ['turnstile', 'http', 'network-or-cors', 'timeout',
            'asset-clearance-required', 'asset-config-unavailable', 'session-cookie-unavailable']);
        const status = Number(data?.status);
        if ([401, 403, 408, 425, 429, 500, 502, 503, 504].includes(status)) {
            parts.push(String(status));
        }
    }
    if (name === 'app-config-failed') append(data?.recovery, ['embedded', 'pending']);
    return parts.join('/');
}

function loadAnalyticsSessionSampleBucket() {
    try {
        const raw =
            window.sessionStorage.getItem(
                ANALYTICS_SESSION_SAMPLE_KEY
            );
        const stored =
            raw === null || raw === ''
                ? NaN
                : Number(raw);

        if (
            Number.isFinite(stored) &&
            stored >= 0 &&
            stored < 1
        ) {
            return stored;
        }
    } catch (_) {
        // sessionStorage is optional.
    }

    const bucket = Math.random();

    try {
        window.sessionStorage.setItem(
            ANALYTICS_SESSION_SAMPLE_KEY,
            String(bucket)
        );
    } catch (_) {
        // Keep the page-lifetime bucket in memory.
    }

    return bucket;
}

function shouldSampleAnalyticsEvent(name) {
    if (name !== 'calculation') {
        return true;
    }

    return (
        analyticsSessionSampleBucket <
        ANALYTICS_CALCULATION_SAMPLE_RATE
    );
}

function loadAnalyticsSessionKeys() {
    try {
        const raw = window.sessionStorage.getItem(
            ANALYTICS_SESSION_DEDUPE_KEY
        );

        if (!raw) {
            return new Set();
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return new Set();
        }

        return new Set(
            parsed.filter(
                value => typeof value === 'string' &&
                    /^[-a-z0-9/]+$/.test(value) && value.length <= 120
            ).slice(-ANALYTICS_MAX_SESSION_KEYS)
        );

    } catch (_) {
        return new Set();
    }
}

function persistAnalyticsSessionKeys() {
    try {
        window.sessionStorage.setItem(
            ANALYTICS_SESSION_DEDUPE_KEY,
            JSON.stringify(
                Array.from(
                    analyticsSessionKeys
                )
            )
        );
    } catch (_) {
        // sessionStorage is optional.
    }
}

function shouldSuppressAnalyticsEvent(name, data) {
    const key = getGoatCounterEventPath(name, data);
    if (!key) return true;

    if (ANALYTICS_REPEATABLE_EVENTS.has(name)) {
        const now = Date.now();
        const previous = ANALYTICS_ACTION_TIMES.get(key);
        if (previous !== undefined && now - previous < 2000) return true;
        ANALYTICS_ACTION_TIMES.set(key, now);
        return false;
    }

    if (analyticsSessionKeys.has(key)) return true;
    if (analyticsSessionKeys.size >= ANALYTICS_MAX_SESSION_KEYS) return true;
    analyticsSessionKeys.add(key);
    persistAnalyticsSessionKeys();
    return false;
}

function isAnalyticsDisabled() {
    if (window.__WARDOGS_ANALYTICS_DISABLED__ === true) return true;
    const host = window.location.hostname;
    const allowLocal = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host) &&
        window.__WARDOGS_ANALYTICS_ALLOW_LOCAL__ === true;
    return host !== 'wardogs-artillery.com' && !allowLocal;
}

function isAnalyticsAvailable() {
    return Boolean(
        !isAnalyticsDisabled() &&
        window.__WARDOGS_GOATCOUNTER_READY__ === true &&
        typeof window.goatcounter?.count === 'function'
    );
}

function getAnalyticsBuildId() {
    try {
        if (
            typeof getStaticResourceVersion ===
                'function'
        ) {
            const version =
                getStaticResourceVersion();

            if (version) {
                return `ea-build-${version.slice(0, 32)}`;
            }
        }
    } catch (_) {
        // Build context is optional in development.
    }

    return 'dev';
}

function hashAnalyticsDiagnostic(value) {
    const text = String(value || '');

    if (!text) {
        return '';
    }

    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(
            hash,
            16777619
        );
    }

    return (hash >>> 0)
        .toString(16)
        .padStart(8, '0');
}

function normalizeClientErrorSource(value) {
    const raw = String(value || '').trim();

    if (!raw) {
        return '';
    }

    try {
        const url =
            new URL(
                raw,
                window.location.href
            );

        if (
            url.origin ===
                window.location.origin
        ) {
            const parts =
                url.pathname
                    .split('/')
                    .filter(Boolean);

            return parts
                .slice(-2)
                .join('/')
                .slice(0, 64);
        }

        return url.hostname
            .toLowerCase()
            .slice(0, 64);

    } catch (_) {
        return raw
            .split(/[?#]/, 1)[0]
            .slice(-64);
    }
}

function getClientErrorStackLocation(error) {
    const stack =
        String(
            error?.stack ||
            ''
        );

    if (!stack) {
        return {};
    }

    const match =
        stack.match(
            /((?:https?:\/\/|file:\/\/)[^\s)]+|[^\s()]+\.js(?:\?[^\s):]*)?):(\d+):(\d+)/i
        );

    if (!match) {
        return {};
    }

    return {
        source: match[1] || '',
        line: Number(match[2]) || 0,
        column: Number(match[3]) || 0
    };
}

function createClientErrorDiagnosticData(
    error,
    overrides = {}
) {
    const stackLocation =
        getClientErrorStackLocation(
            error
        );

    const message =
        overrides.message ??
        error?.message ??
        error?.reason?.message ??
        (
            typeof error === 'string'
                ? error
                : ''
        );

    const errorType =
        overrides.errorType ??
        error?.name ??
        error?.reason?.name ??
        (
            error == null
                ? 'unknown'
                : typeof error
        );

    const line =
        Number(
            overrides.line ??
            stackLocation.line
        );
    const column =
        Number(
            overrides.column ??
            stackLocation.column
        );

    return {
        phase:
            String(
                overrides.phase ||
                'runtime'
            ).slice(0, 32),
        errorType:
            String(
                errorType ||
                'unknown'
            ).slice(0, 32),
        source:
            normalizeClientErrorSource(
                overrides.source ||
                stackLocation.source ||
                ''
            ),
        line:
            Number.isFinite(line) && line > 0
                ? Math.round(line)
                : 0,
        column:
            Number.isFinite(column) && column > 0
                ? Math.round(column)
                : 0,
        messageHash:
            hashAnalyticsDiagnostic(
                message
            )
    };
}

function normalizeAnalyticsData(data) {
    const normalized = {};

    if (!data || typeof data !== 'object') {
        return undefined;
    }

    Object.entries(data)
        .forEach(([key, value]) => {
            if (
                value === null ||
                value === undefined
            ) {
                return;
            }

            if (
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean'
            ) {
                normalized[key] =
                    typeof value === 'string'
                        ? value.slice(0, 64)
                        : value;
            }
        });

    return Object.keys(normalized).length
        ? normalized
        : undefined;
}

function sendAnalyticsEvent(path) {
    if (!isAnalyticsAvailable() || Date.now() - analyticsLastSentAt < ANALYTICS_FLUSH_INTERVAL) {
        return false;
    }
    try {
        window.goatcounter.count({
            path,
            title: path,
            event: true,
            referrer: '',
            no_session: ANALYTICS_REPEATABLE_EVENTS.has(path.split('/')[0])
        });
        analyticsLastSentAt = Date.now();
        return true;
    } catch (_) {
        // A broken or blocked tracker cannot interrupt application features.
        window.__WARDOGS_ANALYTICS_DISABLED__ = true;
        return false;
    }
}

function stopAnalyticsFlush() {
    if (analyticsFlushTimer !== null) window.clearInterval(analyticsFlushTimer);
    analyticsFlushTimer = null;
}

function flushAnalyticsQueue() {
    if (isAnalyticsDisabled()) {
        ANALYTICS_QUEUE.length = 0;
        stopAnalyticsFlush();
        return;
    }
    if (!ANALYTICS_QUEUE.length) {
        stopAnalyticsFlush();
        return;
    }
    if (isAnalyticsAvailable()) {
        if (sendAnalyticsEvent(ANALYTICS_QUEUE[0])) ANALYTICS_QUEUE.shift();
        if (!ANALYTICS_QUEUE.length) stopAnalyticsFlush();
        return;
    }
    if (++analyticsFlushAttempts >= ANALYTICS_FLUSH_ATTEMPTS) {
        ANALYTICS_QUEUE.length = 0;
        stopAnalyticsFlush();
    }
}

function scheduleAnalyticsFlush() {
    if (analyticsFlushTimer !== null || isAnalyticsDisabled()) return;
    analyticsFlushAttempts = 0;
    analyticsFlushTimer = window.setInterval(flushAnalyticsQueue, ANALYTICS_FLUSH_INTERVAL);
}

function trackAnalytics(name, data = undefined) {
    if (isAnalyticsDisabled() || typeof name !== 'string') return;
    const normalizedName = name.trim();
    const normalizedData = normalizeAnalyticsData(data);
    const path = getGoatCounterEventPath(normalizedName, normalizedData);
    if (!path || !shouldSampleAnalyticsEvent(normalizedName) ||
        shouldSuppressAnalyticsEvent(normalizedName, normalizedData)) return;

    if (sendAnalyticsEvent(path)) return;
    if (isAnalyticsDisabled()) return;
    if (ANALYTICS_QUEUE.length >= ANALYTICS_MAX_QUEUE) ANALYTICS_QUEUE.shift();
    ANALYTICS_QUEUE.push(path);
    scheduleAnalyticsFlush();
}

const ANALYTICS_OPERATIONAL_EVENTS =
    new Set([
        'client-error',
        'map-load-failed',
        'asset-load-failed',
        'terrain-load-failed'
    ]);

function trackOperationalFailure(
    name,
    data = {}
) {
    if (
        !ANALYTICS_OPERATIONAL_EVENTS.has(
            name
        )
    ) {
        return;
    }

    const payload = {
        build: getAnalyticsBuildId()
    };

    [
        'area',
        'type',
        'map',
        'code',
        'resource',
        'origin',
        'phase',
        'errorType',
        'source',
        'messageHash'
    ].forEach(key => {
        if (
            typeof data?.[key] === 'string' &&
            data[key]
        ) {
            payload[key] = data[key];
        }
    });

    [
        'line',
        'column',
        'attempts'
    ].forEach(key => {
        const value = Number(data?.[key]);

        if (Number.isFinite(value) && value > 0) {
            payload[key] = Math.round(value);
        }
    });

    trackAnalytics(name, payload);
}

function classifyOperationalResource(target) {
    const tag =
        String(target?.tagName || '')
            .toLowerCase();
    const rawUrl =
        typeof target?.src === 'string' &&
        target.src
            ? target.src
            : typeof target?.href === 'string'
                ? target.href
                : '';

    if (!rawUrl) {
        return {
            resource:
                tag || 'unknown-resource',
            origin: 'unknown'
        };
    }

    try {
        const url =
            new URL(
                rawUrl,
                window.location.href
            );
        const host =
            url.hostname.toLowerCase();
        const path =
            url.pathname.toLowerCase();
        const sameOrigin =
            url.origin ===
            window.location.origin;
        const cloudflareHost =
            host === 'cloudflare.com' ||
            host.endsWith('.cloudflare.com') ||
            host === 'cloudflareinsights.com' ||
            host.endsWith('.cloudflareinsights.com');
        const turnstileResource =
            host === 'challenges.cloudflare.com' &&
            path.includes('/turnstile/');
        const cloudflareInsightsResource =
            host === 'static.cloudflareinsights.com' ||
            host.endsWith('.cloudflareinsights.com');
        const cloudflareChallengeResource =
            !turnstileResource &&
            (
                host === 'challenges.cloudflare.com' ||
                path.includes(
                    '/cdn-cgi/challenge-platform/'
                )
            );

        let origin = 'external';
        if (
            turnstileResource ||
            cloudflareInsightsResource ||
            cloudflareChallengeResource ||
            cloudflareHost
        ) {
            origin = 'cloudflare';
        } else if (sameOrigin) {
            origin = 'site';
        } else if (
            host ===
            'assets.wardogs-artillery.com'
        ) {
            origin = 'assets-cdn';
        } else if (
            host === 'gc.zgo.at' || host.endsWith('.goatcounter.com')
        ) {
            origin = 'analytics';
        }

        let resource =
            `${tag || 'unknown'}-resource`;

        if (tag === 'script') {
            if (
                path.includes(
                    '/js/features/terrain-ballistics.js'
                )
            ) {
                resource = 'terrain-runtime';
            } else if (
                sameOrigin &&
                path.includes('/js/')
            ) {
                resource = 'app-script';
            } else if (
                origin === 'analytics'
            ) {
                resource = 'analytics';
            } else if (turnstileResource) {
                resource = 'turnstile';
            } else if (cloudflareInsightsResource) {
                resource = 'cloudflare-insights';
            } else if (cloudflareChallengeResource) {
                resource = 'cloudflare-challenge';
            } else if (origin === 'cloudflare') {
                resource = 'cloudflare-other';
            } else {
                resource = 'external-script';
            }
        } else if (tag === 'link') {
            resource =
                path.endsWith('.css')
                    ? 'stylesheet'
                    : 'document-link';
        } else if (tag === 'img') {
            if (
                path.includes('/maps/tiles/')
            ) {
                resource = 'map-tile';
            } else if (
                path.includes(
                    '/assets/map-markers/'
                )
            ) {
                resource = 'map-marker';
            } else {
                resource = 'image';
            }
        }

        return {
            resource,
            origin
        };
    } catch {
        return {
            resource:
                `${tag || 'unknown'}-resource`,
            origin: 'unknown'
        };
    }
}

const ANALYTICS_IGNORED_RESOURCE_ORIGINS =
    new Set([
        'external',
        'cloudflare',
        'analytics'
    ]);

function isBrowserExtensionErrorSource(value) {
    const text = String(value || '');

    return /(?:chrome|moz|safari-web|ms-browser)-extension:\/\//i
        .test(text);
}

function shouldIgnoreWindowClientError(event) {
    const message =
        String(event?.message || '').trim();
    const source =
        String(event?.filename || '');
    const stack =
        String(event?.error?.stack || '');

    if (/^ResizeObserver loop/i.test(message)) {
        return true;
    }

    if (
        /^Script error\.?$/i.test(message) &&
        !source
    ) {
        return true;
    }

    return (
        isBrowserExtensionErrorSource(source) ||
        isBrowserExtensionErrorSource(stack)
    );
}

function shouldIgnoreUnhandledRejection(reason) {
    return isBrowserExtensionErrorSource(
        reason?.stack ||
        reason?.sourceURL ||
        ''
    );
}

function installOperationalErrorTelemetry() {
    window.addEventListener(
        'error',
        event => {
            const target =
                event?.target;

            if (
                target &&
                target !== window &&
                target.tagName
            ) {
                const classification =
                    classifyOperationalResource(
                        target
                    );

                if (
                    ANALYTICS_IGNORED_RESOURCE_ORIGINS.has(
                        classification.origin
                    )
                ) {
                    return;
                }

                trackOperationalFailure(
                    'asset-load-failed',
                    {
                        area: 'document',
                        type: String(
                            target.tagName
                        ).toLowerCase(),
                        code: 'resource-error',
                        resource:
                            classification.resource,
                        origin:
                            classification.origin
                    }
                );
                return;
            }

            if (shouldIgnoreWindowClientError(event)) {
                return;
            }

            const diagnostics =
                createClientErrorDiagnosticData(
                    event?.error,
                    {
                        phase: 'runtime',
                        source: event?.filename,
                        line: event?.lineno,
                        column: event?.colno,
                        message: event?.message
                    }
                );

            trackOperationalFailure(
                'client-error',
                {
                    area: 'window',
                    type: 'runtime',
                    code: 'uncaught-error',
                    ...diagnostics
                }
            );
        },
        true
    );

    window.addEventListener(
        'unhandledrejection',
        event => {
            const reason =
                event?.reason;

            if (shouldIgnoreUnhandledRejection(reason)) {
                return;
            }

            const diagnostics =
                createClientErrorDiagnosticData(
                    reason,
                    {
                        phase: 'promise',
                        message:
                            reason?.message ??
                            (
                                typeof reason === 'string'
                                    ? reason
                                    : ''
                            )
                    }
                );

            trackOperationalFailure(
                'client-error',
                {
                    area: 'window',
                    type: 'promise',
                    code: 'unhandled-rejection',
                    ...diagnostics
                }
            );
        }
    );
}

installOperationalErrorTelemetry();

/*
 * Keep analytics focused on bounded product usage and application failures.
 * Detailed performance and firing diagnostics stay in the local developer menu.
 */


function getCalculationFingerprint() {
    if (
        typeof S === 'undefined' ||
        !S.weapon
    ) {
        return null;
    }

    return [
        S.map,
        S.weapon,
        Number(S.origin.x).toFixed(4),
        Number(S.origin.y).toFixed(4),
        Number(S.target.x).toFixed(4),
        Number(S.target.y).toFixed(4)
    ].join('|');
}

function trackCalculationState(inRange) {
    const fingerprint =
        getCalculationFingerprint();

    if (!fingerprint) {
        return;
    }

    /*
     * The first rendered solution is the initial application
     * state, not a user calculation. Store it as the baseline
     * without emitting an event.
     */
    if (!analyticsCalculationInitialized) {
        analyticsCalculationInitialized = true;
        analyticsLastCalculationFingerprint =
            fingerprint;
        return;
    }

    if (
        fingerprint ===
        analyticsLastCalculationFingerprint
    ) {
        return;
    }

    if (analyticsCalculationTimer) {
        window.clearTimeout(
            analyticsCalculationTimer
        );
    }

    analyticsCalculationTimer =
        window.setTimeout(
            () => {
                const currentFingerprint =
                    getCalculationFingerprint();

                if (
                    !currentFingerprint ||
                    currentFingerprint ===
                    analyticsLastCalculationFingerprint
                ) {
                    return;
                }

                analyticsLastCalculationFingerprint =
                    currentFingerprint;

                trackAnalytics(
                    'calculation',
                    {
                        map: S.map,
                        weapon: S.weapon,
                        inRange: Boolean(inRange)
                    }
                );
            },
            ANALYTICS_CALCULATION_DELAY
        );
}


/* =========================
   V1.7 FEATURE TELEMETRY
   ========================= */

/*
 * Keep the new feature telemetry here instead of coupling tracker calls to
 * Terrain3D or Map Tools implementation details.
 *
 * Only explicit user actions are recorded. No coordinates, MIL values,
 * terrain height differences, candidate commands, or ballistic payload data
 * are sent.
 */

function getAnalyticsMapId() {
    return (
        typeof S === 'object' &&
        S &&
        typeof S.map === 'string'
    )
        ? S.map
        : '';
}

function handleAnalyticsFeatureChange(event) {
    const target =
        event?.target;

    if (
        !target ||
        target.id !==
            'experimentalTerrainCorrectionToggle'
    ) {
        return;
    }

    trackAnalytics(
        'terrain3d-toggle',
        {
            enabled:
                Boolean(
                    target.checked
                ),
            map:
                getAnalyticsMapId()
        }
    );
}

function installMapLayerAnalyticsHooks() {
    if (
        analyticsMapLayerHooksInstalled
    ) {
        return true;
    }

    if (
        typeof window.setMapLayerVisible !==
            'function' ||
        typeof window.setMapLayerGroupVisible !==
            'function'
    ) {
        return false;
    }

    const originalSetMapLayerVisible =
        window.setMapLayerVisible;

    const originalSetMapLayerGroupVisible =
        window.setMapLayerGroupVisible;

    window.setMapLayerVisible =
        function analyticsSetMapLayerVisible(
            layer,
            visible
        ) {
            const result =
                originalSetMapLayerVisible.apply(
                    this,
                    arguments
                );

            if (layer === 'contours') {
                trackAnalytics(
                    'contours-toggle',
                    {
                        enabled:
                            Boolean(
                                visible
                            ),
                        map:
                            getAnalyticsMapId()
                    }
                );
            }

            return result;
        };

    window.setMapLayerGroupVisible =
        function analyticsSetMapLayerGroupVisible(
            layerIds,
            visible
        ) {
            const result =
                originalSetMapLayerGroupVisible.apply(
                    this,
                    arguments
                );

            if (
                Array.isArray(layerIds) &&
                layerIds.includes(
                    'contours'
                )
            ) {
                trackAnalytics(
                    'contours-toggle',
                    {
                        enabled:
                            Boolean(
                                visible
                            ),
                        map:
                            getAnalyticsMapId()
                    }
                );
            }

            return result;
        };

    analyticsMapLayerHooksInstalled =
        true;

    return true;
}

function initializeAnalyticsFeatureTelemetry() {
    installMapLayerAnalyticsHooks();
}

document.addEventListener(
    'change',
    handleAnalyticsFeatureChange
);

document.addEventListener(
    'DOMContentLoaded',
    initializeAnalyticsFeatureTelemetry,
    {
        once: true
    }
);

window.addEventListener(
    'load',
    initializeAnalyticsFeatureTelemetry,
    {
        once: true
    }
);

window.addEventListener(
    'load',
    flushAnalyticsQueue,
    { once: true }
);

window.addEventListener('wardogs-analytics-ready', flushAnalyticsQueue);

// Static mobile partner links use the same bounded wrapper as generated links.
document.addEventListener('click', event => {
    const link = event.target?.closest?.('[data-analytics-event]');
    if (!link) return;
    trackAnalytics(link.dataset.analyticsEvent, {
        partner: link.dataset.analyticsEventPartner
    });
});

;

/* js/core/file-transfer.js */
/* =========================
   JSON FILE TRANSFER
   ========================= */

const WARDOGS_JSON_MAX_BYTES = 1024 * 1024;

function wardogsExportTimestamp() {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .replace('Z', '');
}

function sanitizeWardogsFilenamePart(
    value,
    fallback = 'export'
) {
    const normalized = String(value || '')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

    return normalized || fallback;
}

function downloadWardogsJson(
    filename,
    payload
) {
    const json = JSON.stringify(
        payload,
        null,
        2
    );

    const blob = new Blob(
        [json],
        {
            type: 'application/json;charset=utf-8'
        }
    );

    const url = URL.createObjectURL(
        blob
    );

    const link =
        document.createElement('a');

    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(
        () => URL.revokeObjectURL(url),
        0
    );
}

function selectWardogsJsonFile() {
    return new Promise(resolve => {
        const input =
            document.createElement('input');

        let settled = false;

        const finish = file => {
            if (settled) {
                return;
            }

            settled = true;
            window.removeEventListener(
                'focus',
                handleWindowFocus
            );
            input.remove();
            resolve(file || null);
        };

        const handleWindowFocus = () => {
            window.setTimeout(
                () => {
                    if (
                        !settled &&
                        !input.files?.length
                    ) {
                        finish(null);
                    }
                },
                250
            );
        };

        input.type = 'file';
        input.accept =
            '.json,application/json,text/json';
        input.style.display = 'none';

        input.addEventListener(
            'change',
            () => finish(
                input.files?.[0] || null
            ),
            { once: true }
        );

        input.addEventListener(
            'cancel',
            () => finish(null),
            { once: true }
        );

        window.addEventListener(
            'focus',
            handleWindowFocus,
            { once: true }
        );

        document.body.appendChild(input);
        input.click();
    });
}

async function readWardogsJsonFile(file) {
    if (!file) {
        return null;
    }

    if (!Number.isFinite(file.size) || file.size > WARDOGS_JSON_MAX_BYTES) {
        throw new Error('wardogs-json-file-too-large');
    }

    const text = await file.text();
    return JSON.parse(text);
}

;

/* js/ui/i18n.js */
/* =========================
   LANGUAGES
   ========================= */

const LANGUAGE_STORAGE_KEY =
    'wardogs-language';

let languagePickerBound =
    false;

async function loadLanguages() {

    const index =
        await fetchJSON(
            'locales/index.json'
        );

    DEFAULT_LANG =
        index.default || 'en';

    LANGUAGES =
        Array.isArray(index.languages)
            ? index.languages
            : [];

    if (!LANGUAGES.length) {
        throw new Error(
            'No languages found in locales/index.json'
        );
    }

    /*
     * Pick the active language from the lightweight index first. The picker
     * navigates to dedicated locale URLs, so startup only needs the active
     * catalog plus the default fallback instead of downloading every locale.
     */
    LANG =
        detectLanguage();

    const startupLanguages =
        new Set([
            DEFAULT_LANG,
            LANG
        ]);

    await Promise.all(
        LANGUAGES
            .filter(
                language =>
                    startupLanguages.has(
                        language.id
                    )
            )
            .map(
                async language => {

                    if (
                        !language.id ||
                        !language.file
                    ) {
                        return;
                    }

                    I18N[language.id] =
                        await fetchJSON(
                            `locales/${language.file}`
                        );
                }
            )
    );

    populateLanguageSelect();

    $('language').value =
        LANG;

    buildLanguagePicker();
}

function populateLanguageSelect() {

    const select =
        $('language');

    select.innerHTML = '';

    LANGUAGES.forEach(
        language => {

            const option =
                document.createElement(
                    'option'
                );

            option.value =
                language.id;

            /*
             * Keep the native fallback free of flag emoji.
             * Windows/Chrome does not reliably render
             * regional-indicator flag glyphs.
             */
            option.textContent =
                language.nativeName ||
                language.name ||
                language.id;

            select.appendChild(
                option
            );
        }
    );
}

function getSavedLanguage(
    available
) {

    try {

        const saved =
            localStorage.getItem(
                LANGUAGE_STORAGE_KEY
            );

        return (
            saved &&
            available.has(saved)
        )
            ? saved
            : null;

    } catch (error) {

        return null;
    }
}

function getBrowserLanguage(
    available
) {

    const browserLanguages =
        navigator.languages &&
        navigator.languages.length
            ? navigator.languages
            : [navigator.language];

    for (
        const language
        of browserLanguages
    ) {

        if (!language) {
            continue;
        }

        const normalized =
            String(language)
                .toLowerCase();

        if (
            available.has(
                normalized
            )
        ) {
            return normalized;
        }

        const base =
            normalized.split('-')[0];

        if (
            available.has(base)
        ) {
            return base;
        }
    }

    return null;
}

function detectLanguage() {

    const available =
        new Set(
            LANGUAGES.map(
                language =>
                    language.id
            )
        );

    /*
     * A language explicitly selected by the user
     * always wins and persists between sessions.
     */
    const saved =
        getSavedLanguage(
            available
        );

    if (saved) {
        return saved;
    }

    const pageLanguage =
        document.documentElement
            .dataset.pageLanguage;

    /*
     * On the root entry page use the browser /
     * operating-system locale automatically.
     *
     * Dedicated SEO language URLs (/ru/, /de/, ...)
     * keep their declared language when opened
     * directly, unless the user has already saved
     * another preference.
     */
    const isDefaultEntryPage =
        !pageLanguage ||
        pageLanguage ===
        DEFAULT_LANG;

    if (isDefaultEntryPage) {

        const browserLanguage =
            getBrowserLanguage(
                available
            );

        if (browserLanguage) {
            return browserLanguage;
        }
    }

    if (
        pageLanguage &&
        available.has(
            pageLanguage
        )
    ) {
        return pageLanguage;
    }

    const browserLanguage =
        getBrowserLanguage(
            available
        );

    if (browserLanguage) {
        return browserLanguage;
    }

    return available.has(DEFAULT_LANG)
        ? DEFAULT_LANG
        : LANGUAGES[0].id;
}

function getLanguageDefinition(
    languageId
) {

    return LANGUAGES.find(
        language =>
            language.id ===
            languageId
    ) || null;
}

function createLanguageFlag(
    language
) {

    if (!language) {
        return null;
    }

    if (language.flagAsset) {

        const image =
            document.createElement(
                'img'
            );

        image.className =
            'language-flag';

        image.src =
            resourceURL(
                language.flagAsset
            );

        image.alt =
            '';

        image.width =
            20;

        image.height =
            14;

        image.setAttribute(
            'aria-hidden',
            'true'
        );

        return image;
    }

    const fallback =
        document.createElement(
            'span'
        );

    fallback.className =
        'language-flag language-flag-text';

    fallback.textContent =
        language.shortLabel ||
        language.id.toUpperCase();

    fallback.setAttribute(
        'aria-hidden',
        'true'
    );

    return fallback;
}

function updateLanguagePicker() {

    const button =
        $('languagePickerButton');

    if (!button) {
        return;
    }

    const language =
        getLanguageDefinition(
            LANG
        );

    if (!language) {
        return;
    }

    button.innerHTML = '';

    const flag =
        createLanguageFlag(
            language
        );

    if (flag) {
        button.appendChild(flag);
    }

    const name =
        document.createElement(
            'span'
        );

    name.className =
        'language-picker-current-name';

    name.textContent =
        language.nativeName ||
        language.name ||
        language.id;

    button.appendChild(name);

    const arrow =
        document.createElement(
            'span'
        );

    arrow.className =
        'language-picker-arrow';

    arrow.textContent =
        '▾';

    arrow.setAttribute(
        'aria-hidden',
        'true'
    );

    button.appendChild(arrow);

    button.setAttribute(
        'aria-label',
        language.name ||
        language.nativeName ||
        language.id
    );

    document
        .querySelectorAll(
            '.language-picker-option'
        )
        .forEach(option => {

            option.classList.toggle(
                'active',
                option.dataset.language ===
                LANG
            );

            option.setAttribute(
                'aria-selected',
                option.dataset.language === LANG
                    ? 'true'
                    : 'false'
            );
        });
}

function closeLanguagePicker() {

    const picker =
        $('languagePicker');

    const button =
        $('languagePickerButton');

    if (!picker) {
        return;
    }

    picker.classList.remove(
        'open'
    );

    button?.setAttribute(
        'aria-expanded',
        'false'
    );
}

function buildLanguagePicker() {

    const select =
        $('language');

    if (!select) {
        return;
    }

    let picker =
        $('languagePicker');

    if (!picker) {

        picker =
            document.createElement(
                'div'
            );

        picker.id =
            'languagePicker';

        picker.className =
            'language-picker';

        const button =
            document.createElement(
                'button'
            );

        button.id =
            'languagePickerButton';

        button.type =
            'button';

        button.className =
            'language-picker-button';

        button.setAttribute(
            'aria-haspopup',
            'listbox'
        );

        button.setAttribute(
            'aria-expanded',
            'false'
        );

        const menu =
            document.createElement(
                'div'
            );

        menu.id =
            'languagePickerMenu';

        menu.className =
            'language-picker-menu';

        menu.setAttribute(
            'role',
            'listbox'
        );

        picker.append(
            button,
            menu
        );

        select.insertAdjacentElement(
            'beforebegin',
            picker
        );
    }

    const menu =
        $('languagePickerMenu');

    menu.innerHTML = '';

    LANGUAGES.forEach(
        language => {

            const option =
                document.createElement(
                    'button'
                );

            option.type =
                'button';

            option.className =
                'language-picker-option';

            option.dataset.language =
                language.id;

            option.setAttribute(
                'role',
                'option'
            );

            const flag =
                createLanguageFlag(
                    language
                );

            if (flag) {
                option.appendChild(flag);
            }

            const name =
                document.createElement(
                    'span'
                );

            name.textContent =
                language.nativeName ||
                language.name ||
                language.id;

            option.appendChild(name);

            option.addEventListener(
                'click',
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    select.value =
                        language.id;

                    closeLanguagePicker();

                    select.dispatchEvent(
                        new Event(
                            'change',
                            {
                                bubbles:
                                    true
                            }
                        )
                    );
                }
            );

            menu.appendChild(
                option
            );
        }
    );

    /*
     * Keep the native select as a functional,
     * accessible fallback without displaying it.
     */
    select.classList.add(
        'language-select-native'
    );

    if (!languagePickerBound) {

        $('languagePickerButton')
            ?.addEventListener(
                'click',
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    const isOpen =
                        picker.classList
                            .toggle(
                                'open'
                            );

                    $('languagePickerButton')
                        ?.setAttribute(
                            'aria-expanded',
                            isOpen
                                ? 'true'
                                : 'false'
                        );
                }
            );

        document.addEventListener(
            'click',
            event => {

                if (
                    !picker.contains(
                        event.target
                    )
                ) {
                    closeLanguagePicker();
                }
            }
        );

        document.addEventListener(
            'keydown',
            event => {

                if (
                    event.key ===
                    'Escape'
                ) {
                    closeLanguagePicker();
                }
            }
        );

        languagePickerBound =
            true;
    }

    updateLanguagePicker();
}

function tr(key) {

    const language =
        I18N[LANG];

    const fallback =
        I18N[DEFAULT_LANG];

    return (
        language?.[key] ??
        fallback?.[key] ??
        key
    );
}

function getLanguagePageURL(languageId) {

    const siteRoot =
        new URL(
            './',
            document.baseURI
        );

    const mobileApp =
        document.body.classList.contains(
            'mobile-app'
        );

    const interfaceRoot =
        mobileApp
            ? new URL(
                'mobile/',
                siteRoot
            )
            : siteRoot;

    if (languageId === DEFAULT_LANG) {
        return interfaceRoot.href;
    }

    return new URL(
        `${languageId}/`,
        interfaceRoot
    ).href;
}

function switchLanguage(languageId) {

    try {

        localStorage.setItem(
            LANGUAGE_STORAGE_KEY,
            languageId
        );

    } catch (error) {

        console.warn(
            'Failed to save language preference:',
            error
        );
    }

    window.location.href =
        getLanguagePageURL(
            languageId
        );
}

function applyStaticLanguage() {
    document.documentElement.lang =
        LANG;

    document
        .querySelectorAll('[data-i18n]')
        .forEach(element => {
            const translated =
                tr(
                    element.dataset.i18n
                );

            /*
             * Avoid recreating identical text nodes during the later full UI
             * sync. Rewriting visible text can create a fresh late LCP entry.
             */
            if (
                element.textContent !==
                translated
            ) {
                element.textContent =
                    translated;
            }
        });

    $('language').value =
        LANG;

    updateLanguagePicker();
    updateThemeButton();
}

function applyLanguage() {
    lobby?.updateUI();

    applyStaticLanguage();

    syncMapStyleSelect();
    updateControlZoneSelect();

    if (
        typeof populateWeaponSelect ===
            'function' &&
        Object.keys(WEAPONS).length
    ) {
        populateWeaponSelect();
    }

    renderSavedTargets();

    if (
        typeof updateMapToolsLocalization ===
        'function'
    ) {
        updateMapToolsLocalization();
    }

    if (
        typeof updatePointLocksUI ===
        'function'
    ) {
        updatePointLocksUI();
    }

    if (
        typeof updateLayoutLocalization ===
        'function'
    ) {
        updateLayoutLocalization();
    }

    if (
        typeof syncAccessibilityLocalization ===
        'function'
    ) {
        syncAccessibilityLocalization();
    }

    if (typeof updateAssetAccessNotice === 'function') {
        updateAssetAccessNotice();
    }

    if (typeof syncDeveloperLocalization === 'function') {
        syncDeveloperLocalization();
    }

    if (
        typeof updateMotdLocalization ===
        'function'
    ) {
        updateMotdLocalization();
    }

    if (
        typeof updateMobileDesktopLink ===
        'function'
    ) {
        updateMobileDesktopLink();
    }

    result();
    draw();
}

;

/* js/ui/theme.js */
/* =========================
   THEME
   ========================= */

function getTheme() {

    const saved =
        localStorage.getItem(
            'wardogs-theme'
        );

    if (
        saved === 'light' ||
        saved === 'dark'
    ) {
        return saved;
    }

    return 'dark';
}

function loadTheme() {
    applyTheme(
        getTheme()
    );
}

function applyTheme(theme) {

    const root =
        document.documentElement;

    const isLight =
        theme === 'light';

    if (isLight) {
        root.dataset.theme =
            'light';
    } else {
        delete root.dataset.theme;
    }

    localStorage.setItem(
        'wardogs-theme',
        isLight
            ? 'light'
            : 'dark'
    );

    updateThemeButton();
    draw();
}

function updateThemeButton() {

    const icon =
        $('themeIcon');

    if (!icon) {
        return;
    }

    const isLight =
        document.documentElement
            .dataset.theme === 'light';

    icon.textContent =
        isLight
            ? '☾'
            : '☼';

    const label =
        typeof tr === 'function'
            ? tr(
                isLight
                    ? 'switchToDarkTheme'
                    : 'switchToLightTheme'
            )
            : (
                isLight
                    ? 'Switch to dark theme'
                    : 'Switch to light theme'
            );

    $('themeToggle').setAttribute(
        'aria-label',
        label
    );

    $('themeToggle').title =
        label;
}

function toggleTheme() {

    const current =
        document.documentElement
            .dataset.theme === 'light'
            ? 'light'
            : 'dark';

    applyTheme(
        current === 'light'
            ? 'dark'
            : 'light'
    );
}

;

/* js/ui/footer.js */
/* =========================
   FOOTER
   ========================= */

const FOOTER_PARTNERS = [

];

const DONATION_LINKS = [
    {
        id: 'ko-fi',
        labelKey: 'supportViaKoFi',
        url: 'https://ko-fi.com/D3J32528AD',
        icon: `
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M4 7h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7Z"></path>
                <path d="M17 9h1.25a2.75 2.75 0 0 1 0 5.5H17"></path>
                <path d="M8 10.2c.8-.9 2.1-.4 2.5.4.4-.8 1.7-1.3 2.5-.4 1.2 1.3-.4 2.7-2.5 4.1-2.1-1.4-3.7-2.8-2.5-4.1Z"></path>
            </svg>
        `
    },
    {
        id: 'boosty',
        labelKey: 'supportViaBoosty',
        url: 'https://boosty.to/apollyonsys/donate',
        icon: `
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M13.5 2 5 13h6l-1 9 9-12h-6l.5-8Z"></path>
            </svg>
        `
    }
];

const DONATION_PARAGRAPH_KEYS = [
    'supportStatementGrowth',
    'supportStatementFree',
    'supportStatementInvite',
    'supportStatementCosts',
    'supportStatementContinuity'
];

let donationDialog = null;

function appendDonationRichText(
    element,
    value
) {
    const parts =
        String(value || '')
            .split(/(\*\*[^*]+\*\*)/g)
            .filter(Boolean);

    parts.forEach(part => {
        if (
            part.startsWith('**') &&
            part.endsWith('**')
        ) {
            const strong =
                document.createElement(
                    'strong'
                );

            strong.textContent =
                part.slice(2, -2);

            element.appendChild(
                strong
            );
            return;
        }

        element.appendChild(
            document.createTextNode(
                part
            )
        );
    });
}

function createDonationLink(
    donation,
    placement
) {
    const link =
        document.createElement(
            'a'
        );

    const label =
        typeof tr === 'function'
            ? tr(donation.labelKey)
            : donation.id;

    link.className =
        `donation-provider-link donation-provider-link-${donation.id}`;

    link.href =
        donation.url;

    link.target =
        '_blank';

    link.rel =
        'noopener noreferrer';

    link.setAttribute(
        'aria-label',
        label
    );

    const icon =
        document.createElement(
            'span'
        );

    icon.className =
        'donation-provider-icon';

    icon.innerHTML =
        donation.icon;

    const labelElement =
        document.createElement(
            'span'
        );

    labelElement.className =
        'donation-provider-label';

    labelElement.textContent =
        label;

    link.append(
        icon,
        labelElement
    );

    link.addEventListener(
        'click',
        () => {
            if (
                typeof trackAnalytics ===
                'function'
            ) {
                const currentPlacement =
                    link
                        .closest(
                            '.donation-dialog'
                        )
                        ?.dataset
                        .donationPlacement ||
                    placement;

                trackAnalytics(
                    'donation-click',
                    {
                        service:
                            donation.id,

                        placement:
                            currentPlacement
                    }
                );
            }
        }
    );

    return link;
}

function ensureDonationDialog(
    placement = 'footer'
) {
    if (donationDialog?.isConnected) {
        donationDialog.dataset
            .donationPlacement =
            placement;
        return donationDialog;
    }

    const dialog =
        document.createElement(
            'dialog'
        );

    dialog.className =
        'donation-dialog';

    dialog.dataset
        .donationPlacement =
        placement;

    dialog.setAttribute(
        'aria-labelledby',
        'donationDialogTitle'
    );

    const shell =
        document.createElement(
            'div'
        );

    shell.className =
        'donation-dialog-shell';

    const header =
        document.createElement(
            'div'
        );

    header.className =
        'donation-dialog-header';

    const title =
        document.createElement(
            'h2'
        );

    title.id =
        'donationDialogTitle';

    title.textContent =
        typeof tr === 'function'
            ? tr('supportDialogTitle')
            : 'Support the project';

    const closeButton =
        document.createElement(
            'button'
        );

    const closeLabel =
        typeof tr === 'function'
            ? tr('supportDialogClose')
            : 'Close';

    closeButton.type =
        'button';

    closeButton.className =
        'donation-dialog-close';

    closeButton.textContent =
        '×';

    closeButton.title =
        closeLabel;

    closeButton.setAttribute(
        'aria-label',
        closeLabel
    );

    header.append(
        title,
        closeButton
    );

    const body =
        document.createElement(
            'div'
        );

    body.className =
        'donation-dialog-body';

    DONATION_PARAGRAPH_KEYS.forEach(
        key => {
            const paragraph =
                document.createElement(
                    'p'
                );

            paragraph.className =
                `donation-dialog-paragraph donation-dialog-paragraph-${key.replace('supportStatement', '').toLowerCase()}`;

            appendDonationRichText(
                paragraph,
                typeof tr === 'function'
                    ? tr(key)
                    : key
            );

            body.appendChild(
                paragraph
            );
        }
    );

    const contact =
        document.createElement(
            'p'
        );

    contact.className =
        'donation-dialog-contact';

    contact.textContent =
        typeof tr === 'function'
            ? tr('supportStatementPayments')
            : 'Payments are handled by third-party payment providers. If you are unable to make a payment or have any other questions, please contact me at:';

    const email =
        document.createElement(
            'a'
        );

    email.href =
        'mailto:contact@wardogs-artillery.com';

    email.textContent =
        'contact@wardogs-artillery.com';

    contact.append(
        document.createElement('br'),
        email
    );

    const signature =
        document.createElement(
            'p'
        );

    signature.className =
        'donation-dialog-signature';

    signature.textContent =
        '— Apollyon';

    body.append(
        contact,
        signature
    );

    const actions =
        document.createElement(
            'div'
        );

    actions.className =
        'donation-dialog-actions';

    DONATION_LINKS.forEach(
        donation => {
            actions.appendChild(
                createDonationLink(
                    donation,
                    placement
                )
            );
        }
    );

    shell.append(
        header,
        body,
        actions
    );

    dialog.appendChild(
        shell
    );

    closeButton.addEventListener(
        'click',
        () => {
            dialog.close();
        }
    );

    dialog.addEventListener(
        'click',
        event => {
            if (event.target === dialog) {
                dialog.close();
            }
        }
    );

    document.body.appendChild(
        dialog
    );

    donationDialog =
        dialog;

    return dialog;
}

function openDonationDialog(
    placement = 'footer'
) {
    const dialog =
        ensureDonationDialog(
            placement
        );

    if (dialog.open) {
        return;
    }

    if (
        typeof trackAnalytics ===
        'function'
    ) {
        trackAnalytics(
            'donation-dialog-opened',
            {
                placement
            }
        );
    }

    dialog.showModal();

    dialog
        .querySelector(
            '.donation-dialog-close'
        )
        ?.focus();
}

function createDonationLinks(
    placement = 'footer'
) {
    const links =
        document.createElement(
            'span'
        );

    links.className =
        `donation-links donation-links-${placement}`;

    const button =
        document.createElement(
            'button'
        );

    button.type =
        'button';

    // Keep the legacy donation-link class so existing mobile-menu
    // close handling continues to work without duplicating listeners.
    button.className =
        'donation-link donation-support-button';

    button.textContent =
        typeof tr === 'function'
            ? tr('supportProject')
            : 'Support the project';

    button.addEventListener(
        'click',
        () => {
            openDonationDialog(
                placement
            );
        }
    );

    links.appendChild(
        button
    );

    return links;
}

function createFooterPartner(partner) {
    const item =
        document.createElement(
            'span'
        );

    item.className =
        'footer-partner';

    const label =
        document.createElement(
            'span'
        );

    label.className =
        'footer-partner-label';

    const partnerLabel =
        typeof tr === 'function' &&
        partner.id === 'wardogs-hub'
            ? tr('communityPartner')
            : partner.label;

    label.textContent =
        `${partnerLabel}:`;

    const link =
        document.createElement(
            'a'
        );

    link.className =
        'footer-partner-link';

    link.href =
        partner.url;

    link.target =
        '_blank';

    link.rel =
        'noopener noreferrer';

    link.textContent =
        partner.name;

    link.addEventListener(
        'click',
        () => {
            if (
                typeof trackAnalytics ===
                'function'
            ) {
                trackAnalytics(
                    'partner-click',
                    {
                        partner:
                            partner.id,

                        placement:
                            'footer'
                    }
                );
            }
        }
    );

    item.append(
        label,
        link
    );

    return item;
}

const FEEDBACK_LAUNCHER_LABELS = {
    en: 'Feedback',
    ru: 'Обратная связь',
    uk: 'Зворотний зв’язок',
    de: 'Feedback',
    fr: 'Feedback',
    es: 'Comentarios',
    pl: 'Opinie',
    pt: 'Feedback',
    'zh-cn': '反馈',
    ko: '피드백',
    ja: 'フィードバック',
    cs: 'Zpětná vazba',
    cat: 'Meowback'
};

let feedbackRuntimePromise = null;

function feedbackFeatureEnabled() {
    return APP_CONFIG?.feedback?.enabled === true &&
        Boolean(
            normalizeConfiguredHttpUrl(
                APP_CONFIG?.feedback?.serverUrl,
                {
                    allowLocalhost: true,
                    allowSearchAndHash: false
                }
            )
        );
}

function feedbackLauncherLabel() {
    return FEEDBACK_LAUNCHER_LABELS[
        typeof LANG === 'string' ? LANG : 'en'
    ] || FEEDBACK_LAUNCHER_LABELS.en;
}

function loadFeedbackRuntime() {
    if (typeof openFeedbackDialog === 'function') {
        return Promise.resolve();
    }

    if (feedbackRuntimePromise) {
        return feedbackRuntimePromise;
    }

    feedbackRuntimePromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(
            'script[data-feedback-runtime]'
        );

        if (existing) {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener(
                'error',
                () => reject(new Error('feedback-runtime')),
                { once: true }
            );
            return;
        }

        const script = document.createElement('script');
        const runtimeUrl = new URL(
            'js/ui/feedback.js',
            typeof BASE_PATH !== 'undefined'
                ? BASE_PATH
                : document.baseURI
        ).href;

        script.src = typeof versionRuntimeAsset === 'function'
            ? versionRuntimeAsset(runtimeUrl)
            : runtimeUrl;
        script.dataset.feedbackRuntime = '1';
        script.onload = resolve;
        script.onerror = () => reject(new Error('feedback-runtime'));
        document.head.appendChild(script);
    }).catch(error => {
        feedbackRuntimePromise = null;
        document.querySelector('script[data-feedback-runtime]')?.remove();
        throw error;
    });

    return feedbackRuntimePromise;
}

function createFeedbackLauncher() {
    const button = document.createElement('button');
    const label = feedbackLauncherLabel();

    button.type = 'button';
    button.className = 'footer-feedback-button';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = `
        <span class="footer-feedback-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 5h14v10H9l-4 4V5Z"></path>
                <path d="M8 9h8"></path>
                <path d="M8 12h5"></path>
            </svg>
        </span>
        <span class="footer-feedback-label"></span>
    `;

    button.querySelector('.footer-feedback-label').textContent = label;

    button.addEventListener('click', async () => {
        if (button.disabled) return;

        button.disabled = true;

        try {
            await loadFeedbackRuntime();

            if (typeof openFeedbackDialog !== 'function') {
                throw new Error('feedback-runtime');
            }

            if (typeof trackAnalytics === 'function') {
                trackAnalytics('feedback-opened', {});
            }

            openFeedbackDialog();
        } catch (error) {
            console.warn('Feedback form could not load:', error);
        } finally {
            button.disabled = false;
        }
    });

    return button;
}

function createSourceCodeLink(placement = 'footer') {
    const link = document.createElement('a');

    link.href =
        normalizeConfiguredHttpUrl(
            APP_CONFIG
                ?.site
                ?.footer
                ?.sourceCodeUrl
        ) ||
        'https://github.com/apollyon-sys/wardogs-calculator';

    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const label =
        typeof tr === 'function'
            ? tr('sourceCode')
            : 'Source code';

    link.setAttribute('aria-label', label);
    link.title = label;
    link.innerHTML = `
        <span class="footer-feedback-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.486 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.093.682-.217.682-.483 0-.237-.009-.866-.014-1.7-2.782.605-3.369-1.343-3.369-1.343-.455-1.158-1.11-1.466-1.11-1.466-.908-.622.069-.609.069-.609 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.091-.647.35-1.088.636-1.338-2.221-.253-4.555-1.112-4.555-4.947 0-1.093.39-1.987 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.027A9.55 9.55 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.378.203 2.397.1 2.65.64.701 1.028 1.595 1.028 2.688 0 3.845-2.337 4.691-4.566 4.94.359.31.678.923.678 1.86 0 1.343-.012 2.426-.012 2.756 0 .268.18.58.688.481A10.023 10.023 0 0 0 22 12.021C22 6.486 17.523 2 12 2Z"></path>
            </svg>
        </span>
        <span class="footer-feedback-label"></span>
    `;

    link.querySelector('.footer-feedback-label').textContent = label;

    if (placement === 'mobile-menu') {
        /* Reuse the existing mobile navigation-card appearance. */
        link.className =
            'mobile-desktop-link mobile-source-code-link';
    } else {
        /* Reuse the existing footer action-button appearance. */
        link.className =
            'footer-feedback-button footer-source-code-link';
    }

    return link;
}

function renderFooter() {
    const footer =
        $('siteFooter') ||
        document.querySelector('footer');

    if (!footer) {
        return;
    }

    const config =
        APP_CONFIG
            ?.site
            ?.footer || {};

    footer.innerHTML = '';

    const disclaimer =
        document.createElement(
            'span'
        );

    disclaimer.className =
        'footer-disclaimer';

    disclaimer.textContent =
        typeof tr === 'function'
            ? tr('footerDisclaimer')
            : (config.disclaimer || '');

    const meta =
        document.createElement(
            'span'
        );

    meta.className =
        'footer-meta';

    if (FOOTER_PARTNERS.length) {
        const partners =
            document.createElement(
                'span'
            );

        partners.className =
            'footer-partners';

        FOOTER_PARTNERS.forEach(
            partner => {
                partners.appendChild(
                    createFooterPartner(
                        partner
                    )
                );
            }
        );

        meta.appendChild(
            partners
        );
    }

    if (feedbackFeatureEnabled()) {
        meta.appendChild(
            createFeedbackLauncher()
        );
    }

    meta.appendChild(
        createSourceCodeLink(
            'footer'
        )
    );

    meta.appendChild(
        createDonationLinks(
            'footer'
        )
    );

    const author =
        document.createElement(
            'span'
        );

    author.className =
        'footer-author';

    const productName =
        String(
            config.productName ||
            'WARDOGS Artillery Calculator'
        );

    const authorLabel =
        String(
            typeof tr === 'function'
                ? tr('authorLabel')
                : (config.authorLabel || 'by')
        );

    author.append(
        document.createTextNode(
            `${productName} ${authorLabel} `
        )
    );

    const link =
        document.createElement(
            'a'
        );

    link.href =
        normalizeConfiguredHttpUrl(
            config.authorUrl
        ) || '#';

    link.target =
        '_blank';

    link.rel =
        'noopener noreferrer';

    const strong =
        document.createElement(
            'strong'
        );

    strong.textContent =
        config.authorName ||
        'Apollyon';

    link.appendChild(
        strong
    );

    author.appendChild(
        link
    );

    if (config.version) {
        const version =
            document.createElement(
                'span'
            );

        version.className =
            'footer-version';

        version.textContent =
            `(${config.version})`;

        author.appendChild(
            version
        );
    }

    meta.appendChild(
        author
    );

    if (disclaimer.textContent) {
        footer.appendChild(
            disclaimer
        );
    }

    footer.appendChild(
        meta
    );

    const solutionSupport =
        $('solutionSupport');

    if (
        solutionSupport &&
        solutionSupport.dataset.donationBound !== 'true'
    ) {
        solutionSupport.dataset.donationBound =
            'true';

        solutionSupport.addEventListener(
            'click',
            () => openDonationDialog(
                'firing-solution'
            )
        );
    }
}

;

/* js/ui/layout/state.js */
/* =========================
   LAYOUT
   ========================= */

const SAVED_TARGETS_PANEL_COLLAPSED_KEY =
    'wardogs-saved-targets-panel-collapsed';

let mapResizeObserver =
    null;

let mobileSideMenuOpen =
    false;

let mobileSphWarningObserver =
    null;


;

/* js/ui/layout/accessibility.js */
/* =========================
   ACCESSIBILITY
   ========================= */

const ACCESSIBILITY_STORAGE_KEY =
    'wardogs-accessibility-v1';

const ACCESSIBILITY_DEFAULTS = {
    textSize: 'normal',
    largerControls: false,
    highContrast: false
};

const ACCESSIBILITY_TEXT_SIZES =
    new Set([
        'normal',
        'large',
        'xl'
    ]);

let accessibilitySettings = {
    ...ACCESSIBILITY_DEFAULTS
};

let accessibilityResultTimer =
    null;

function normalizeAccessibilitySettings(
    value
) {
    const input =
        value &&
        typeof value === 'object'
            ? value
            : {};

    return {
        textSize:
            ACCESSIBILITY_TEXT_SIZES.has(
                input.textSize
            )
                ? input.textSize
                : ACCESSIBILITY_DEFAULTS.textSize,

        largerControls:
            input.largerControls === true,

        highContrast:
            input.highContrast === true
    };
}

function loadAccessibilitySettings() {
    try {
        const raw =
            localStorage.getItem(
                ACCESSIBILITY_STORAGE_KEY
            );

        if (!raw) {
            return {
                ...ACCESSIBILITY_DEFAULTS
            };
        }

        return normalizeAccessibilitySettings(
            JSON.parse(raw)
        );
    } catch (error) {
        console.warn(
            'Failed to load accessibility settings:',
            error
        );

        return {
            ...ACCESSIBILITY_DEFAULTS
        };
    }
}

function persistAccessibilitySettings() {
    try {
        localStorage.setItem(
            ACCESSIBILITY_STORAGE_KEY,
            JSON.stringify(
                accessibilitySettings
            )
        );
    } catch (error) {
        console.warn(
            'Failed to save accessibility settings:',
            error
        );
    }
}

function syncAccessibilityControls() {
    const textSize =
        $('accessibilityTextSize');

    const largerControls =
        $('accessibilityLargerControls');

    const highContrast =
        $('accessibilityHighContrast');

    if (textSize) {
        textSize.value =
            accessibilitySettings.textSize;
    }

    if (largerControls) {
        largerControls.checked =
            accessibilitySettings.largerControls;
    }

    if (highContrast) {
        highContrast.checked =
            accessibilitySettings.highContrast;
    }
}

function applyAccessibilitySettings(
    value,
    persist = false
) {
    accessibilitySettings =
        normalizeAccessibilitySettings(
            value
        );

    const root =
        document.documentElement;

    root.dataset.a11yTextSize =
        accessibilitySettings.textSize;

    root.dataset.a11yLargeControls =
        accessibilitySettings.largerControls
            ? 'true'
            : 'false';

    root.dataset.a11yHighContrast =
        accessibilitySettings.highContrast
            ? 'true'
            : 'false';

    syncAccessibilityControls();

    if (persist) {
        persistAccessibilitySettings();
    }

    if (
        typeof resize === 'function'
    ) {
        window.requestAnimationFrame(
            () => resize()
        );
    }
}

function initializeAccessibilityPreferences() {
    applyAccessibilitySettings(
        loadAccessibilitySettings(),
        false
    );
}

function getAccessibilityDiagnostics() {
    return {
        textSize:
            accessibilitySettings.textSize,
        largerControls:
            accessibilitySettings.largerControls,
        highContrast:
            accessibilitySettings.highContrast
    };
}

function createAccessibilityLauncher(
    className = ''
) {
    const button =
        document.createElement(
            'button'
        );

    button.type =
        'button';

    button.className =
        `accessibility-launcher ${className}`
            .trim();

    button.innerHTML = `
        <span class="accessibility-launcher-icon" aria-hidden="true">Aa</span>
        <span class="accessibility-launcher-label"></span>
    `;

    button.addEventListener(
        'click',
        () => {
            openAccessibilityDialog();
        }
    );

    return button;
}

function ensureAccessibilityResultStatus() {
    let status =
        $('accessibilityResultStatus');

    if (!status) {
        status =
            document.createElement(
                'div'
            );

        status.id =
            'accessibilityResultStatus';

        status.className =
            'sr-only';

        status.setAttribute(
            'role',
            'status'
        );

        status.setAttribute(
            'aria-live',
            'polite'
        );

        status.setAttribute(
            'aria-atomic',
            'true'
        );

        document.body.appendChild(
            status
        );
    }

    if (c) {
        c.setAttribute(
            'role',
            'img'
        );

        c.setAttribute(
            'aria-describedby',
            status.id
        );
    }

    return status;
}

function scheduleAccessibilityResultAnnouncement({
    distanceMeters,
    azimuth,
    inRange
}) {
    if (
        accessibilityResultTimer
    ) {
        window.clearTimeout(
            accessibilityResultTimer
        );
    }

    accessibilityResultTimer =
        window.setTimeout(
            () => {
                accessibilityResultTimer =
                    null;

                const status =
                    ensureAccessibilityResultStatus();

                const weapon =
                    WEAPONS[S.weapon];

                const mapName =
                    MAPS[S.map]?.name ||
                    S.map;

                const mil =
                    $('mil')?.textContent ||
                    '—';

                const summary = [
                    weapon
                        ? getWeaponName(weapon)
                        : '',
                    mapName,
                    `${tr('artillery')}: X ${formatGameCoordinate(S.origin.x)}, Y ${formatGameCoordinate(S.origin.y)}`,
                    `${tr('target')}: X ${formatGameCoordinate(S.target.x)}, Y ${formatGameCoordinate(S.target.y)}`,
                    `${tr('distance')}: ${Math.round(distanceMeters)} m`,
                    `${tr('azimuth')}: ${Number(azimuth).toFixed(1)}°`,
                    `${tr('mil')}: ${mil}`,
                    inRange
                        ? tr('inRange')
                        : tr('outRange')
                ]
                    .filter(Boolean)
                    .join('. ');

                setText(
                    status,
                    summary
                );

                if (c) {
                    c.setAttribute(
                        'aria-label',
                        `${tr('map')}: ${mapName}. ${tr('result')}.`
                    );
                }
            },
            700
        );
}

function syncAccessibilityLocalization() {
    const dialog =
        $('accessibilityDialog');

    const translate =
        (selector, key) => {
            const element =
                document.querySelector(
                    selector
                );

            if (element) {
                element.textContent =
                    tr(key);
            }
        };

    document
        .querySelectorAll(
            '.accessibility-launcher-label'
        )
        .forEach(
            label => {
                label.textContent =
                    tr('accessibility');
            }
        );

    document
        .querySelectorAll(
            '.accessibility-launcher'
        )
        .forEach(
            button => {
                const label =
                    tr('accessibility');

                button.title =
                    label;

                button.setAttribute(
                    'aria-label',
                    label
                );
            }
        );

    if (!dialog) {
        return;
    }

    translate(
        '#mobileAccessibilityLabel',
        'accessibilitySettings'
    );

    translate(
        '#accessibilityTitle',
        'accessibilitySettings'
    );

    translate(
        '#accessibilityTextSizeLabel',
        'accessibilityTextSize'
    );

    translate(
        '#accessibilityTextNormal',
        'accessibilityTextNormal'
    );

    translate(
        '#accessibilityTextLarge',
        'accessibilityTextLarge'
    );

    translate(
        '#accessibilityTextExtraLarge',
        'accessibilityTextExtraLarge'
    );

    translate(
        '#accessibilityLargerControlsLabel',
        'accessibilityLargerControls'
    );

    translate(
        '#accessibilityHighContrastLabel',
        'accessibilityHighContrast'
    );

    translate(
        '#accessibilityReset',
        'accessibilityReset'
    );

    translate(
        '#accessibilityClose',
        'accessibilityClose'
    );

    const close =
        dialog.querySelector(
            '.accessibility-dialog-close'
        );

    if (close) {
        close.setAttribute(
            'aria-label',
            tr('accessibilityClose')
        );
    }
}

function ensureAccessibilityDialog() {
    let dialog =
        $('accessibilityDialog');

    if (dialog) {
        return dialog;
    }

    dialog =
        document.createElement(
            'dialog'
        );

    dialog.id =
        'accessibilityDialog';

    dialog.className =
        'accessibility-dialog';

    dialog.setAttribute(
        'aria-labelledby',
        'accessibilityTitle'
    );

    dialog.innerHTML = `
        <form method="dialog" class="accessibility-form">
            <div class="accessibility-dialog-heading">
                <h2 id="accessibilityTitle"></h2>
                <button class="accessibility-dialog-close" type="button">×</button>
            </div>

            <label class="accessibility-field" for="accessibilityTextSize">
                <span id="accessibilityTextSizeLabel"></span>
                <select id="accessibilityTextSize">
                    <option id="accessibilityTextNormal" value="normal"></option>
                    <option id="accessibilityTextLarge" value="large"></option>
                    <option id="accessibilityTextExtraLarge" value="xl"></option>
                </select>
            </label>

            <label class="accessibility-toggle-row">
                <input id="accessibilityLargerControls" type="checkbox">
                <span id="accessibilityLargerControlsLabel"></span>
            </label>

            <label class="accessibility-toggle-row">
                <input id="accessibilityHighContrast" type="checkbox">
                <span id="accessibilityHighContrastLabel"></span>
            </label>

            <div class="accessibility-actions">
                <button id="accessibilityReset" type="button"></button>
                <button class="primary" id="accessibilityClose" type="button"></button>
            </div>
        </form>
    `;

    document.body.appendChild(
        dialog
    );

    const textSize =
        $('accessibilityTextSize');

    const largerControls =
        $('accessibilityLargerControls');

    const highContrast =
        $('accessibilityHighContrast');

    textSize?.addEventListener(
        'change',
        () => {
            applyAccessibilitySettings(
                {
                    ...accessibilitySettings,
                    textSize:
                        textSize.value
                },
                true
            );
        }
    );

    largerControls?.addEventListener(
        'change',
        () => {
            applyAccessibilitySettings(
                {
                    ...accessibilitySettings,
                    largerControls:
                        largerControls.checked
                },
                true
            );
        }
    );

    highContrast?.addEventListener(
        'change',
        () => {
            applyAccessibilitySettings(
                {
                    ...accessibilitySettings,
                    highContrast:
                        highContrast.checked
                },
                true
            );
        }
    );

    $('accessibilityReset')
        ?.addEventListener(
            'click',
            () => {
                applyAccessibilitySettings(
                    ACCESSIBILITY_DEFAULTS,
                    true
                );
            }
        );

    const close = () => {
        if (dialog.open) {
            dialog.close();
        }
    };

    dialog
        .querySelector(
            '.accessibility-dialog-close'
        )
        ?.addEventListener(
            'click',
            close
        );

    $('accessibilityClose')
        ?.addEventListener(
            'click',
            close
        );

    dialog.addEventListener(
        'click',
        event => {
            if (
                event.target === dialog
            ) {
                close();
            }
        }
    );

    syncAccessibilityControls();
    syncAccessibilityLocalization();

    return dialog;
}

function openAccessibilityDialog() {
    const dialog =
        ensureAccessibilityDialog();

    syncAccessibilityControls();
    syncAccessibilityLocalization();

    if (!dialog.open) {
        dialog.showModal();
    }

    $('accessibilityTextSize')
        ?.focus();
}

function installDesktopAccessibilityLauncher() {
    if (
        document.body.classList.contains(
            'mobile-app'
        ) ||
        document.querySelector(
            '.footer-accessibility-button'
        )
    ) {
        return;
    }

    const footerMeta =
        document.querySelector(
            '.footer-meta'
        );

    if (!footerMeta) {
        return;
    }

    const launcher =
        createAccessibilityLauncher(
            'footer-accessibility-button'
        );

    const donations =
        footerMeta.querySelector(
            '.donation-links'
        );

    footerMeta.insertBefore(
        launcher,
        donations || null
    );

    syncAccessibilityLocalization();
}

function initAccessibility() {
    ensureAccessibilityResultStatus();
    ensureAccessibilityDialog();
    installDesktopAccessibilityLauncher();
    syncAccessibilityLocalization();
}


;

/* js/ui/layout/mobile-menu.js */
/* =========================
   MOBILE RIGHT-SIDE MENU
   ========================= */

const MOBILE_MENU_TEXT = {
    en: {
        menu: 'Menu',
        appearance: 'Appearance',
        light: 'Light',
        dark: 'Dark',
        language: 'Language',
        links: 'Links',
        support: 'Support',
        credits: 'Credits',
        legal: 'Legal'
    },
    ru: {
        menu: 'Меню',
        appearance: 'Тема',
        light: 'Светлая',
        dark: 'Тёмная',
        language: 'Язык',
        links: 'Ссылки',
        support: 'Поддержать',
        credits: 'Авторы',
        legal: 'Дисклеймер'
    },
    uk: {
        menu: 'Меню',
        appearance: 'Тема',
        light: 'Світла',
        dark: 'Темна',
        language: 'Мова',
        links: 'Посилання',
        support: 'Підтримати',
        credits: 'Автори',
        legal: 'Дисклеймер'
    },
    de: {
        menu: 'Menü',
        appearance: 'Darstellung',
        light: 'Hell',
        dark: 'Dunkel',
        language: 'Sprache',
        links: 'Links',
        support: 'Unterstützen',
        credits: 'Credits',
        legal: 'Hinweis'
    },
    fr: {
        menu: 'Menu',
        appearance: 'Apparence',
        light: 'Clair',
        dark: 'Sombre',
        language: 'Langue',
        links: 'Liens',
        support: 'Soutenir',
        credits: 'Crédits',
        legal: 'Mentions'
    },
    es: {
        menu: 'Menú',
        appearance: 'Apariencia',
        light: 'Claro',
        dark: 'Oscuro',
        language: 'Idioma',
        links: 'Enlaces',
        support: 'Apoyar',
        credits: 'Créditos',
        legal: 'Aviso'
    },
    pl: {
        menu: 'Menu',
        appearance: 'Wygląd',
        light: 'Jasny',
        dark: 'Ciemny',
        language: 'Język',
        links: 'Linki',
        support: 'Wesprzyj',
        credits: 'Autorzy',
        legal: 'Informacja'
    },
       ko: {
        menu: '메뉴',
        appearance: '테마',
        light: '라이트',
        dark: '다크',
        language: '언어',
        links: '링크',
        support: '후원',
        credits: '제작진',
        legal: '법적 고지'
    },
    pt: {
        menu: 'Menu',
        appearance: 'Aparência',
        light: 'Claro',
        dark: 'Escuro',
        language: 'Idioma',
        links: 'Links',
        support: 'Apoiar',
        credits: 'Créditos',
        legal: 'Aviso'
    },
    'zh-cn': {
        menu: '菜单',
        appearance: '外观',
        light: '浅色',
        dark: '深色',
        language: '语言',
        links: '链接',
        support: '支持',
        credits: '致谢',
        legal: '法律信息'
    },
    cs: {
        menu: 'Menu',
        appearance: 'Vzhled',
        light: 'Světlý',
        dark: 'Tmavý',
        language: 'Jazyk',
        links: 'Odkazy',
        support: 'Podpořit',
        credits: 'Autoři',
        legal: 'Právní informace'
    },
    cat: {
        menu: 'MEOWNU',
        appearance: 'MEOWDE',
        light: 'SUN CAT',
        dark: 'NIGHT CAT',
        language: 'MEOWGUAGE',
        links: 'CAT LINKS',
        support: 'SUPPORT CAT',
        credits: 'CAT CREDITS',
        legal: 'LEGAL MEOW'
    }
};

function getMobileMenuText() {

    const language =
        typeof LANG === 'string' &&
        LANG
            ? LANG
            : document.documentElement
                .lang ||
                'en';

    return (
        MOBILE_MENU_TEXT[language] ||
        MOBILE_MENU_TEXT.en
    );
}

function syncMobileThemeButtons() {

    const isLight =
        document.documentElement
            .dataset.theme === 'light';

    const lightButton =
        $('mobileThemeLight');

    const darkButton =
        $('mobileThemeDark');

    lightButton?.classList.toggle(
        'active',
        isLight
    );

    darkButton?.classList.toggle(
        'active',
        !isLight
    );

    lightButton?.setAttribute(
        'aria-pressed',
        isLight
            ? 'true'
            : 'false'
    );

    darkButton?.setAttribute(
        'aria-pressed',
        isLight
            ? 'false'
            : 'true'
    );
}

function syncMobileSideMenuLocalization() {

    const menu =
        $('mobileSideMenu');

    if (!menu) {
        return;
    }

    const text =
        getMobileMenuText();

    const setText =
        (
            id,
            value
        ) => {

            const element =
                $(id);

            if (element) {
                element.textContent =
                    value;
            }
        };

    setText(
        'mobileSideMenuTitle',
        text.menu
    );

    setText(
        'mobileAppearanceLabel',
        text.appearance
    );

    setText(
        'mobileThemeLightLabel',
        text.light
    );

    setText(
        'mobileThemeDarkLabel',
        text.dark
    );

    setText(
        'mobileLanguageLabel',
        text.language
    );

    setText(
        'mobileLinksLabel',
        text.links
    );

    setText(
        'mobileSupportLabel',
        text.support ||
            MOBILE_MENU_TEXT.en.support
    );

    setText(
        'mobileCreditsLabel',
        text.credits
    );

    setText(
        'mobileLegalLabel',
        text.legal
    );

    const close =
        menu.querySelector(
            '.mobile-side-menu-close'
        );

    if (close) {
        const label =
            typeof tr === 'function'
                ? tr('motdClose')
                : 'Close';

        close.title =
            label;

        close.setAttribute(
            'aria-label',
            label
        );
    }
}

function setMobileSideMenuOpen(
    open
) {

    const menu =
        $('mobileSideMenu');

    const toggle =
        $('mobileSideMenuToggle');

    const backdrop =
        $('mobileSideMenuBackdrop');

    if (
        !menu ||
        !toggle ||
        !backdrop
    ) {
        return;
    }

    mobileSideMenuOpen =
        Boolean(open);

    document.body.classList.toggle(
        'mobile-side-menu-open',
        mobileSideMenuOpen
    );

    toggle.classList.toggle(
        'active',
        mobileSideMenuOpen
    );

    toggle.setAttribute(
        'aria-expanded',
        mobileSideMenuOpen
            ? 'true'
            : 'false'
    );

    menu.setAttribute(
        'aria-hidden',
        mobileSideMenuOpen
            ? 'false'
            : 'true'
    );

    backdrop.setAttribute(
        'aria-hidden',
        mobileSideMenuOpen
            ? 'false'
            : 'true'
    );

    if (mobileSideMenuOpen) {

        syncMobileThemeButtons();
        syncMobileSideMenuLocalization();

        /*
         * Keep the calculator bottom sheet closed
         * while the global mobile menu is open.
         */
        if (
            typeof setMobileSheetOpen ===
            'function'
        ) {
            setMobileSheetOpen(
                false
            );
        }

        if (
            typeof closeLanguagePicker ===
            'function'
        ) {
            closeLanguagePicker();
        }
    }
}

function createMobileSideMenuToggle() {

    const button =
        document.createElement(
            'button'
        );

    button.id =
        'mobileSideMenuToggle';

    button.type =
        'button';

    button.className =
        'mobile-side-menu-toggle';

    button.title =
        'Menu';

    button.setAttribute(
        'aria-label',
        'Menu'
    );

    button.setAttribute(
        'aria-controls',
        'mobileSideMenu'
    );

    button.setAttribute(
        'aria-expanded',
        'false'
    );

    button.innerHTML = `
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
        >
            <path d="M5 7h14"></path>
            <path d="M5 12h14"></path>
            <path d="M5 17h14"></path>
        </svg>
    `;

    return button;
}

function createMobileMenuSection(
    labelId,
    className
) {

    const section =
        document.createElement(
            'section'
        );

    section.className =
        `mobile-side-menu-section ${className}`;

    const label =
        document.createElement(
            'div'
        );

    label.id =
        labelId;

    label.className =
        'mobile-side-menu-section-label';

    section.appendChild(
        label
    );

    return section;
}

function createMobileThemeButton(
    theme,
    id,
    labelId
) {

    const button =
        document.createElement(
            'button'
        );

    button.id =
        id;

    button.type =
        'button';

    button.className =
        'mobile-theme-choice-button';

    button.dataset.theme =
        theme;

    button.setAttribute(
        'aria-pressed',
        'false'
    );

    const icon =
        document.createElement(
            'span'
        );

    icon.className =
        'mobile-theme-choice-icon';

    icon.setAttribute(
        'aria-hidden',
        'true'
    );

    icon.innerHTML =
        theme === 'light'
            ? `
                <svg
                    viewBox="0 0 24 24"
                    width="19"
                    height="19"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                >
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="m4.93 4.93 1.41 1.41"></path>
                    <path d="m17.66 17.66 1.41 1.41"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="m6.34 17.66-1.41 1.41"></path>
                    <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
            `
            : `
                <svg
                    viewBox="0 0 24 24"
                    width="19"
                    height="19"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M21 12.7A8 8 0 1 1 11.3 3 6.2 6.2 0 0 0 21 12.7Z"></path>
                </svg>
            `;

    const label =
        document.createElement(
            'span'
        );

    label.id =
        labelId;

    label.className =
        'mobile-theme-choice-label';

    button.append(
        icon,
        label
    );

    button.addEventListener(
        'click',
        () => {

            if (
                typeof applyTheme ===
                'function'
            ) {
                applyTheme(
                    theme
                );
            }

            syncMobileThemeButtons();
        }
    );

    return button;
}

function createMobileCreditsBlock() {

    const config =
        APP_CONFIG
            ?.site
            ?.footer ||
        {};

    const wrap =
        document.createElement(
            'div'
        );

    wrap.className =
        'mobile-side-menu-footer';

    const creditsHeading =
        document.createElement(
            'div'
        );

    creditsHeading.id =
        'mobileCreditsLabel';

    creditsHeading.className =
        'mobile-side-menu-section-label';

    const creditLine =
        document.createElement(
            'div'
        );

    creditLine.className =
        'mobile-side-menu-credit-line';

    const productName =
        String(
            config.productName ||
            'WARDOGS Artillery Calculator'
        );

    const authorLabel =
        String(
            typeof tr === 'function'
                ? tr('authorLabel')
                : (config.authorLabel || 'by')
        );

    creditLine.append(
        document.createTextNode(
            `${productName} ${authorLabel} `
        )
    );

    const authorLink =
        document.createElement(
            'a'
        );

    authorLink.href =
        normalizeConfiguredHttpUrl(
            config.authorUrl
        ) || '#';

    authorLink.target =
        '_blank';

    authorLink.rel =
        'noopener noreferrer';

    authorLink.textContent =
        config.authorName ||
        'Apollyon';

    creditLine.appendChild(
        authorLink
    );

    if (config.version) {

        const version =
            document.createElement(
                'span'
            );

        version.className =
            'mobile-side-menu-version';

        version.textContent =
            `v${String(config.version).replace(/^v/i, '')}`;

        creditLine.appendChild(
            version
        );
    }

    const legalHeading =
        document.createElement(
            'div'
        );

    legalHeading.id =
        'mobileLegalLabel';

    legalHeading.className =
        'mobile-side-menu-section-label mobile-side-menu-legal-label';

    const disclaimer =
        document.createElement(
            'p'
        );

    disclaimer.className =
        'mobile-side-menu-disclaimer';

    disclaimer.textContent =
        typeof tr === 'function'
            ? tr('footerDisclaimer')
            : (config.disclaimer || '');

    wrap.append(
        creditsHeading,
        creditLine
    );

    if (
        disclaimer.textContent
    ) {
        wrap.append(
            legalHeading,
            disclaimer
        );
    }

    return wrap;
}

function initMobileSideMenu() {

    const mobileApp =
        document.body.classList.contains(
            'mobile-app'
        );

    if (!mobileApp) {
        return;
    }

    if (
        $('mobileSideMenu')
    ) {
        return;
    }

    const headerControls =
        document.querySelector(
            '.mobile-header-controls'
        );

    if (!headerControls) {
        return;
    }

    const themeToggle =
        $('themeToggle');

    const languagePicker =
        $('languagePicker');

    const languageSelect =
        $('language');

    const desktopLink =
        $('mobileDesktopVersion');

    const partnerLink =
        document.querySelector(
            '.mobile-partner-link'
        );

    const toggle =
        createMobileSideMenuToggle();

    const backdrop =
        document.createElement(
            'button'
        );

    backdrop.id =
        'mobileSideMenuBackdrop';

    backdrop.type =
        'button';

    backdrop.className =
        'mobile-side-menu-backdrop';

    backdrop.setAttribute(
        'aria-label',
        'Close menu'
    );

    backdrop.setAttribute(
        'aria-hidden',
        'true'
    );

    const menu =
        document.createElement(
            'aside'
        );

    menu.id =
        'mobileSideMenu';

    menu.className =
        'mobile-side-menu';

    menu.setAttribute(
        'aria-label',
        'Menu'
    );

    menu.setAttribute(
        'aria-hidden',
        'true'
    );

    const menuHeader =
        document.createElement(
            'div'
        );

    menuHeader.className =
        'mobile-side-menu-header';

    const heading =
        document.createElement(
            'div'
        );

    heading.className =
        'mobile-side-menu-heading';

    const title =
        document.createElement(
            'strong'
        );

    title.id =
        'mobileSideMenuTitle';

    title.className =
        'mobile-side-menu-title';

    const subtitle =
        document.createElement(
            'span'
        );

    subtitle.className =
        'mobile-side-menu-subtitle';

    subtitle.textContent =
        APP_CONFIG
            ?.site
            ?.footer
            ?.productName ||
        'WARDOGS Artillery Calculator';

    heading.append(
        title,
        subtitle
    );

    const closeButton =
        document.createElement(
            'button'
        );

    closeButton.type =
        'button';

    closeButton.className =
        'mobile-side-menu-close';

    closeButton.textContent =
        '×';

    menuHeader.append(
        heading,
        closeButton
    );

    const appearanceSection =
        createMobileMenuSection(
            'mobileAppearanceLabel',
            'mobile-side-menu-appearance'
        );

    const themeChoices =
        document.createElement(
            'div'
        );

    themeChoices.className =
        'mobile-theme-choice';

    const lightTheme =
        createMobileThemeButton(
            'light',
            'mobileThemeLight',
            'mobileThemeLightLabel'
        );

    const darkTheme =
        createMobileThemeButton(
            'dark',
            'mobileThemeDark',
            'mobileThemeDarkLabel'
        );

    themeChoices.append(
        lightTheme,
        darkTheme
    );

    appearanceSection.appendChild(
        themeChoices
    );

    const accessibilitySection =
        createMobileMenuSection(
            'mobileAccessibilityLabel',
            'mobile-side-menu-accessibility'
        );

    const accessibilityButton =
        createAccessibilityLauncher(
            'mobile-accessibility-button'
        );

    accessibilityButton.addEventListener(
        'click',
        () => {
            setMobileSideMenuOpen(
                false
            );
        }
    );

    accessibilitySection.appendChild(
        accessibilityButton
    );

    /*
     * Keep the original theme toggle connected but hidden.
     * theme.js updates #themeIcon / #themeToggle internally,
     * so preserving the element avoids changing shared
     * desktop theme logic.
     */
    if (themeToggle) {

        themeToggle.classList.add(
            'mobile-theme-toggle-legacy'
        );

        appearanceSection.appendChild(
            themeToggle
        );
    }

    const languageSection =
        createMobileMenuSection(
            'mobileLanguageLabel',
            'mobile-side-menu-language'
        );

    const languageShell =
        document.createElement(
            'div'
        );

    languageShell.className =
        'mobile-side-menu-language-shell';

    if (languagePicker) {

        languageShell.appendChild(
            languagePicker
        );
    }

    if (languageSelect) {

        languageShell.appendChild(
            languageSelect
        );
    }

    languageSection.appendChild(
        languageShell
    );

    const linksSection =
        createMobileMenuSection(
            'mobileLinksLabel',
            'mobile-side-menu-navigation'
        );

    const links =
        document.createElement(
            'div'
        );

    links.className =
        'mobile-side-menu-links';

    if (desktopLink) {

        desktopLink.classList.add(
            'mobile-side-menu-link-card'
        );

        links.appendChild(
            desktopLink
        );
    }

    if (
        typeof createSourceCodeLink ===
        'function'
    ) {
        links.appendChild(
            createSourceCodeLink(
                'mobile-menu'
            )
        );
    }

    if (partnerLink) {

        partnerLink.dataset
            .analyticsEventPlacement =
            'mobile-menu';

        partnerLink.classList.add(
            'mobile-side-menu-link-card'
        );

        links.appendChild(
            partnerLink
        );
    }

    linksSection.appendChild(
        links
    );

    const supportSection =
        createMobileMenuSection(
            'mobileSupportLabel',
            'mobile-side-menu-support'
        );

    const donationLinks =
        createDonationLinks(
            'mobile-menu'
        );

    if (
        typeof feedbackFeatureEnabled === 'function' &&
        feedbackFeatureEnabled() &&
        typeof createFeedbackLauncher === 'function'
    ) {
        const feedbackButton =
            createFeedbackLauncher();

        feedbackButton.classList.add(
            'mobile-feedback-button'
        );

        feedbackButton.addEventListener(
            'click',
            () => {
                setMobileSideMenuOpen(
                    false
                );
            }
        );

        supportSection.appendChild(
            feedbackButton
        );
    }

    supportSection.appendChild(
        donationLinks
    );

    const footer =
        createMobileCreditsBlock();

    menu.append(
        menuHeader,
        languageSection,
        appearanceSection,
        accessibilitySection,
        linksSection,
        supportSection,
        footer
    );

    headerControls.appendChild(
        toggle
    );

    document.body.append(
        backdrop,
        menu
    );

    toggle.addEventListener(
        'click',
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMobileSideMenuOpen(
                !mobileSideMenuOpen
            );
        }
    );

    closeButton.addEventListener(
        'click',
        () => {

            setMobileSideMenuOpen(
                false
            );
        }
    );

    backdrop.addEventListener(
        'click',
        () => {

            setMobileSideMenuOpen(
                false
            );
        }
    );

    desktopLink
        ?.addEventListener(
            'click',
            () => {

                setMobileSideMenuOpen(
                    false
                );
            }
        );

    partnerLink
        ?.addEventListener(
            'click',
            () => {

                setMobileSideMenuOpen(
                    false
                );
            }
        );

    donationLinks
        .querySelectorAll(
            '.donation-link'
        )
        .forEach(
            link => {
                link.addEventListener(
                    'click',
                    () => {
                        setMobileSideMenuOpen(
                            false
                        );
                    }
                );
            }
        );

    document.addEventListener(
        'keydown',
        event => {

            if (
                event.key ===
                    'Escape' &&
                mobileSideMenuOpen
            ) {

                setMobileSideMenuOpen(
                    false
                );
            }
        }
    );

    syncMobileThemeButtons();
    syncMobileSideMenuLocalization();

    setMobileSideMenuOpen(
        false
    );
}

;

/* js/ui/layout/mobile-warning.js */
/* =========================
   MOBILE SPH-2 LEVEL WARNING
   ========================= */

function setMobileSphWarningExpanded(
    warning,
    expanded
) {

    if (!warning) {
        return;
    }

    const toggle =
        warning.querySelector(
            '.sph-level-warning-toggle'
        );

    const body =
        warning.querySelector(
            '.sph-level-warning-body'
        );

    if (
        !toggle ||
        !body
    ) {
        return;
    }

    const next =
        Boolean(expanded);

    toggle.setAttribute(
        'aria-expanded',
        next
            ? 'true'
            : 'false'
    );

    body.hidden =
        !next;

    warning.classList.toggle(
        'expanded',
        next
    );
}

function prepareMobileSphLevelWarning() {

    const mobileApp =
        document.body.classList.contains(
            'mobile-app'
        );

    if (!mobileApp) {
        return false;
    }

    const warning =
        $('sphLevelWarning');

    const solutionHud =
        document.querySelector(
            '.mobile-solution-hud'
        );

    const rangeStatus =
        $('rangeStatus');

    if (
        !warning ||
        !solutionHud
    ) {
        return false;
    }

    /*
     * Put the SPH-2 leveling warning into the compact
     * firing-solution HUD shown above the map, directly
     * under the range-status row.
     */
    if (
        warning.parentElement !==
        solutionHud
    ) {

        if (
            rangeStatus &&
            rangeStatus.parentElement ===
                solutionHud
        ) {
            rangeStatus.insertAdjacentElement(
                'afterend',
                warning
            );
        } else {
            solutionHud.appendChild(
                warning
            );
        }
    }

    if (
        warning.dataset
            .mobileCollapsible ===
        'true'
    ) {
        return true;
    }

    const title =
        warning.querySelector(
            '.sph-level-warning-title'
        );

    const body =
        warning.querySelector(
            '.sph-level-warning-body'
        );

    if (
        !title ||
        !body
    ) {
        return false;
    }

    const toggle =
        document.createElement(
            'button'
        );

    toggle.type =
        'button';

    toggle.className =
        'sph-level-warning-toggle';

    /*
     * Reuse the existing icon/title nodes so the
     * Terrain3D runtime keeps updating localized text.
     */
    while (title.firstChild) {

        toggle.appendChild(
            title.firstChild
        );
    }

    const chevron =
        document.createElement(
            'span'
        );

    chevron.className =
        'sph-level-warning-chevron';

    chevron.textContent =
        '▾';

    chevron.setAttribute(
        'aria-hidden',
        'true'
    );

    toggle.appendChild(
        chevron
    );

    title.replaceWith(
        toggle
    );

    body.id =
        'sphLevelWarningBody';

    toggle.setAttribute(
        'aria-controls',
        body.id
    );

    toggle.addEventListener(
        'click',
        event => {

            event.preventDefault();
            event.stopPropagation();

            const expanded =
                toggle.getAttribute(
                    'aria-expanded'
                ) === 'true';

            setMobileSphWarningExpanded(
                warning,
                !expanded
            );
        }
    );

    warning.dataset
        .mobileCollapsible =
        'true';

    warning.classList.add(
        'sph-level-warning-mobile-hud'
    );

    /*
     * Keep the HUD compact until the user explicitly
     * asks for the full leveling explanation.
     */
    setMobileSphWarningExpanded(
        warning,
        false
    );

    return true;
}

function initMobileSphLevelWarning() {

    const mobileApp =
        document.body.classList.contains(
            'mobile-app'
        );

    if (!mobileApp) {
        return;
    }

    if (
        prepareMobileSphLevelWarning()
    ) {
        return;
    }

    /*
     * Terrain3D normally creates the warning before
     * initLayout(), but this keeps the UI robust if
     * runtime loading order changes.
     */
    if (
        mobileSphWarningObserver ||
        typeof MutationObserver ===
            'undefined'
    ) {
        return;
    }

    mobileSphWarningObserver =
        new MutationObserver(
            () => {

                if (
                    prepareMobileSphLevelWarning()
                ) {

                    mobileSphWarningObserver
                        .disconnect();

                    mobileSphWarningObserver =
                        null;
                }
            }
        );

    mobileSphWarningObserver.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );
}



;

/* js/ui/layout/saved-targets-panel.js */
/* =========================
   DESKTOP SAVED TARGETS COLLAPSE
   ========================= */

function installDesktopSavedTargetsCollapseStyle() {

    if (
        $('savedTargetsCollapseStyle')
    ) {
        return;
    }

    const style =
        document.createElement(
            'style'
        );

    style.id =
        'savedTargetsCollapseStyle';

    style.textContent = `
        body:not(.mobile-app)
        .saved-targets {
            transition:
                width .18s ease,
                padding .18s ease;
        }

        body:not(.mobile-app)
        .saved-targets-header {
            display: grid;

            grid-template-columns:
                minmax(0, 1fr)
                auto
                24px;

            align-items: center;

            gap: 7px;
        }

        body:not(.mobile-app)
        .saved-targets-collapse-toggle {
            width: 24px;
            min-width: 24px;

            height: 24px;
            min-height: 24px;

            margin: 0;
            padding: 0;

            display: grid;
            place-items: center;

            border: 1px solid
                var(--border-light);

            border-radius: 5px;

            background:
                var(--input-bg);

            color:
                var(--muted);

            font-size: 12px;
            line-height: 1;

            cursor: pointer;
        }

        body:not(.mobile-app)
        .saved-targets-collapse-toggle:hover,
        body:not(.mobile-app)
        .saved-targets-collapse-toggle:focus-visible {
            border-color:
                var(--accent-border);

            background:
                var(--input-hover-bg);

            color:
                var(--accent);
        }

        body:not(.mobile-app)
        .saved-targets.is-collapsed {
            width: 205px;

            padding:
                9px
                10px;
        }

        body:not(.mobile-app)
        .saved-targets.is-collapsed
        .saved-targets-header {
            margin-bottom: 0;
        }

        body:not(.mobile-app)
        .saved-targets.is-collapsed
        > .saved-targets-list,

        body:not(.mobile-app)
        .saved-targets.is-collapsed
        > .saved-target-options,

        body:not(.mobile-app)
        .saved-targets.is-collapsed
        > .saved-target-actions {
            display: none;
        }
    `;

    document.head.appendChild(
        style
    );
}

function loadDesktopSavedTargetsCollapsed() {

    try {

        return (
            localStorage.getItem(
                SAVED_TARGETS_PANEL_COLLAPSED_KEY
            ) === 'true'
        );

    } catch (error) {

        return false;
    }
}

function saveDesktopSavedTargetsCollapsed(
    collapsed
) {

    try {

        localStorage.setItem(
            SAVED_TARGETS_PANEL_COLLAPSED_KEY,
            collapsed
                ? 'true'
                : 'false'
        );

    } catch (error) {

        console.warn(
            'Failed to save saved-targets panel state:',
            error
        );
    }
}

function setDesktopSavedTargetsCollapsed(
    collapsed,
    persist = true
) {

    const panel =
        document.querySelector(
            '.workspace .saved-targets'
        );

    const toggle =
        $('savedTargetsCollapseToggle');

    if (
        !panel ||
        !toggle
    ) {
        return;
    }

    const next =
        Boolean(
            collapsed
        );

    panel.classList.toggle(
        'is-collapsed',
        next
    );

    toggle.setAttribute(
        'aria-expanded',
        next
            ? 'false'
            : 'true'
    );

    toggle.textContent =
        next
            ? '▾'
            : '▴';

    const label =
        typeof tr ===
            'function'
            ? tr('savedTargets')
            : 'Saved targets';

    toggle.title =
        label;

    toggle.setAttribute(
        'aria-label',
        label
    );

    if (persist) {

        saveDesktopSavedTargetsCollapsed(
            next
        );
    }
}

function toggleDesktopSavedTargetsCollapsed() {

    const panel =
        document.querySelector(
            '.workspace .saved-targets'
        );

    if (!panel) {
        return;
    }

    setDesktopSavedTargetsCollapsed(
        !panel.classList.contains(
            'is-collapsed'
        )
    );
}

function initDesktopSavedTargetsCollapse() {

    const mobileApp =
        document.body.classList.contains(
            'mobile-app'
        );

    if (mobileApp) {
        return;
    }

    const panel =
        document.querySelector(
            '.workspace .saved-targets'
        );

    const header =
        panel?.querySelector(
            '.saved-targets-header'
        );

    if (
        !panel ||
        !header
    ) {
        return;
    }

    installDesktopSavedTargetsCollapseStyle();

    let toggle =
        $('savedTargetsCollapseToggle');

    if (!toggle) {

        toggle =
            document.createElement(
                'button'
            );

        toggle.id =
            'savedTargetsCollapseToggle';

        toggle.type =
            'button';

        toggle.className =
            'saved-targets-collapse-toggle';

        header.appendChild(
            toggle
        );

        toggle.addEventListener(
            'click',
            event => {

                event.preventDefault();
                event.stopPropagation();

                setDesktopSavedTargetsCollapsed(
                    !panel.classList.contains(
                        'is-collapsed'
                    )
                );
            }
        );
    }

    setDesktopSavedTargetsCollapsed(
        loadDesktopSavedTargetsCollapsed(),
        false
    );
}


;

/* js/ui/layout/coordinator.js */
/* =========================
   LAYOUT COORDINATOR
   ========================= */

const GUIDE_FAQ_HASH_IDS = new Set([
    'guide-getting-started',
    'guide-weapons',
    'guide-maps',
    'guide-tools',
    'wardogs-calculator-faq'
]);

function getGuideFaqHashTarget(hash = window.location.hash) {
    let id;

    try {
        id = decodeURIComponent(
            String(hash || '').replace(/^#/, '')
        );
    } catch {
        return null;
    }

    if (!GUIDE_FAQ_HASH_IDS.has(id)) return null;

    const drawer = $('guideFaqDrawer');
    const target = document.getElementById(id);

    return drawer?.contains(target) ? target : null;
}

function scrollGuideFaqTarget(target, behavior = 'auto') {
    const scroller = target?.closest('.guide-faq-scroll');

    if (!scroller) return;

    const top = Math.max(
        0,
        scroller.scrollTop +
        target.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        8
    );

    if (typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ top, behavior });
    } else {
        scroller.scrollTop = top;
    }
}

function openGuideFaqHashTarget(
    hash,
    {
        behavior = 'auto',
        restoreWorkspace = false
    } = {}
) {
    const target = getGuideFaqHashTarget(hash);

    if (!target) return false;

    if (restoreWorkspace) {
        window.scrollTo(0, 0);

        const dock = document.querySelector('.control-dock');
        const map = document.querySelector('.map');

        if (dock) dock.scrollTop = 0;
        if (map) {
            map.scrollTop = 0;
            map.scrollLeft = 0;
        }
    }

    setGuideFaqOpen(true);

    window.requestAnimationFrame(
        () => window.requestAnimationFrame(
            () => scrollGuideFaqTarget(target, behavior)
        )
    );

    return true;
}

function clearGuideFaqHash() {
    if (!getGuideFaqHashTarget()) return;

    window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`
    );
}

function setGuideFaqOpen(open, restoreFocus = false) {
    const button = $('guideFaqButton');
    const drawer = $('guideFaqDrawer');

    if (!button || !drawer) return;

    const isOpen = Boolean(open);

    drawer.classList.toggle('is-open', isOpen);
    drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    if (isOpen) {
        drawer.removeAttribute('inert');
        window.requestAnimationFrame(() => $('guideFaqClose')?.focus());
    } else {
        drawer.setAttribute('inert', '');
        if (restoreFocus) button.focus();
    }
}

function initGuideFaq() {
    const button = $('guideFaqButton');
    const close = $('guideFaqClose');
    const drawer = $('guideFaqDrawer');

    if (!button || !close || !drawer || button.dataset.guideBound === 'true') {
        return;
    }

    button.dataset.guideBound = 'true';
    const closeDrawer = restoreFocus => {
        setGuideFaqOpen(false, restoreFocus);
        clearGuideFaqHash();
    };

    button.addEventListener(
        'click',
        () => {
            if (drawer.classList.contains('is-open')) {
                closeDrawer(false);
            } else {
                setGuideFaqOpen(true);
            }
        }
    );
    close.addEventListener('click', () => closeDrawer(true));
    drawer.addEventListener(
        'click',
        event => {
            const link = event.target.closest('a[href^="#"]');
            const target = link
                ? getGuideFaqHashTarget(link.hash)
                : null;

            if (!link || !target) return;

            event.preventDefault();

            window.history.pushState(
                window.history.state,
                '',
                `${window.location.pathname}${window.location.search}${link.hash}`
            );

            openGuideFaqHashTarget(
                link.hash,
                { behavior: 'smooth' }
            );
        }
    );
    document.addEventListener(
        'keydown',
        event => {
            if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
                closeDrawer(true);
            }
        }
    );
    window.addEventListener(
        'hashchange',
        () => openGuideFaqHashTarget(
            window.location.hash,
            { restoreWorkspace: true }
        )
    );

    /*
     * Keep the drawer display:none while the initial document fragment is
     * resolved. Otherwise the browser can scroll the whole map to a target
     * that lives inside the off-canvas guide before application startup.
     */
    const openedFromHash = document.readyState === 'complete'
        ? openGuideFaqHashTarget(
            window.location.hash,
            { restoreWorkspace: true }
        )
        : false;

    if (!openedFromHash) setGuideFaqOpen(false);

    window.addEventListener(
        'load',
        () => openGuideFaqHashTarget(
            window.location.hash,
            { restoreWorkspace: true }
        ),
        { once: true }
    );
}

function updateLayoutLocalization() {

    const setAriaLabel = (id, key) => {
        const element = $(id);
        if (element && typeof tr === 'function') {
            element.setAttribute('aria-label', tr(key));
            element.setAttribute('title', tr(key));
        }
    };

    setAriaLabel('zoomOut', 'zoomOutLabel');
    setAriaLabel('zoomIn', 'zoomInLabel');
    setAriaLabel('fit', 'fit');
    setAriaLabel('guideFaqClose', 'accessibilityClose');
    setAriaLabel('coordinateOriginCopy', 'copyCoordinates');
    setAriaLabel('coordinateTargetCopy', 'copyCoordinates');
    setAriaLabel('coordinateOriginPaste', 'pasteCoordinates');
    setAriaLabel('coordinateTargetPaste', 'pasteCoordinates');

    if (typeof tr === 'function') {
        const pointMode =
            document.querySelector(
                '.point-mode'
            );

        pointMode?.setAttribute(
            'aria-label',
            tr('pointSelection')
        );

        [
            ['ox', 'artillery', 'X'],
            ['oy', 'artillery', 'Y'],
            ['tx', 'target', 'X'],
            ['ty', 'target', 'Y']
        ].forEach(([id, key, axis]) => {
            $(id)?.setAttribute(
                'aria-label',
                `${tr(key)} ${axis}`
            );
        });
    }

    if (
        document.body.classList.contains(
            'mobile-app'
        )
    ) {
        syncMobileThemeButtons();
        syncMobileSideMenuLocalization();

        setAriaLabel('mobileSheetHandle', 'mobileOpenCalculator');
        setAriaLabel('mobileSideMenu', 'mobileMenu');
        setAriaLabel('mobileSideMenuToggle', 'mobileMenu');
        setAriaLabel('mobileSideMenuBackdrop', 'mobileCloseMenu');

        const tabs = document.querySelector('.mobile-tabs');
        if (tabs && typeof tr === 'function') {
            tabs.setAttribute('aria-label', tr('mobileCalculatorSections'));
        }
    }
}

function initLayout() {

    initAccessibility();

    const mobileApp =
        document.body.classList.contains(
            'mobile-app'
        );

    if (!mobileApp) {
        initDesktopSavedTargetsCollapse();
        initGuideFaq();

    } else {
        initMobileSideMenu();
        initMobileSphLevelWarning();
    }

    const map =
        document.querySelector(
            '.map'
        );

    if (
        map &&
        typeof ResizeObserver !==
        'undefined'
    ) {

        mapResizeObserver =
            new ResizeObserver(
                () => {

                    if (
                        typeof resize ===
                        'function'
                    ) {
                        resize();
                    }
                }
            );

        mapResizeObserver.observe(
            map
        );
    }

    updateLayoutLocalization();
}

;

/* js/features/saved-targets.js */
/* =========================
   SAVED TARGETS
   ========================= */

const SAVED_TARGET_EXPORT_TYPE =
    'wardogs-saved-target';

const SAVED_TARGETS_EXPORT_TYPE =
    'wardogs-saved-targets';

const SAVED_TARGET_EXPORT_VERSION = 1;

const SAVED_TARGET_IMPORT_LIMIT = 500;
const SAVED_TARGET_TOTAL_LIMIT = 2000;

/*
 * Both sides of the comparison have been through clamp(), which rounds
 * to a fixed precision, so they land on the same quantum — but that
 * rounding is a float division, so === is not safe to lean on.
 */
const SAVED_TARGET_MATCH_EPSILON = 1e-6;

/*
 * Which saved targets the list highlights is derived from where the
 * target actually sits, never tracked separately, so every writer of
 * S.target keeps the highlight honest without having to know about it.
 */
function activeSavedTargetIds() {

    const active = new Set();

    if (
        !S.target ||
        !Number.isFinite(S.target.x) ||
        !Number.isFinite(S.target.y)
    ) {
        return active;
    }

    savedTargets.forEach(
        target => {

            if (
                Math.abs(
                    Number(target.x) -
                    S.target.x
                ) < SAVED_TARGET_MATCH_EPSILON &&
                Math.abs(
                    Number(target.y) -
                    S.target.y
                ) < SAVED_TARGET_MATCH_EPSILON
            ) {
                active.add(
                    String(target.id)
                );
            }
        }
    );

    return active;
}

/*
 * inputs() runs on every frame of a map drag, so this toggles the class
 * on the rows already in the DOM rather than rebuilding the list. A
 * full renderSavedTargets() is still what runs when the targets
 * themselves change.
 */
function refreshSavedTargetHighlight() {

    const container =
        $('savedTargetsList');

    if (!container) {
        return;
    }

    const activeIds =
        activeSavedTargetIds();

    container
        .querySelectorAll('.saved-target')
        .forEach(
            item => {
                item.classList.toggle(
                    'active',
                    activeIds.has(
                        item.dataset.targetId
                    )
                );
            }
        );
}

function generateTargetId() {

    return (
        Date.now().toString(36) +
        '-' +
        Math.random()
            .toString(36)
            .slice(2, 9)
    );
}

function loadSavedTargets() {

    try {

        const raw =
            localStorage.getItem(
                SAVED_TARGETS_KEY
            );

        if (!raw) {
            savedTargets = [];
            return;
        }

        const parsed =
            JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            savedTargets = [];
            return;
        }

        savedTargets =
            parsed
                .slice(0, SAVED_TARGET_TOTAL_LIMIT)
                .filter(
                    target =>
                        target &&
                        typeof target.id === 'string' &&
                        Number.isFinite(Number(target.x)) &&
                        Number.isFinite(Number(target.y))
                )
                .map(target => ({
                    id: target.id.slice(0, 128),
                    x: Number(target.x),
                    y: Number(target.y),

                    name:
                        typeof target.name === 'string' &&
                        target.name.trim()
                            ? target.name.trim().slice(0, 120)
                            : createTargetName(),

                    saveArtillery: Boolean(
                        target.saveArtillery &&
                        target.origin &&
                        Number.isFinite(Number(target.origin.x)) &&
                        Number.isFinite(Number(target.origin.y))
                    ),

                    origin:
                        target.saveArtillery &&
                        target.origin &&
                        Number.isFinite(Number(target.origin.x)) &&
                        Number.isFinite(Number(target.origin.y))
                            ? {
                                x: Number(target.origin.x),
                                y: Number(target.origin.y)
                            }
                            : null
                }));

    } catch (error) {

        console.error(
            'Failed to load saved targets:',
            error
        );

        savedTargets = [];
    }
}

function persistSavedTargets(targets = savedTargets) {
    if (lobby?.active) { lobby.capture(); return true; }

    try {
        localStorage.setItem(
            SAVED_TARGETS_KEY,
            JSON.stringify(targets)
        );
        return true;
    } catch (error) {
        console.warn('Failed to save targets:', error);
        return false;
    }
}

/* =========================
   ARTILLERY / TARGET POSITIONS
   ========================= */

/*
 * Where the two points sit is worth keeping across a reload: coming back
 * to a gun laid on the wrong side of the map means placing it again every
 * single time.
 *
 * Every map keeps its own entry, keyed by map id, because the coordinates
 * are meaningless on a different map. Switching maps restores that map's
 * pair and leaves the others untouched.
 */
const MAP_POINTS_WRITE_DELAY_MS = 300;

let mapPointsWriteTimer = null;

function persistMapPoints() {
    if (lobby?.active) { lobby.capture(); return; }

    /*
     * inputs() runs on every frame of a drag, so the write trails the
     * gesture instead of hitting localStorage a hundred times across it.
     */
    if (mapPointsWriteTimer) {
        return;
    }

    mapPointsWriteTimer = setTimeout(
        () => {
            mapPointsWriteTimer = null;
            writeMapPoints();
        },
        MAP_POINTS_WRITE_DELAY_MS
    );
}

function readMapPointsStore() {

    const raw =
        localStorage.getItem(
            MAP_POINTS_KEY
        );

    if (!raw) {
        return {};
    }

    let parsed = null;

    try {
        parsed =
            JSON.parse(raw);
    } catch (error) {
        return {};
    }

    if (
        !parsed ||
        typeof parsed !== 'object'
    ) {
        return {};
    }

    /*
     * The first release stored a single { map, origin, target } object;
     * fold that lone map into the keyed shape instead of dropping it.
     */
    if (
        typeof parsed.map === 'string'
    ) {

        return {
            [parsed.map]: {
                origin: parsed.origin,
                target: parsed.target
            }
        };
    }

    return parsed;
}

function writeMapPoints() {
    if (lobby?.active) return;

    try {
        const store =
            readMapPointsStore();

        store[S.map] = {
            origin: {
                x: S.origin.x,
                y: S.origin.y
            },
            target: {
                x: S.target.x,
                y: S.target.y
            }
        };

        localStorage.setItem(
            MAP_POINTS_KEY,
            JSON.stringify(store)
        );
    } catch (error) {
        console.warn(
            'Failed to save map points:',
            error
        );
    }
}

function readStoredPoint(value) {

    return (
        value &&
        Number.isFinite(Number(value.x)) &&
        Number.isFinite(Number(value.y))
    )
        ? {
            x: Number(value.x),
            y: Number(value.y)
        }
        : null;
}

function loadMapPoints() {

    try {
        const stored =
            readMapPointsStore()[S.map];

        if (!stored) {
            return;
        }

        const origin =
            readStoredPoint(stored.origin);

        const target =
            readStoredPoint(stored.target);

        if (origin) {
            S.origin = origin;
        }

        if (target) {
            S.target = target;
        }

    } catch (error) {
        console.warn(
            'Failed to load map points:',
            error
        );
    }
}

function getSaveArtilleryPreference() {

    return (
        localStorage.getItem(
            SAVE_ARTILLERY_KEY
        ) === 'true'
    );
}

function loadSaveArtilleryPreference() {

    const checkbox =
        $('saveArtilleryPosition');

    checkbox.checked =
        getSaveArtilleryPreference();
}

function saveArtilleryPreference() {

    localStorage.setItem(
        SAVE_ARTILLERY_KEY,
        checkboxValue(
            $('saveArtilleryPosition')
        )
            ? 'true'
            : 'false'
    );
}

function checkboxValue(element) {

    return Boolean(
        element &&
        element.checked
    );
}

function createTargetName() {

    let number =
        1;

    const existing =
        new Set(
            savedTargets.map(
                target =>
                    target.name
            )
        );

    while (
        existing.has(
            `Target ${number}`
        )
        ) {
        number++;
    }

    return `Target ${number}`;
}

function savedTargetTransferStatus(
    key = null,
    count = 0,
    isError = false
) {
    const status =
        $('savedTargetsTransferStatus');

    if (!status) {
        return;
    }

    status.textContent = key
        ? tr(key).replace(
            '{count}',
            String(count)
        )
        : '';

    status.classList.toggle(
        'error',
        Boolean(isError)
    );
}

function savedTargetForExport(target) {
    const saveArtillery =
        Boolean(
            target.saveArtillery &&
            target.origin &&
            Number.isFinite(
                Number(target.origin.x)
            ) &&
            Number.isFinite(
                Number(target.origin.y)
            )
        );

    return {
        name:
            typeof target.name ===
            'string'
                ? target.name
                : '',
        x: Number(target.x),
        y: Number(target.y),
        saveArtillery,
        origin:
            saveArtillery
                ? {
                    x:
                        Number(
                            target.origin.x
                        ),
                    y:
                        Number(
                            target.origin.y
                        )
                }
                : null
    };
}

function exportSavedTarget(target) {
    if (!target) {
        return;
    }

    const payload = {
        type: SAVED_TARGET_EXPORT_TYPE,
        version:
            SAVED_TARGET_EXPORT_VERSION,
        exportedAt:
            new Date().toISOString(),
        target:
            savedTargetForExport(
                target
            )
    };

    const fileName =
        sanitizeWardogsFilenamePart(
            target.name,
            'target'
        );

    downloadWardogsJson(
        `wardogs-target-${fileName}.json`,
        payload
    );

    savedTargetTransferStatus();

    if (
        typeof trackAnalytics ===
        'function'
    ) {
        trackAnalytics(
            'target-exported',
            {
                withArtillery:
                    Boolean(
                        payload.target
                            .saveArtillery
                    )
            }
        );
    }
}

function exportAllSavedTargets() {
    if (!savedTargets.length) {
        return;
    }

    const payload = {
        type: SAVED_TARGETS_EXPORT_TYPE,
        version:
            SAVED_TARGET_EXPORT_VERSION,
        exportedAt:
            new Date().toISOString(),
        targets:
            savedTargets.map(
                savedTargetForExport
            )
    };

    downloadWardogsJson(
        `wardogs-saved-targets-${wardogsExportTimestamp()}.json`,
        payload
    );

    savedTargetTransferStatus();

    if (
        typeof trackAnalytics ===
        'function'
    ) {
        trackAnalytics(
            'targets-exported',
            {
                count:
                    payload.targets.length
            }
        );
    }
}

function uniqueImportedTargetName(
    value,
    takenNames
) {
    const base =
        typeof value === 'string' &&
        value.trim()
            ? value.trim().slice(0, 120)
            : createTargetName();

    if (!takenNames.has(base)) {
        takenNames.add(base);
        return base;
    }

    let suffix = 2;
    let candidate =
        `${base} (${suffix})`;

    while (takenNames.has(candidate)) {
        suffix++;
        candidate =
            `${base} (${suffix})`;
    }

    takenNames.add(candidate);
    return candidate;
}

function normalizeImportedSavedTarget(
    target,
    takenNames
) {
    if (
        !target ||
        typeof target !== 'object' ||
        !Number.isFinite(
            Number(target.x)
        ) ||
        !Number.isFinite(
            Number(target.y)
        )
    ) {
        return null;
    }

    const hasOrigin =
        Boolean(
            target.saveArtillery &&
            target.origin &&
            Number.isFinite(
                Number(target.origin.x)
            ) &&
            Number.isFinite(
                Number(target.origin.y)
            )
        );

    return {
        id: generateTargetId(),
        name:
            uniqueImportedTargetName(
                target.name,
                takenNames
            ),
        x: Number(target.x),
        y: Number(target.y),
        saveArtillery: hasOrigin,
        origin:
            hasOrigin
                ? {
                    x:
                        Number(
                            target.origin.x
                        ),
                    y:
                        Number(
                            target.origin.y
                        )
                }
                : null
    };
}

function extractImportedSavedTargets(
    payload
) {
    if (
        !payload ||
        typeof payload !== 'object'
    ) {
        throw new Error(
            'Invalid saved target payload'
        );
    }

    let source = null;
    let format = 'single';

    if (Array.isArray(payload)) {
        source = payload;
        format = 'list';

    } else if (
        payload.type ===
            SAVED_TARGET_EXPORT_TYPE &&
        payload.target
    ) {
        source = [payload.target];

    } else if (
        payload.type ===
            SAVED_TARGETS_EXPORT_TYPE &&
        Array.isArray(payload.targets)
    ) {
        source = payload.targets;
        format = 'list';

    } else if (
        Array.isArray(payload.targets)
    ) {
        source = payload.targets;
        format = 'list';

    } else if (payload.target) {
        source = [payload.target];

    } else if (
        Number.isFinite(Number(payload.x)) &&
        Number.isFinite(Number(payload.y))
    ) {
        source = [payload];
    }

    if (!source) {
        throw new Error(
            'No saved targets found'
        );
    }

    const takenNames =
        new Set(
            savedTargets.map(
                target => target.name
            )
        );

    const targets =
        source
            .slice(
                0,
                SAVED_TARGET_IMPORT_LIMIT
            )
            .map(
                target =>
                    normalizeImportedSavedTarget(
                        target,
                        takenNames
                    )
            )
            .filter(Boolean);

    if (!targets.length) {
        throw new Error(
            'No valid saved targets found'
        );
    }

    return {
        targets,
        format
    };
}

async function importSavedTargets() {
    try {
        const file =
            await selectWardogsJsonFile();

        if (!file) {
            return;
        }

        const payload =
            await readWardogsJsonFile(
                file
            );

        const imported =
            extractImportedSavedTargets(
                payload
            );

        const nextTargets = [
            ...savedTargets,
            ...imported.targets
        ];

        if (nextTargets.length > SAVED_TARGET_TOTAL_LIMIT) {
            throw new Error('Saved target limit exceeded');
        }

        const collaborative = lobby?.active === true;

        if (!collaborative && !persistSavedTargets(nextTargets)) {
            throw new Error('Saved targets could not be persisted');
        }

        savedTargets = nextTargets;

        if (collaborative) {
            lobby.capture();
        }
        renderSavedTargets();

        savedTargetTransferStatus(
            'savedTargetsImportSuccess',
            imported.targets.length
        );

        if (
            typeof trackAnalytics ===
            'function'
        ) {
            trackAnalytics(
                'targets-imported',
                {
                    count:
                        imported.targets.length,
                    format:
                        imported.format
                }
            );
        }

    } catch (error) {
        console.warn(
            'Failed to import saved targets:',
            error
        );

        savedTargetTransferStatus(
            'savedTargetsImportInvalid',
            0,
            true
        );
    }
}

function saveCurrentTarget() {

    const saveArtillery =
        checkboxValue(
            $('saveArtilleryPosition')
        );

    const target = {

        id:
            generateTargetId(),

        name:
            createTargetName(),

        x:
            Number(
                S.target.x
            ),

        y:
            Number(
                S.target.y
            ),

        saveArtillery,

        origin:
            saveArtillery
                ? {
                    x: Number(
                        S.origin.x
                    ),
                    y: Number(
                        S.origin.y
                    )
                }
                : null
    };

    if (savedTargets.length >= SAVED_TARGET_TOTAL_LIMIT) {
        return;
    }

    const nextTargets = [
        ...savedTargets,
        target
    ];

    if (!lobby?.active && !persistSavedTargets(nextTargets)) {
        return;
    }

    savedTargets = nextTargets;

    if (lobby?.active) {
        lobby.capture();
    }

    if (
        typeof trackAnalytics ===
        'function'
    ) {
        trackAnalytics(
            'target-saved',
            {
                withArtillery:
                    saveArtillery
            }
        );
    }

    renderSavedTargets();
}

function deleteTarget(id) {

    const index =
        savedTargets.findIndex(
            target =>
                target.id === id
        );

    if (index === -1) {
        return;
    }

    const nextTargets = savedTargets.filter(
        (_, targetIndex) => targetIndex !== index
    );

    if (!lobby?.active && !persistSavedTargets(nextTargets)) {
        return;
    }

    savedTargets = nextTargets;

    if (lobby?.active) {
        lobby.capture();
    }

    renderSavedTargets();
}

function editTargetName(id) {

    const target =
        savedTargets.find(
            item =>
                item.id === id
        );

    if (!target) {
        return;
    }

    const name =
        window.prompt(
            tr('targetNamePrompt'),
            target.name
        );

    if (name === null) {
        return;
    }

    const trimmed =
        name.trim();

    if (!trimmed) {
        return;
    }

    const nextTargets = savedTargets.map(item => (
        item.id === id
            ? {
                ...item,
                name: trimmed.slice(0, 120)
            }
            : item
    ));

    if (!lobby?.active && !persistSavedTargets(nextTargets)) {
        return;
    }

    savedTargets = nextTargets;

    if (lobby?.active) {
        lobby.capture();
    }

    renderSavedTargets();
}

function restoreTarget(target) {

    if (!target) {
        return;
    }

    pushMapToolHistory();

    S.target = {
        x: Number(target.x),
        y: Number(target.y)
    };

    if (
        target.saveArtillery &&
        target.origin &&
        typeof target.origin.x === 'number' &&
        typeof target.origin.y === 'number'
    ) {

        S.origin = {
            x: Number(target.origin.x),
            y: Number(target.origin.y)
        };
    }

    clamp(S.target);
    clamp(S.origin);

    if (
        typeof trackAnalytics ===
        'function'
    ) {
        trackAnalytics(
            'target-restored',
            {
                withArtillery:
                    Boolean(
                        target.saveArtillery &&
                        target.origin
                    )
            }
        );
    }

    inputs();
    renderSavedTargets();
}

function renderSavedTargets() {

    const container =
        $('savedTargetsList');

    if (!container) {
        return;
    }

    container.innerHTML = '';

    const count =
        $('savedTargetsCount');

    if (count) {
        count.textContent =
            savedTargets.length;
    }

    const exportAllButton =
        $('exportSavedTargets');

    if (exportAllButton) {
        exportAllButton.disabled =
            savedTargets.length === 0;
    }

    if (!savedTargets.length) {

        const empty =
            document.createElement(
                'div'
            );

        empty.className =
            'saved-target-empty';

        empty.textContent =
            tr('noSavedTargets');

        container.appendChild(
            empty
        );

        return;
    }

    const activeIds =
        activeSavedTargetIds();

    savedTargets.forEach(
        target => {

            const item =
                document.createElement(
                    'div'
                );

            item.className =
                'saved-target';

            item.dataset.targetId =
                target.id;

            if (
                activeIds.has(
                    String(target.id)
                )
            ) {
                item.classList.add(
                    'active'
                );
            }

            item.addEventListener(
                'click',
                () => {
                    restoreTarget(
                        target
                    );
                }
            );

            const info =
                document.createElement(
                    'div'
                );

            info.className =
                'saved-target-info';

            const name =
                document.createElement(
                    'span'
                );

            name.className =
                'saved-target-name';

            name.textContent =
                target.name;

            const coords =
                document.createElement(
                    'span'
                );

            coords.className =
                'saved-target-coords';

            coords.textContent =
                `X ${formatGameCoordinate(target.x)} · Y ${formatGameCoordinate(target.y)}`;

            info.appendChild(
                name
            );

            info.appendChild(
                coords
            );

            const actions =
                document.createElement(
                    'div'
                );

            actions.className =
                'saved-target-actions-inline';

            const exportButton =
                document.createElement(
                    'button'
                );

            exportButton.type =
                'button';

            exportButton.className =
                'saved-target-icon-button saved-target-export';

            exportButton.textContent =
                '⇩';

            exportButton.title =
                tr('exportTarget');

            exportButton.setAttribute(
                'aria-label',
                tr('exportTarget')
            );

            exportButton.addEventListener(
                'click',
                event => {
                    event.stopPropagation();
                    exportSavedTarget(
                        target
                    );
                }
            );

            const edit =
                document.createElement(
                    'button'
                );

            edit.type =
                'button';

            edit.className =
                'saved-target-icon-button';

            edit.textContent =
                '✎';

            edit.title =
                tr('edit');

            edit.setAttribute(
                'aria-label',
                tr('edit')
            );

            edit.addEventListener(
                'click',
                event => {

                    event.stopPropagation();

                    editTargetName(
                        target.id
                    );
                }
            );

            const remove =
                document.createElement(
                    'button'
                );

            remove.type =
                'button';

            remove.className =
                'saved-target-icon-button';

            remove.textContent =
                '×';

            remove.title =
                tr('delete');

            remove.setAttribute(
                'aria-label',
                tr('delete')
            );

            remove.addEventListener(
                'click',
                event => {

                    event.stopPropagation();

                    deleteTarget(
                        target.id
                    );
                }
            );

            actions.appendChild(
                exportButton
            );

            actions.appendChild(
                edit
            );

            actions.appendChild(
                remove
            );

            item.appendChild(
                info
            );

            item.appendChild(
                actions
            );

            container.appendChild(
                item
            );
        }
    );
}

;

/* js/features/motd.js */
const MOTD_DISMISSED_PREFIX =
    'wardogs-motd-dismissed:';

const MOTD_READ_PREFIX =
    'wardogs-motd-read:';

let currentMobileMotd =
    null;

let currentDesktopMotd =
    null;

function getLocalizedMotdValue(value) {
    if (typeof value === 'string') {
        return value;
    }

    if (!value || typeof value !== 'object') {
        return '';
    }

    return (
        value[LANG] ??
        value[DEFAULT_LANG] ??
        value.en ??
        Object.values(value).find(
            item => typeof item === 'string'
        ) ??
        ''
    );
}

function formatMotdMessage(message) {
    return String(message ?? '')
        .replace(/\\n/g, '\n');
}

function renderMotdMessage(container, message) {
    const text =
        formatMotdMessage(message);

    const linkPattern =
        /\[([^\]\n]+)\]\((https:\/\/[^)\s]+)\)/g;

    let cursor = 0;
    let match;

    while ((match = linkPattern.exec(text)) !== null) {
        if (match.index > cursor) {
            container.appendChild(
                document.createTextNode(
                    text.slice(cursor, match.index)
                )
            );
        }

        const link =
            document.createElement('a');

        link.textContent =
            match[1];

        link.href =
            match[2];

        link.target =
            '_blank';

        link.rel =
            'noopener noreferrer';

        container.appendChild(link);

        cursor =
            linkPattern.lastIndex;
    }

    if (cursor < text.length) {
        container.appendChild(
            document.createTextNode(
                text.slice(cursor)
            )
        );
    }
}

function isMotdActive(motd) {
    if (!motd || motd.enabled !== true) {
        return false;
    }

    const now = Date.now();

    if (motd.startsAt) {
        const startsAt = Date.parse(motd.startsAt);

        if (
            !Number.isNaN(startsAt) &&
            now < startsAt
        ) {
            return false;
        }
    }

    if (motd.endsAt) {
        const endsAt = Date.parse(motd.endsAt);

        if (
            !Number.isNaN(endsAt) &&
            now >= endsAt
        ) {
            return false;
        }
    }

    return true;
}

function getMotdStorageKey(id) {
    return `${MOTD_DISMISSED_PREFIX}${id}`;
}

function getMotdReadStorageKey(id) {
    return `${MOTD_READ_PREFIX}${id}`;
}

function isMotdDismissed(id) {
    if (!id) {
        return false;
    }

    try {
        return (
            localStorage.getItem(
                getMotdStorageKey(id)
            ) === 'true'
        );
    } catch (error) {
        console.warn(
            'Failed to read MOTD state:',
            error
        );

        return false;
    }
}

function dismissMotd(id) {
    if (!id) {
        return;
    }

    try {
        localStorage.setItem(
            getMotdStorageKey(id),
            'true'
        );
    } catch (error) {
        console.warn(
            'Failed to save MOTD state:',
            error
        );
    }
}

function isMotdRead(id) {
    if (!id) {
        return true;
    }

    try {
        return (
            localStorage.getItem(
                getMotdReadStorageKey(id)
            ) === 'true'
        );
    } catch (error) {
        console.warn(
            'Failed to read MOTD read state:',
            error
        );

        return false;
    }
}

function markMotdRead(id) {
    if (!id) {
        return;
    }

    try {
        localStorage.setItem(
            getMotdReadStorageKey(id),
            'true'
        );
    } catch (error) {
        console.warn(
            'Failed to save MOTD read state:',
            error
        );
    }
}

function isMobileMotdUI() {
    return document.body.classList.contains(
        'mobile-app'
    );
}

function removeExistingMotd() {
    document
        .querySelectorAll('.motd')
        .forEach(
            element => {
                element.remove();
            }
        );

    syncMobileMotdButton();
    syncDesktopMotdButton();
}

function closeMotd(
    container,
    motd,
    dontShowAgain
) {
    const dismiss =
        Boolean(
            dontShowAgain?.checked &&
            motd.id
        );

    if (dismiss) {
        dismissMotd(
            motd.id
        );
    }

    container.classList.add(
        'motd--closing'
    );

    window.setTimeout(
        () => {
            container.remove();

            if (
                dismiss &&
                isMobileMotdUI() &&
                currentMobileMotd?.id ===
                    motd.id
            ) {
                currentMobileMotd =
                    null;
            }

            syncMobileMotdButton();
            syncDesktopMotdButton();
        },
        150
    );
}

function createMotd(motd) {
    removeExistingMotd();

    const container =
        document.createElement(
            'aside'
        );

    container.className =
        'motd';

    container.setAttribute(
        'role',
        'status'
    );

    container.setAttribute(
        'aria-live',
        'polite'
    );

    const header =
        document.createElement(
            'div'
        );

    header.className =
        'motd-header';

    const title =
        document.createElement(
            'div'
        );

    title.className =
        'motd-title';

    title.textContent =
        getLocalizedMotdValue(
            motd.title
        ) ||
        'Message';

    const closeButton =
        document.createElement(
            'button'
        );

    closeButton.className =
        'motd-close';

    closeButton.type =
        'button';

    closeButton.textContent =
        '×';

    closeButton.setAttribute(
        'aria-label',
        tr('motdClose')
    );

    closeButton.title =
        tr('motdClose');

    header.append(
        title,
        closeButton
    );

    const message =
        document.createElement(
            'div'
        );

    message.className =
        'motd-message';

    renderMotdMessage(
        message,
        getLocalizedMotdValue(
            motd.message
        )
    );

    container.append(
        header,
        message
    );

    closeButton.addEventListener(
        'click',
        () => {

            closeMotd(
                container,
                motd,
                null
            );
        }
    );

    document.body.appendChild(
        container
    );

    requestAnimationFrame(
        () => {

            container.classList.add(
                'motd--visible'
            );

            syncMobileMotdButton();
            syncDesktopMotdButton();
        }
    );

    return container;
}

function createDesktopMotdButton() {
    let button =
        document.getElementById(
            'desktopMotdButton'
        );

    if (button) {
        return button;
    }

    button =
        document.createElement(
            'button'
        );

    button.id =
        'desktopMotdButton';

    button.type =
        'button';

    button.className =
        'desktop-motd-button';

    button.hidden = true;

    button.innerHTML = `
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path
                d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
            ></path>
            <path d="M10 21h4"></path>
        </svg>
        <span class="desktop-motd-dot"></span>
    `;

    button.addEventListener(
        'click',
        event => {
            event.preventDefault();
            event.stopPropagation();

            if (!currentDesktopMotd) {
                return;
            }

            markMotdRead(
                currentDesktopMotd.id
            );

            button.hidden = true;

            createMotd(
                currentDesktopMotd
            );
        }
    );

    const controls =
        document.querySelector(
            'header .header-controls'
        );

    if (!controls) {
        return null;
    }

    const themeToggle =
        controls.querySelector(
            '#themeToggle'
        );

    if (themeToggle) {
        controls.insertBefore(
            button,
            themeToggle
        );
    } else {
        controls.appendChild(
            button
        );
    }

    return button;
}

function syncDesktopMotdButton() {
    if (isMobileMotdUI()) {
        return;
    }

    const button =
        createDesktopMotdButton();

    if (!button) {
        return;
    }

    const hasMotd =
        Boolean(
            currentDesktopMotd?.id
        );

    const fullMotdOpen =
        Boolean(
            document.querySelector(
                '.motd'
            )
        );

    button.hidden =
        !hasMotd ||
        fullMotdOpen;

    button.classList.toggle(
        'has-unread',
        hasMotd &&
        !isMotdRead(
            currentDesktopMotd.id
        )
    );

    const label =
        tr('motdTitle');

    button.setAttribute(
        'aria-label',
        label
    );

    button.title =
        label;
}

function createMobileMotdButton() {
    let button =
        document.getElementById(
            'mobileMotdButton'
        );

    if (button) {
        return button;
    }

    const controls =
        document.querySelector(
            '.mobile-header-controls'
        );

    if (!controls) {
        return null;
    }

    button =
        document.createElement(
            'button'
        );

    button.id =
        'mobileMotdButton';

    button.type =
        'button';

    button.className =
        'mobile-motd-button';

    button.hidden =
        true;

    button.setAttribute(
        'aria-expanded',
        'false'
    );

    button.innerHTML = `
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path
                d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
            ></path>
            <path d="M10 21h4"></path>
        </svg>
    `;

    button.addEventListener(
        'click',
        event => {

            event.preventDefault();
            event.stopPropagation();

            if (!currentMobileMotd) {
                return;
            }

            const existing =
                document.querySelector(
                    '.motd'
                );

            if (existing) {
                existing.remove();
                syncMobileMotdButton();
                return;
            }

            /*
             * Reading is separate from "Don't show again":
             * opening the bell clears only the unread highlight,
             * while the same message can still be reopened later.
             */
            markMotdRead(
                currentMobileMotd.id
            );

            syncMobileMotdButton();

            createMotd(
                currentMobileMotd
            );
        }
    );

    const menuToggle =
        document.getElementById(
            'mobileSideMenuToggle'
        );

    if (
        menuToggle &&
        menuToggle.parentElement ===
            controls
    ) {
        controls.insertBefore(
            button,
            menuToggle
        );
    } else {
        controls.appendChild(
            button
        );
    }

    updateMotdLocalization();

    return button;
}

function syncMobileMotdButton() {
    if (!isMobileMotdUI()) {
        return;
    }

    const button =
        createMobileMotdButton();

    if (!button) {
        return;
    }

    const hasMotd =
        Boolean(
            currentMobileMotd?.id
        );

    button.hidden =
        !hasMotd;

    if (!hasMotd) {
        button.classList.remove(
            'has-unread'
        );

        button.setAttribute(
            'aria-expanded',
            'false'
        );

        return;
    }

    const unread =
        !isMotdRead(
            currentMobileMotd.id
        );

    button.classList.toggle(
        'has-unread',
        unread
    );

    button.setAttribute(
        'aria-expanded',
        document.querySelector(
            '.motd'
        )
            ? 'true'
            : 'false'
    );
}

function updateMotdLocalization() {
    const button =
        document.getElementById(
            'mobileMotdButton'
        );

    if (!button) {
        return;
    }

    const label =
        tr('motdTitle');

    button.setAttribute(
        'aria-label',
        label
    );

    button.title =
        label;
}

async function loadMotd() {
    try {
        const resource =
            versionStaticResource(
                resourceURL(
                    'data/motd.json'
                )
            );

        const response =
            await fetch(
                resource.url,
                {
                    cache:
                        resource.versioned
                            ? 'force-cache'
                            : 'no-cache'
                }
            );

        if (!response.ok) {
            if (
                response.status !== 404
            ) {
                console.warn(
                    `Failed to load MOTD: ${response.status}`
                );
            }

            return null;
        }

        const motd =
            await response.json();

        if (
            !isMotdActive(
                motd
            )
        ) {
            return null;
        }

        if (!motd.id) {
            console.warn(
                'MOTD is enabled but has no id.'
            );

            return null;
        }

        if (
            isMotdDismissed(
                motd.id
            )
        ) {
            return null;
        }

        return motd;

    } catch (error) {

        console.warn(
            'Failed to load MOTD:',
            error
        );

        return null;
    }
}

async function initMotd() {
    const motd =
        await loadMotd();

    /*
     * Never inject the full announcement automatically. A late async text
     * card can become the page's LCP long after the calculator is usable.
     * Mobile and desktop both expose a lightweight notification control; the
     * full MOTD is painted only after an explicit user interaction.
     */
    if (isMobileMotdUI()) {

        currentMobileMotd =
            motd;

        createMobileMotdButton();
        syncMobileMotdButton();

        return;
    }

    currentDesktopMotd =
        motd;

    createDesktopMotdButton();
    syncDesktopMotdButton();
}

;

/* js/features/weapons.js */
/* =========================
   WEAPONS
   ========================= */

let DEFAULT_WEAPON = null;

function normalizeBallisticTable(table) {
    if (!Array.isArray(table)) {
        return [];
    }

    return table
        .map(entry => {
            if (!Array.isArray(entry) || entry.length < 2) {
                return null;
            }

            const distance = Number(entry[0]);
            const mil = Number(entry[1]);

            return (
                Number.isFinite(distance) &&
                Number.isFinite(mil)
            )
                ? [distance, mil]
                : null;
        })
        .filter(Boolean);
}

function normalizeBallistics(ballistics) {
    if (!ballistics || typeof ballistics !== 'object') {
        return null;
    }

    const normalized = {
        single: normalizeBallisticTable(ballistics.single),
        low: normalizeBallisticTable(ballistics.low),
        high: normalizeBallisticTable(ballistics.high)
    };

    return (
        normalized.single.length ||
        normalized.low.length ||
        normalized.high.length
    )
        ? normalized
        : null;
}

function normalizeWeapon(item) {
    if (!item || !isValidRegistryId(item.id?.trim())) {
        return null;
    }

    const maxRangeKm = Number(
        item.maxRangeKm ??
        item.rangeKm ??
        item.range
    );

    const minRangeKm = Number(
        item.minRangeKm ??
        0
    );

    if (
        !Number.isFinite(maxRangeKm) ||
        maxRangeKm <= 0 ||
        !Number.isFinite(minRangeKm) ||
        minRangeKm < 0 ||
        minRangeKm > maxRangeKm
    ) {
        return null;
    }

    const names =
        item.names && typeof item.names === 'object'
            ? { ...item.names }
            : {};

    return {
        id: item.id.trim(),
        names,
        minRange: minRangeKm,
        maxRange: maxRangeKm,
        range: maxRangeKm,
        minElevationMil: Number.isFinite(Number(item.minElevationMil))
            ? Number(item.minElevationMil)
            : null,
        maxElevationMil: Number.isFinite(Number(item.maxElevationMil))
            ? Number(item.maxElevationMil)
            : null,
        ballistics: normalizeBallistics(item.ballistics)
    };
}

function groupBallisticTable(table) {
    const grouped = [];

    [...table]
        .sort((a, b) => (
            a[0] - b[0] ||
            a[1] - b[1]
        ))
        .forEach(([distance, mil]) => {
            const previous = grouped[grouped.length - 1];

            if (previous && previous.distance === distance) {
                previous.mils.push(mil);
                return;
            }

            grouped.push({
                distance,
                mils: [mil]
            });
        });

    return grouped;
}

function closestMil(values, target) {
    return values.reduce(
        (best, value) => (
            Math.abs(value - target) <
            Math.abs(best - target)
                ? value
                : best
        ),
        values[0]
    );
}

function interpolateBallisticTable(table, distanceMeters) {
    if (
        !Array.isArray(table) ||
        !table.length ||
        !Number.isFinite(distanceMeters)
    ) {
        return null;
    }

    const groups = groupBallisticTable(table);
    const epsilon = 1e-6;

    const exact = groups.find(
        group =>
            Math.abs(group.distance - distanceMeters) <= epsilon
    );

    if (exact) {
        const minMil = Math.min(...exact.mils);
        const maxMil = Math.max(...exact.mils);

        return {
            mil: exact.mils.length === 1
                ? exact.mils[0]
                : null,
            minMil,
            maxMil
        };
    }

    let left = null;
    let right = null;

    for (let i = 0; i < groups.length - 1; i++) {
        if (
            distanceMeters > groups[i].distance &&
            distanceMeters < groups[i + 1].distance
        ) {
            left = groups[i];
            right = groups[i + 1];
            break;
        }
    }

    if (!left || !right) {
        return null;
    }

    const rightAverage =
        right.mils.reduce((sum, value) => sum + value, 0) /
        right.mils.length;

    const leftMil = closestMil(left.mils, rightAverage);
    const rightMil = closestMil(right.mils, leftMil);

    const factor =
        (distanceMeters - left.distance) /
        (right.distance - left.distance);

    const mil = leftMil + factor * (rightMil - leftMil);

    return {
        mil,
        minMil: mil,
        maxMil: mil
    };
}

function getWeaponElevationSolutions(weapon, distanceMeters) {
    if (!weapon || !Number.isFinite(distanceMeters)) {
        return {
            inRange: false,
            single: null,
            low: null,
            high: null
        };
    }

    const minMeters = (weapon.minRange ?? 0) * 1000;
    const maxMeters =
        (weapon.maxRange ?? weapon.range ?? 0) * 1000;

    const inRange =
        distanceMeters + 1e-6 >= minMeters &&
        distanceMeters <= maxMeters + 1e-6;

    if (!inRange || !weapon.ballistics) {
        return {
            inRange,
            single: null,
            low: null,
            high: null
        };
    }

    return {
        inRange,
        single: interpolateBallisticTable(
            weapon.ballistics.single,
            distanceMeters
        ),
        low: interpolateBallisticTable(
            weapon.ballistics.low,
            distanceMeters
        ),
        high: interpolateBallisticTable(
            weapon.ballistics.high,
            distanceMeters
        )
    };
}

function getWeaponName(weapon) {
    if (!weapon) {
        return '';
    }

    return (
        weapon.names?.[LANG] ??
        weapon.names?.[DEFAULT_LANG] ??
        weapon.names?.en ??
        weapon.id
    );
}

async function loadWeapons() {
    const data = await fetchJSON('data/weapons.json');
    const source = Array.isArray(data) ? data : data?.weapons;

    if (!Array.isArray(source) || !source.length) {
        throw new Error('No weapons found in data/weapons.json');
    }

    WEAPONS = createSafeRegistry();

    source
        .map(normalizeWeapon)
        .filter(Boolean)
        .forEach(weapon => {
            WEAPONS[weapon.id] = weapon;
        });

    const ids = Object.keys(WEAPONS);

    if (!ids.length) {
        throw new Error('No valid weapons found in data/weapons.json');
    }

    DEFAULT_WEAPON =
        typeof data?.default === 'string' &&
        hasRegistryEntry(WEAPONS, data.default)
            ? data.default
            : ids[0];

    if (!S.weapon || !hasRegistryEntry(WEAPONS, S.weapon)) {
        S.weapon = DEFAULT_WEAPON;
    }

    populateWeaponSelect();
}

function populateWeaponSelect() {
    const select = $('weapon');

    if (!select) {
        return;
    }

    select.innerHTML = '';

    Object.values(WEAPONS).forEach(weapon => {
        const option = document.createElement('option');
        option.value = weapon.id;
        option.textContent = getWeaponName(weapon);
        select.appendChild(option);
    });

    select.value = S.weapon;
}

;

/* js/map/assets.js */
/* =========================
   MAP ASSETS
   ========================= */

const MARKER_TINT_CACHE =
    new Map();

function normalizeMarkerAsset(
    id,
    asset
) {

    if (!isValidRegistryId(id)) {
        return null;
    }

    if (
        typeof asset === 'string'
    ) {

        return {
            id,
            path: asset,
            labelKey: null,
            width: 32,
            height: 32,
            anchorX: 0.5,
            anchorY: 0.5,
            placeable: true,
            colorable: false
        };
    }

    if (
        !asset ||
        typeof asset !== 'object' ||
        typeof asset.path !== 'string' ||
        !asset.path.trim()
    ) {
        return null;
    }

    return {
        id,

        path:
            asset.path.trim(),

        labelKey:
            typeof asset.labelKey === 'string' &&
            asset.labelKey.trim()
                ? asset.labelKey.trim()
                : null,

        width:
            typeof asset.width === 'number' &&
            asset.width > 0
                ? asset.width
                : 32,

        height:
            typeof asset.height === 'number' &&
            asset.height > 0
                ? asset.height
                : 32,

        anchorX:
            typeof asset.anchorX === 'number'
                ? Math.max(
                    0,
                    Math.min(
                        1,
                        asset.anchorX
                    )
                )
                : 0.5,

        anchorY:
            typeof asset.anchorY === 'number'
                ? Math.max(
                    0,
                    Math.min(
                        1,
                        asset.anchorY
                    )
                )
                : 0.5,

        placeable:
            asset.placeable !== false,

        colorable:
            asset.colorable === true
    };
}

async function loadMapAssets() {

    let data = null;

    try {
        data =
            await fetchJSON(
                'maps/assets.json'
            );
    } catch (error) {
        /*
         * Marker artwork is optional. If the registry is still unavailable
         * after fetchJSON() exhausts its retry, keep the calculator usable
         * without user-placeable marker icons.
         */
        MAP_ASSETS = createSafeRegistry();

        console.warn(
            'Map marker assets unavailable; continuing without marker assets.',
            error
        );
        return;
    }

    const source =
        data &&
        typeof data === 'object' &&
        data.markerIcons &&
        typeof data.markerIcons === 'object'
            ? data.markerIcons
            : {};

    MAP_ASSETS = createSafeRegistry();

    Object.entries(source)
        .forEach(
            ([id, asset]) => {

                const normalized =
                    normalizeMarkerAsset(
                        id,
                        asset
                    );

                if (normalized) {
                    MAP_ASSETS[id] =
                        normalized;
                }
            }
        );
}

function getMarkerAsset(id) {

    if (
        typeof id !== 'string' ||
        !id
    ) {
        return null;
    }

    return (
        hasRegistryEntry(MAP_ASSETS, id)
            ? MAP_ASSETS[id]
            : null
    );
}

/*
 * Assets may name a locale key for their picker label. Without one the id
 * itself is presentable enough ("recon" -> "Recon", "spawn_board" ->
 * "Spawn board"), which keeps new icons usable before they are translated.
 */
function getMarkerAssetLabel(asset) {

    if (!asset) {
        return '';
    }

    if (asset.labelKey) {

        const translated =
            tr(asset.labelKey);

        if (
            translated &&
            translated !== asset.labelKey
        ) {
            return translated;
        }
    }

    const words =
        asset.id
            .split(/[_-]+/)
            .filter(Boolean);

    if (!words.length) {
        return asset.id;
    }

    return (
        words[0].charAt(0).toUpperCase() +
        words[0].slice(1) +
        (
            words.length > 1
                ? ' ' + words.slice(1).join(' ')
                : ''
        )
    );
}

function loadMarkerImage(asset) {

    if (!asset) {
        return null;
    }

    const key =
        asset.path;

    if (
        MARKER_IMAGE_CACHE.has(
            key
        )
    ) {
        return MARKER_IMAGE_CACHE.get(
            key
        );
    }

    const image =
        new Image();

    image.decoding =
        'async';

    const entry = {
        image,
        loaded: false,
        failed: false
    };

    const finishProgress = typeof beginAssetLoadingProgress === 'function'
        ? beginAssetLoadingProgress(`marker:${key}`) : () => {};

    image.onload =
        () => {

            entry.loaded =
                true;

            finishProgress();
            draw();
        };

    image.onerror =
        () => {

            entry.failed =
                true;

            finishProgress(false);
            console.warn(
                `Failed to load marker image: ${asset.path}`
            );

            draw();
        };

    image.src =
        resourceURL(
            asset.path
        );

    MARKER_IMAGE_CACHE.set(
        key,
        entry
    );

    return entry;
}

function getMarkerImageSource(
    asset,
    color = null
) {
    const entry =
        loadMarkerImage(asset);

    if (
        !entry ||
        !entry.loaded ||
        entry.failed
    ) {
        return null;
    }

    const tint =
        asset.colorable &&
        typeof color === 'string' &&
        /^#[0-9a-f]{6}$/i.test(color)
            ? color.toLowerCase()
            : null;

    if (!tint) {
        return entry.image;
    }

    const key =
        `${asset.path}|${tint}`;

    if (MARKER_TINT_CACHE.has(key)) {
        return MARKER_TINT_CACHE.get(key);
    }

    const canvas =
        document.createElement('canvas');

    canvas.width =
        entry.image.naturalWidth ||
        Math.ceil(asset.width);

    canvas.height =
        entry.image.naturalHeight ||
        Math.ceil(asset.height);

    const tintContext =
        canvas.getContext('2d');

    if (!tintContext) {
        return entry.image;
    }

    tintContext.drawImage(
        entry.image,
        0,
        0,
        canvas.width,
        canvas.height
    );

    tintContext.globalCompositeOperation =
        'source-atop';

    tintContext.globalAlpha =
        0.82;

    tintContext.fillStyle =
        tint;

    tintContext.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    MARKER_TINT_CACHE.set(
        key,
        canvas
    );

    return canvas;
}


/* =========================
   MAP ICON APPEARANCE
   ========================= */

function getMapIconCanvasFilter() {

    return (
        document.documentElement
            .dataset.theme === 'light'
            ? 'brightness(0.88) saturate(0.92) contrast(1.06)'
            : 'none'
    );
}

;

/* js/map/maps.js */
/* =========================
   MAP HELPERS
   ========================= */

function formatCoord(value) {

    return Math.round(value)
        .toString()
        .padStart(4, '0');
}


function getCoordinateMetersPerUnit() {
    const map = getCurrentMap?.();

    const configured =
        Number(map?.coordinateMetersPerUnit);

    return (
        Number.isFinite(configured) &&
        configured > 0
            ? configured
            : 1000
    );
}

function worldDistanceToMeters(distance) {
    return distance * getCoordinateMetersPerUnit();
}

function metersToWorldDistance(meters) {
    return meters / getCoordinateMetersPerUnit();
}

function kilometersToWorldDistance(kilometers) {
    return metersToWorldDistance(kilometers * 1000);
}

function storedMetersToWorldCoordinate(meters) {
    return meters / getCoordinateMetersPerUnit();
}

function formatGameCoordinate(value) {
    const precision =
        getCoordinateMetersPerUnit() === 100
            ? 2
            : 0;

    return Number(value).toFixed(precision);
}

function isValidBounds(bounds) {

    return Boolean(
        bounds &&
        typeof bounds.minX === 'number' &&
        typeof bounds.maxX === 'number' &&
        typeof bounds.minY === 'number' &&
        typeof bounds.maxY === 'number' &&
        bounds.maxX > bounds.minX &&
        bounds.maxY > bounds.minY
    );
}

function isValidTileConfig(tiles) {

    return Boolean(
        tiles &&
        typeof tiles.path === 'string' &&
        tiles.path.trim()
    );
}

function normalizeMap(map) {

    const normalized = {
        ...map
    };

    /*
     * Width / height describe the
     * complete game coordinate space.
     */
    normalized.w =
        typeof map.w === 'number' &&
        map.w > 0
            ? map.w
            : 10;

    normalized.h =
        typeof map.h === 'number' &&
        map.h > 0
            ? map.h
            : 10;

    /*
     * Optional calibrated image bounds.
     *
     * If no bounds are supplied,
     * the full map coordinate space
     * is used.
     */
    if (
        !isValidBounds(
            normalized.bounds
        )
    ) {

        normalized.bounds = {
            minX: 0,
            maxX: normalized.w,
            minY: 0,
            maxY: normalized.h
        };
    }

    /*
     * Normalize tile configuration.
     */
    if (
        isValidTileConfig(
            normalized.tiles
        )
    ) {

        normalized.tiles = {
            path:
                normalized.tiles.path
                    .replace(
                        /\/+$/,
                        ''
                    ),

            tileSize:
                typeof normalized.tiles.tileSize ===
                'number'
                    ? normalized.tiles.tileSize
                    : DEFAULT_TILE_SIZE,

            minZoom:
                typeof normalized.tiles.minZoom ===
                'number'
                    ? normalized.tiles.minZoom
                    : DEFAULT_TILE_MIN_ZOOM,

            maxZoom:
                typeof normalized.tiles.maxZoom ===
                'number'
                    ? normalized.tiles.maxZoom
                    : DEFAULT_TILE_MAX_ZOOM,

            extension:
                typeof normalized.tiles.extension ===
                'string' &&
                normalized.tiles.extension.trim()
                    ? normalized.tiles.extension
                        .replace(
                            /^\./,
                            ''
                        )
                    : DEFAULT_TILE_EXTENSION
        };

        const tileStyles = createSafeRegistry();

        Object.entries(
            map.tiles.styles || {}
        ).forEach(
            ([styleId, style]) => {
                if (
                    !isValidRegistryId(styleId) ||
                    !isValidTileConfig(style)
                ) {
                    return;
                }

                tileStyles[styleId] = {
                    path:
                        style.path
                            .replace(/\/+$/, ''),
                    tileSize:
                        typeof style.tileSize === 'number'
                            ? style.tileSize
                            : normalized.tiles.tileSize,
                    minZoom:
                        typeof style.minZoom === 'number'
                            ? style.minZoom
                            : normalized.tiles.minZoom,
                    maxZoom:
                        typeof style.maxZoom === 'number'
                            ? style.maxZoom
                            : normalized.tiles.maxZoom,
                    extension:
                        typeof style.extension === 'string' &&
                        style.extension.trim()
                            ? style.extension.replace(/^\./, '')
                            : normalized.tiles.extension
                };
            }
        );

        if (!Object.keys(tileStyles).length) {
            tileStyles.grayscale = {
                path: normalized.tiles.path,
                tileSize: normalized.tiles.tileSize,
                minZoom: normalized.tiles.minZoom,
                maxZoom: normalized.tiles.maxZoom,
                extension: normalized.tiles.extension
            };
        }

        const requestedDefaultStyle =
            String(
                map.tiles.defaultStyle ||
                ''
            ).trim();

        normalized.tiles.styles =
            tileStyles;

        normalized.tiles.defaultStyle =
            tileStyles[requestedDefaultStyle]
                ? requestedDefaultStyle
                : Object.keys(tileStyles)[0];

    } else {

        normalized.tiles =
            null;
    }

    normalized.markers =
        Array.isArray(map.markers)
            ? map.markers
            : [];

    normalized.zones =
        Array.isArray(map.zones)
            ? map.zones
            : [];

    normalized.polygons =
        Array.isArray(map.polygons)
            ? map.polygons
            : [];

    return normalized;
}


/* =========================
   LOAD MAPS
   ========================= */

async function loadMaps() {

    const index =
        await fetchJSON(
            'maps/index.json'
        );

    const files =
        Array.isArray(index)
            ? index
            : Array.isArray(index.maps)
                ? index.maps
                : [];

    if (!files.length) {

        throw new Error(
            'No maps found in maps/index.json'
        );
    }

    const settled =
        await Promise.allSettled(
            files.map(
                async item => {

                    const file =
                        typeof item === 'string'
                            ? item
                            : item.file;

                    if (!file) {
                        return null;
                    }

                    const map =
                        await fetchJSON(
                            `maps/${file}`
                        );

                    if (!isValidRegistryId(map.id)) {

                        throw new Error(
                            `Map ${file} has an invalid id`
                        );
                    }

                    if (!map.name) {

                        throw new Error(
                            `Map ${file} has no name`
                        );
                    }

                    return normalizeMap(
                        map
                    );
                }
            )
        );

    const loaded =
        settled
            .filter(
                result =>
                    result.status ===
                        'fulfilled' &&
                    result.value
            )
            .map(
                result =>
                    result.value
            );

    settled
        .filter(
            result =>
                result.status ===
                'rejected'
        )
        .forEach(
            result => {
                console.warn(
                    'A map definition could not be loaded; continuing with the remaining maps.',
                    result.reason
                );
            }
        );

    if (!loaded.length) {
        throw new Error(
            'No map definitions could be loaded'
        );
    }

    MAPS = createSafeRegistry();

    loaded
        .forEach(
            map => {

                MAPS[map.id] =
                    map;
            }
        );

    populateMapSelect();
}


/* =========================
   MAP STYLE SELECT
   ========================= */

const MAP_STYLE_COPY = {
    en: { label: 'Map style', grayscale: 'Black & white', color: 'Color' },
    ru: { label: 'Стиль карты', grayscale: 'Чёрно-белая', color: 'Цветная' },
    uk: { label: 'Стиль карти', grayscale: 'Чорно-біла', color: 'Кольорова' },
    de: { label: 'Kartenstil', grayscale: 'Schwarzweiß', color: 'Farbig' },
    fr: { label: 'Style de carte', grayscale: 'Noir et blanc', color: 'Couleur' },
    es: { label: 'Estilo del mapa', grayscale: 'Blanco y negro', color: 'Color' },
    pl: { label: 'Styl mapy', grayscale: 'Czarno-biała', color: 'Kolorowa' },
    pt: { label: 'Estilo do mapa', grayscale: 'Preto e branco', color: 'A cores' },
    'zh-cn': { label: '地图样式', grayscale: '黑白', color: '彩色' },
    ko: { label: '지도 스타일', grayscale: '흑백', color: '컬러' },
    ja: { label: 'マップスタイル', grayscale: '白黒', color: 'カラー' },
    cs: { label: 'Styl mapy', grayscale: 'Černobílá', color: 'Barevná' },
    cat: { label: 'MEOWP STYLE', grayscale: 'BLACK & WHITE PAWS', color: 'COLORFUL PAWS' }
};

function getMapStyleCopy(key) {
    const copy =
        MAP_STYLE_COPY[LANG] ||
        MAP_STYLE_COPY.en;

    return (
        copy[key] ||
        MAP_STYLE_COPY.en[key] ||
        key
    );
}

function getAvailableMapTileStyleIds(map) {
    return Object.keys(
        map?.tiles?.styles || {}
    );
}

function getMapStyleLabel(styleId) {
    return getMapStyleCopy(
        styleId
    );
}

function ensureMapStyleControl() {
    let control =
        $('mapStyleControl');

    if (control) {
        return control;
    }

    const mapSelect =
        $('mapSelect');

    if (!mapSelect) {
        return null;
    }

    control =
        document.createElement('div');

    control.id =
        'mapStyleControl';

    control.className =
        'map-style-control';

    const label =
        document.createElement('label');

    label.htmlFor =
        'mapStyleSelect';

    const select =
        document.createElement('select');

    select.id =
        'mapStyleSelect';

    control.append(
        label,
        select
    );

    const slot =
        $('mapStyleSlot');

    if (slot) {
        slot.appendChild(control);
    } else {
        mapSelect.insertAdjacentElement(
            'afterend',
            control
        );
    }

    return control;
}

function syncMapStyleSelect() {
    const control =
        ensureMapStyleControl();

    const select =
        $('mapStyleSelect');

    if (
        !control ||
        !select
    ) {
        return;
    }

    const map =
        MAPS[S.map] || null;

    const styles =
        getAvailableMapTileStyleIds(
            map
        );

    if (!styles.length) {
        control.hidden = true;
        return;
    }

    control.hidden = false;

    const label =
        control.querySelector('label');

    if (label) {
        label.textContent =
            getMapStyleCopy('label');
    }

    const fallback =
        map.tiles.defaultStyle &&
        styles.includes(
            map.tiles.defaultStyle
        )
            ? map.tiles.defaultStyle
            : styles[0];

    if (
        !styles.includes(
            S.mapStyle
        )
    ) {
        S.mapStyle =
            fallback;
    }

    select.innerHTML = '';

    styles.forEach(
        styleId => {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                styleId;

            option.textContent =
                getMapStyleLabel(
                    styleId
                );

            select.appendChild(
                option
            );
        }
    );

    select.value =
        S.mapStyle;

    select.disabled =
        styles.length < 2;
}

/* =========================
   DIRECT MAP ENTRY
   ========================= */

function applyMapQuerySelection() {
    const url =
        new URL(
            window.location.href
        );

    const requested =
        url.searchParams
            .get('map')
            ?.trim()
            .toLowerCase();

    if (
        !requested ||
        !Object.hasOwn(
            MAPS,
            requested
        )
    ) {
        return false;
    }

    const map =
        MAPS[requested];

    S.map = map.id;
    S.w = map.w;
    S.h = map.h;

    const select =
        $('mapSelect');

    if (select) {
        select.value = map.id;
    }

    /* Consume the validated deep link once; normal startup persists it. */
    url.searchParams.delete('map');

    const cleanUrl =
        `${url.pathname}${url.search}${url.hash}`;

    window.history.replaceState(
        window.history.state,
        '',
        cleanUrl
    );

    return true;
}


/* =========================
   MAP SELECT
   ========================= */

function populateMapSelect() {

    const select =
        $('mapSelect');

    select.innerHTML = '';

    /*
     * Preset maps first.
     */
    Object.values(MAPS)
        .forEach(
            map => {

                const option =
                    document.createElement(
                        'option'
                    );

                option.value =
                    map.id;

                option.textContent =
                    map.name;

                select.appendChild(
                    option
                );
            }
        );

    /*
     * If configured default map doesn't
     * exist for some reason, fall back
     * to the first available map.
     */
    if (
        !hasRegistryEntry(MAPS, S.map)
    ) {

        const firstMap =
            Object.values(
                MAPS
            )[0];

        S.map =
            firstMap
                ? firstMap.id
                : '';
    }

    select.value =
        S.map;

    syncMapStyleSelect();
}

;

/* js/map/map-view.js */
/* =========================
   MAP
   ========================= */

function getCurrentMap() {
    return (
        MAPS[S.map] ||
        null
    );
}


/* =========================
   WORLD / VIEW BOUNDS
   ========================= */

function getViewBounds() {

    const map =
        getCurrentMap();

    if (
        map &&
        isValidBounds(
            map.bounds
        )
    ) {

        return {
            minX:
            map.bounds.minX,

            maxX:
            map.bounds.maxX,

            minY:
            map.bounds.minY,

            maxY:
            map.bounds.maxY
        };
    }

    return {
        minX: 0,
        maxX: S.w,

        minY: 0,
        maxY: S.h
    };
}


/* =========================
   VIEW
   ========================= */

/*
 * view() is called nine times or more per draw — every layer wants it —
 * and each call reads clientWidth, which forces a layout whenever anything
 * has written to the DOM since. The result is pure given the camera and
 * the viewport, so it is memoised for the rest of the current task: a
 * microtask clears it, which cannot run part-way through a draw.
 */
let viewCache = null;

function viewCacheKey() {
    return (
        S.zoom + '|' +
        S.panX + '|' +
        S.panY + '|' +
        S.map + '|' +
        S.w + '|' +
        S.h
    );
}

function view() {

    const key = viewCacheKey();

    if (viewCache && viewCache.key === key) {
        return viewCache.value;
    }

    const W =
        wrap.clientWidth;

    const H =
        wrap.clientHeight;

    const padding =
        document.body.classList.contains(
            'mobile-app'
        )
            ? 12
            : 34;

    const bounds =
        getViewBounds();

    const worldWidth =
        bounds.maxX -
        bounds.minX;

    const worldHeight =
        bounds.maxY -
        bounds.minY;

    const availableWidth =
        Math.max(
            1,
            W -
            padding * 2
        );

    const availableHeight =
        Math.max(
            1,
            H -
            padding * 2
        );

    const scale =
        Math.min(
            availableWidth /
            worldWidth,

            availableHeight /
            worldHeight
        ) *
        S.zoom;

    const mw =
        worldWidth *
        scale;

    const mh =
        worldHeight *
        scale;

    const value = {
        scale,

        bounds,

        worldWidth,
        worldHeight,

        left:
            (
                W -
                mw
            ) /
            2 +
            S.panX,

        top:
            (
                H -
                mh
            ) /
            2 +
            S.panY,

        mw,
        mh
    };

    viewCache = {
        key,
        value
    };

    queueMicrotask(
        () => {
            viewCache = null;
        }
    );

    return value;
}


/* =========================
   WORLD -> SCREEN
   ========================= */

function worldToLocalScreen(
    x,
    y
) {

    const v =
        view();

    return {
        x:
            (
                x -
                v.bounds.minX
            ) *
            v.scale,

        y:
            (
                v.bounds.maxY -
                y
            ) *
            v.scale
    };
}

function toScreen(
    x,
    y
) {

    const v =
        view();

    const local =
        worldToLocalScreen(
            x,
            y
        );

    return {
        x:
            v.left +
            local.x,

        y:
            v.top +
            local.y
    };
}


/* =========================
   SCREEN -> WORLD
   ========================= */

function toWorld(
    x,
    y
) {

    const v =
        view();

    return {
        x:
            v.bounds.minX +
            (
                x -
                v.left
            ) /
            v.scale,

        y:
            v.bounds.maxY -
            (
                y -
                v.top
            ) /
            v.scale
    };
}


/* =========================
   CLAMP
   ========================= */

function clamp(p) {

    const bounds =
        getViewBounds();

    const precision =
        getCoordinateMetersPerUnit() === 100
            ? 100
            : 1000;

    p.x =
        Math.max(
            bounds.minX,
            Math.min(
                bounds.maxX,
                Math.round(
                    p.x *
                    precision
                ) /
                precision
            )
        );

    p.y =
        Math.max(
            bounds.minY,
            Math.min(
                bounds.maxY,
                Math.round(
                    p.y *
                    precision
                ) /
                precision
            )
        );
}
;

/* js/map/camera-keys.js */
/* =========================
   KEYBOARD CAMERA
   ========================= */

/*
 * WASD / arrow keys pan the map, +/- zoom it.
 * Panning runs from a frame loop that only exists while a
 * key is held, so an idle map costs nothing.
 */
const CAMERA_PAN_KEYS = {
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right',
    arrowup: 'up',
    arrowleft: 'left',
    arrowdown: 'down',
    arrowright: 'right'
};

const CAMERA_ZOOM_IN_KEYS =
    new Set(['+', '=']);

const CAMERA_ZOOM_OUT_KEYS =
    new Set(['-', '_']);

const CAMERA_SPRINT_FACTOR = 2.5;

const HELD_PAN_KEYS =
    new Set();

function isPanDirectionHeld(direction) {

    for (const key of HELD_PAN_KEYS) {

        if (
            CAMERA_PAN_KEYS[key] ===
            direction
        ) {
            return true;
        }
    }

    return false;
}

let cameraSprintHeld = false;

let cameraPanFrame = null;

let cameraPanLastFrame = 0;

function isTypingTarget(target) {
    return Boolean(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
    );
}

function stepCameraPan(timestamp) {

    if (!HELD_PAN_KEYS.size) {
        cameraPanFrame = null;
        return;
    }

    /*
     * Clamp the delta so a backgrounded tab does not
     * resume with one enormous jump.
     */
    const delta =
        Math.min(
            0.05,
            (
                timestamp -
                cameraPanLastFrame
            ) /
            1000
        );

    cameraPanLastFrame =
        timestamp;

    let dx = 0;
    let dy = 0;

    if (isPanDirectionHeld('left')) dx += 1;
    if (isPanDirectionHeld('right')) dx -= 1;
    if (isPanDirectionHeld('up')) dy += 1;
    if (isPanDirectionHeld('down')) dy -= 1;

    if (dx || dy) {

        /*
         * Normalise so diagonals are not faster than
         * a straight line.
         */
        const length =
            Math.hypot(dx, dy);

        const speed =
            getCameraPanSpeed() *
            (
                cameraSprintHeld
                    ? CAMERA_SPRINT_FACTOR
                    : 1
            ) *
            delta;

        S.panX +=
            (dx / length) *
            speed;

        S.panY +=
            (dy / length) *
            speed;

        draw();
    }

    cameraPanFrame =
        requestAnimationFrame(
            stepCameraPan
        );
}

function startCameraPan() {

    if (cameraPanFrame !== null) {
        return;
    }

    cameraPanLastFrame =
        performance.now();

    cameraPanFrame =
        requestAnimationFrame(
            stepCameraPan
        );
}

function stopCameraPan() {

    if (cameraPanFrame !== null) {
        cancelAnimationFrame(
            cameraPanFrame
        );

        cameraPanFrame = null;
    }

    HELD_PAN_KEYS.clear();

    cameraSprintHeld = false;
}

function zoomCameraFromKey(zoomIn) {

    S.zoom =
        zoomIn
            ? Math.min(
                getMaxCameraZoom(),
                S.zoom *
                ZOOM_BUTTON_FACTOR
            )
            : Math.max(
                MIN_ZOOM,
                S.zoom /
                ZOOM_BUTTON_FACTOR
            );

    draw();
}

function handleCameraKeyDown(event) {

    if (
        isTypingTarget(event.target) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
    ) {
        return false;
    }

    const key =
        getKeyboardShortcutKey(
            event
        );

    cameraSprintHeld =
        event.shiftKey;

    if (CAMERA_PAN_KEYS[key]) {

        HELD_PAN_KEYS.add(key);

        startCameraPan();

        return true;
    }

    if (CAMERA_ZOOM_IN_KEYS.has(key)) {
        zoomCameraFromKey(true);
        return true;
    }

    if (CAMERA_ZOOM_OUT_KEYS.has(key)) {
        zoomCameraFromKey(false);
        return true;
    }

    return false;
}

function handleCameraKeyUp(event) {

    const key =
        getKeyboardShortcutKey(
            event
        );

    cameraSprintHeld =
        event.shiftKey;

    HELD_PAN_KEYS.delete(key);
}

;

/* js/map/tiles.js */
/* =========================
   TILE MAP
   ========================= */

function getMapTileStyleId(map) {
    const styles =
        map?.tiles?.styles || {};

    const selected =
        String(
            S.mapStyle ||
            ''
        );

    if (styles[selected]) {
        return selected;
    }

    const configuredDefault =
        String(
            map?.tiles?.defaultStyle ||
            ''
        );

    if (styles[configuredDefault]) {
        return configuredDefault;
    }

    return (
        Object.keys(styles)[0] ||
        'grayscale'
    );
}

function getTileConfig(
    map,
    styleId = getMapTileStyleId(map)
) {

    if (
        !map ||
        !map.tiles ||
        !isValidBounds(map.bounds)
    ) {
        return null;
    }

    const style =
        map.tiles.styles?.[styleId];

    const tiles =
        style
            ? {
                ...map.tiles,
                ...style
            }
            : map.tiles;

    if (!isValidTileConfig(tiles)) {
        return null;
    }

    return tiles;
}


/* =========================
   TILE WORLD BOUNDS
   ========================= */

/*
 * map.bounds
 *     Actual playable/searchable map bounds.
 *
 * map.tileBounds
 *     World-coordinate extent covered by the complete
 *     tile pyramid.
 *
 * Most maps can omit tileBounds. In that case tiles
 * continue to use map.bounds exactly as before.
 */
function getTileBounds(map) {

    if (
        map &&
        isValidBounds(
            map.tileBounds
        )
    ) {
        return map.tileBounds;
    }

    return map?.bounds || null;
}


/* =========================
   TILE ZOOM
   ========================= */

function getTileZoom(map) {

    const tiles =
        getTileConfig(map);

    const tileBounds =
        getTileBounds(map);

    if (
        !tiles ||
        !tileBounds
    ) {
        return null;
    }

    /*
     * zoom_0 contains one tile covering the complete
     * tileBounds extent. Therefore tile resolution has
     * to be calculated from tileBounds, not map.bounds.
     */
    const tileWorldWidth =
        tileBounds.maxX -
        tileBounds.minX;

    if (
        !Number.isFinite(
            tileWorldWidth
        ) ||
        tileWorldWidth <= 0
    ) {
        return null;
    }

    const basePixelsPerWorldUnit =
        tiles.tileSize /
        tileWorldWidth;

    const desiredPixelsPerWorldUnit =
        view().scale;

    const raw =
        Math.log2(
            desiredPixelsPerWorldUnit /
            basePixelsPerWorldUnit
        );

    /*
     * Prefer the coarser of the two suitable pyramid levels. Rounding up
     * quadruples the number of 256 px tiles before the extra detail is
     * actually visible, which is especially expensive now that every tile
     * passes through the authenticated asset gateway.
     */
    return Math.max(
        tiles.minZoom,
        Math.min(
            tiles.maxZoom,
            Math.floor(raw)
        )
    );
}


/* =========================
   CACHE / URL
   ========================= */

function getTileSourceKey(
    map,
    styleId = getMapTileStyleId(map)
) {
    const tiles = getTileConfig(map, styleId);

    // A map/style can receive a new pyramid without changing its identity.
    // Keep detailed tiles and their preview ancestors in the same source.
    return JSON.stringify([
        map?.id,
        styleId,
        tiles?.path,
        tiles?.tileSize,
        tiles?.extension
    ]);
}

function tileKey(
    sourceKey,
    zoom,
    x,
    y
) {

    return `${sourceKey}:${zoom}:${x}:${y}`;
}

function getTileURL(
    map,
    zoom,
    x,
    y,
    styleId = getMapTileStyleId(map)
) {

    const tiles =
        getTileConfig(
            map,
            styleId
        );

    if (!tiles) {
        return null;
    }

    const url =
        resourceURL(
            `${tiles.path}/zoom_${zoom}/${x}_${y}.${tiles.extension}`
        );

    return (
        typeof resolveProtectedAssetURL ===
            'function'
            ? resolveProtectedAssetURL(
                url
            )
            : url
    );
}

const TILE_REQUEST_CONCURRENCY = 4;
const TILE_REQUEST_ATTEMPTS = 2;
const TILE_RETRY_DELAY_MS = 450;
const TILE_VIEWPORT_MARGIN = 0;

const TILE_LOAD_QUEUE = [];
let TILE_FIRST_REQUEST_AT = null;
let TILE_FIRST_READY_REPORTED = false;

function reportFirstVisibleTile(tile) {
    if (TILE_FIRST_READY_REPORTED || !isTileRequestRelevant(tile)) return;
    TILE_FIRST_READY_REPORTED = true;
    if (typeof trackAnalytics === 'function') {
        try {
            trackAnalytics('map-first-tiles-ready', {
                map: tile.request.map.id,
                style: tile.request.styleId,
                latencyMs: Math.max(0, Date.now() - (TILE_FIRST_REQUEST_AT ?? Date.now()))
            });
        } catch {
            // A blocked analytics script must never occupy a tile request slot.
        }
    }
}

function getMapTileDiagnostics() {
    const counts = { cached: TILE_CACHE.size, loaded: 0, failed: 0, queued: 0, retrying: 0 };
    for (const tile of TILE_CACHE.values()) {
        if (tile.loaded) counts.loaded++;
        if (tile.failed) counts.failed++;
        if (tile.queued) counts.queued++;
        if (tile.retryPending) counts.retrying++;
    }
    return {
        ...counts,
        activeRequests: TILE_ACTIVE_REQUESTS,
        concurrency: TILE_REQUEST_CONCURRENCY,
        tilesVisible: MAP_TOOL_STATE.layers.tiles,
        mapId: S.map,
        style: S.mapStyle,
        zoom: S.zoom
    };
}

let TILE_ACTIVE_REQUESTS = 0;
let TILE_QUEUE_EPOCH = 0;

function getVisibleTileLoadingProgress() {
    const counts = { total: 0, loaded: 0, failed: 0 };
    for (const tile of TILE_CACHE.values()) {
        if (!isTileRequestRelevant(tile)) continue;
        counts.total++;
        if (tile.loaded) counts.loaded++;
        else if (tile.failed && !tile.deferred) counts.failed++;
    }
    return counts;
}

function sortTileLoadQueue() {
    TILE_LOAD_QUEUE.sort(
        (a, b) =>
            a.priority -
            b.priority
    );
}

function releaseTileRequestSlot(tile) {
    tile.loading = false;

    TILE_ACTIVE_REQUESTS =
        Math.max(
            0,
            TILE_ACTIVE_REQUESTS - 1
        );

    pumpTileLoadQueue();
}

function finishTileRequest(
    tile,
    failed
) {
    tile.loaded = !failed;
    tile.failed = failed;
    tile.retryPending = false;

    releaseTileRequestSlot(tile);

    draw();
}

function scheduleTileRetry(tile) {
    tile.retryPending = true;
    tile.image = null;
    releaseTileRequestSlot(tile);

    /*
     * Redraw immediately so a cached lower-resolution ancestor remains
     * visible while the retry waits. The redraw also refreshes
     * lastSeenEpoch for tiles that are still in the current viewport.
     */
    draw();

    window.setTimeout(
        () => {
            tile.retryPending = false;

            if (
                tile.loaded ||
                tile.failed
            ) {
                return;
            }

            const stillNeeded =
                tile.lastSeenEpoch >=
                    TILE_QUEUE_EPOCH - 1;

            if (stillNeeded) {
                queueTileLoad(
                    tile
                );
            }
        },
        TILE_RETRY_DELAY_MS
    );
}

function isTileRequestRelevant(tile) {
    const map = typeof getCurrentMap === 'function' ? getCurrentMap() : null;
    return map?.id === tile.request.map.id &&
        getMapTileStyleId(map) === tile.request.styleId &&
        getTileSourceKey(map, tile.request.styleId) === tile.request.sourceKey &&
        (typeof isMapLayerVisible !== 'function' || isMapLayerVisible('tiles')) &&
        tile.lastSeenEpoch === TILE_QUEUE_EPOCH;
}

function resumeProtectedTileLoads() {
    for (const tile of TILE_CACHE.values()) {
        if (tile.deferred && !tile.loading) {
            tile.deferred = false;
            tile.failed = false;
            tile.attempts = 0;
        }
    }
    draw();
    pumpTileLoadQueue();
}

if (typeof onAssetAccessRetry === 'function') {
    onAssetAccessRetry(resumeProtectedTileLoads);
}

async function startTileRequest(tile) {
    const { map, styleId, zoom, x, y } = tile.request;
    const protectedAsset = typeof isProtectedAssetURL === 'function' &&
        isProtectedAssetURL(getTileURL(map, zoom, x, y, styleId));

    tile.loading = true;
    tile.queued = false;
    tile.retryPending = false;
    tile.attempts = (tile.attempts || 0) + 1;
    TILE_ACTIVE_REQUESTS++;

    let objectUrl = null;
    const cleanup = () => {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
        }
    };
    const fail = error => {
        cleanup();
        tile.image = null;
        if (protectedAsset && error?.retryAt) {
            tile.deferred = true;
        } else if (error?.retryable !== false && tile.attempts < TILE_REQUEST_ATTEMPTS) {
            scheduleTileRetry(tile);
            return;
        }
        if (!tile.deferred) {
            console.warn('Failed to load tile:', map.id, styleId, zoom, x, y, error);
            if (typeof trackOperationalFailure === 'function') {
                trackOperationalFailure('asset-load-failed', {
                    area: 'map', type: 'tile', map: map.id,
                    resource: `tile-${styleId}`, code: 'tile-load'
                });
            }
        }
        finishTileRequest(tile, true);
    };

    try {
        if (protectedAsset) {
            if (!await ensureAssetAccess()) {
                throw assetAccessBlockedError();
            }
            // Authorization can outlast the viewport that requested this tile.
            if (!isTileRequestRelevant(tile)) {
                releaseTileRequestSlot(tile);
                return;
            }
        }

        // Select the delivery hostname only after authorization succeeds.
        const tileUrl = getTileURL(map, zoom, x, y, styleId);
        let imageUrl = tileUrl;
        if (protectedAsset) {
            const response = await fetchAssetResource(tileUrl);
            if (!response.ok) {
                const error = new Error(`tile-http-${response.status}`);
                error.retryable = response.status >= 500;
                throw error;
            }
            const blob = await response.blob();
            if (!isTileRequestRelevant(tile)) {
                releaseTileRequestSlot(tile);
                return;
            }
            objectUrl = URL.createObjectURL(blob);
            imageUrl = objectUrl;
        }

        const image = new Image();
        image.crossOrigin = protectedAsset ? 'use-credentials' : 'anonymous';
        image.decoding = 'async';
        if ('fetchPriority' in image) {
            image.fetchPriority = tile.priority < 0 ? 'high' : 'auto';
        }
        tile.image = image;
        image.onload = () => {
            cleanup();
            tile.deferred = false;
            reportFirstVisibleTile(tile);
            finishTileRequest(tile, false);
        };
        image.onerror = () => fail(new Error('tile-image-decode-failed'));
        image.src = imageUrl;
    } catch (error) {
        fail(error);
    }
}

function pumpTileLoadQueue() {
    while (
        TILE_ACTIVE_REQUESTS <
            TILE_REQUEST_CONCURRENCY &&
        TILE_LOAD_QUEUE.length
    ) {
        const tile =
            TILE_LOAD_QUEUE.shift();

        if (
            !tile ||
            tile.loaded ||
            tile.failed ||
            tile.loading ||
            tile.retryPending
        ) {
            continue;
        }

        /*
         * A fast pan, zoom, map switch or style switch can leave hundreds of
         * no-longer-visible tiles in the priority queue. They used to drain
         * after the interaction ended, creating real network requests for
         * imagery the user would never see. Drop them before assigning a
         * request slot; loadTile() will enqueue the tile again if a later
         * viewport needs it.
         */
        if (!isTileRequestRelevant(tile)) {
            tile.queued = false;
            continue;
        }

        const { map, styleId, zoom, x, y } = tile.request;
        if (typeof isAssetAccessPaused === 'function' && isAssetAccessPaused() &&
            isProtectedAssetURL(getTileURL(map, zoom, x, y, styleId))) {
            TILE_LOAD_QUEUE.unshift(tile);
            return;
        }

        startTileRequest(
            tile
        );
    }
}

function queueTileLoad(tile) {
    if (
        tile.loaded ||
        tile.failed ||
        tile.loading ||
        tile.queued ||
        tile.retryPending
    ) {
        return;
    }

    tile.queued = true;

    TILE_LOAD_QUEUE.push(
        tile
    );

    sortTileLoadQueue();
    pumpTileLoadQueue();
}

function loadTile(
    map,
    zoom,
    x,
    y,
    priority = 0
) {

    if (TILE_FIRST_REQUEST_AT === null) TILE_FIRST_REQUEST_AT = Date.now();

    const styleId =
        getMapTileStyleId(
            map
        );

    const sourceKey = getTileSourceKey(map, styleId);

    const key =
        tileKey(
            sourceKey,
            zoom,
            x,
            y
        );

    if (
        TILE_CACHE.has(key)
    ) {
        const cached =
            TILE_CACHE.get(key);

        cached.lastSeenEpoch =
            TILE_QUEUE_EPOCH;

        if (
            !cached.loaded &&
            !cached.failed &&
            Number.isFinite(priority) &&
            priority <
                cached.priority
        ) {
            cached.priority =
                priority;

            sortTileLoadQueue();
        }

        if (
            !cached.loaded &&
            !cached.failed &&
            !cached.loading &&
            !cached.queued &&
            !cached.retryPending
        ) {
            queueTileLoad(
                cached
            );
        }

        return cached;
    }

    const tile = {
        image: null,
        loaded: false,
        failed: false,
        loading: false,
        queued: false,
        retryPending: false,
        attempts: 0,
        lastSeenEpoch:
            TILE_QUEUE_EPOCH,
        priority:
            Number.isFinite(priority)
                ? priority
                : 0,
        request: {
            map,
            styleId,
            sourceKey,
            zoom,
            x,
            y
        }
    };

    TILE_CACHE.set(
        key,
        tile
    );

    queueTileLoad(
        tile
    );

    return tile;
}


function findCachedTileAncestor(
    map,
    tiles,
    zoom,
    x,
    y
) {

    const styleId =
        getMapTileStyleId(
            map
        );

    const sourceKey = getTileSourceKey(map, styleId);

    for (
        let levels = 1;
        zoom - levels >= tiles.minZoom;
        levels++
    ) {

        const scale =
            Math.pow(
                2,
                levels
            );

        const ancestor =
            TILE_CACHE.get(
                tileKey(
                    sourceKey,
                    zoom - levels,
                    Math.floor(
                        x / scale
                    ),
                    Math.floor(
                        y / scale
                    )
                )
            );

        if (
            !ancestor ||
            !ancestor.loaded ||
            ancestor.failed
        ) {
            continue;
        }

        // Crop in decoded image pixels. A preview can have a different
        // resolution from the nominal tile size used to select a zoom.
        const sourceWidth = ancestor.image?.naturalWidth / scale;
        const sourceHeight = ancestor.image?.naturalHeight / scale;

        if (
            !Number.isFinite(sourceWidth) ||
            !Number.isFinite(sourceHeight) ||
            sourceWidth < 1 ||
            sourceHeight < 1
        ) {
            continue;
        }

        return {
            image: ancestor.image,
            sourceX:
                (
                    x % scale
                ) *
                sourceWidth,
            sourceY:
                (
                    y % scale
                ) *
                sourceHeight,
            sourceWidth,
            sourceHeight
        };
    }

    return null;
}


/* =========================
   DRAW TILE MAP
   ========================= */

function drawTileMap(map) {

    const tiles =
        getTileConfig(map);

    const tileBounds =
        getTileBounds(map);

    if (
        !tiles ||
        !tileBounds
    ) {
        return;
    }

    const v =
        view();

    /*
     * View / coordinate grid are clipped to map.bounds.
     * Tile placement itself uses tileBounds.
     */
    const mapBounds =
        map.bounds;

    const zoom =
        getTileZoom(map);

    if (
        zoom === null
    ) {
        return;
    }

    /*
     * Newer renders outrank stale queued requests from an older viewport.
     * This keeps panning responsive even on high-latency connections.
     */
    const queueEpoch =
        ++TILE_QUEUE_EPOCH;

    const tileCount =
        Math.pow(
            2,
            zoom
        );

    const tileWorldWidth =
        (
            tileBounds.maxX -
            tileBounds.minX
        ) /
        tileCount;

    const tileWorldHeight =
        (
            tileBounds.maxY -
            tileBounds.minY
        ) /
        tileCount;

    const tileScreenWidth =
        tileWorldWidth *
        v.scale;

    const tileScreenHeight =
        tileWorldHeight *
        v.scale;

    const topLeft =
        toWorld(
            0,
            0
        );

    const bottomRight =
        toWorld(
            wrap.clientWidth,
            wrap.clientHeight
        );

    const visibleLeft =
        Math.min(
            topLeft.x,
            bottomRight.x
        );

    const visibleRight =
        Math.max(
            topLeft.x,
            bottomRight.x
        );

    const visibleBottom =
        Math.min(
            topLeft.y,
            bottomRight.y
        );

    const visibleTop =
        Math.max(
            topLeft.y,
            bottomRight.y
        );

    /*
     * Only draw the intersection of:
     *   - current viewport,
     *   - actual map bounds,
     *   - available tile imagery.
     */
    const worldLeft =
        Math.max(
            mapBounds.minX,
            tileBounds.minX,
            visibleLeft
        );

    const worldRight =
        Math.min(
            mapBounds.maxX,
            tileBounds.maxX,
            visibleRight
        );

    const worldBottom =
        Math.max(
            mapBounds.minY,
            tileBounds.minY,
            visibleBottom
        );

    const worldTop =
        Math.min(
            mapBounds.maxY,
            tileBounds.maxY,
            visibleTop
        );

    if (
        worldLeft >= worldRight ||
        worldBottom >= worldTop
    ) {
        return;
    }

    const minTileX =
        Math.max(
            0,
            Math.floor(
                (
                    worldLeft -
                    tileBounds.minX
                ) /
                tileWorldWidth
            ) - TILE_VIEWPORT_MARGIN
        );

    const maxTileX =
        Math.min(
            tileCount - 1,
            Math.ceil(
                (
                    worldRight -
                    tileBounds.minX
                ) /
                tileWorldWidth
            ) - 1 + TILE_VIEWPORT_MARGIN
        );

    const minTileY =
        Math.max(
            0,
            Math.floor(
                (
                    tileBounds.maxY -
                    worldTop
                ) /
                tileWorldHeight
            ) - TILE_VIEWPORT_MARGIN
        );

    const maxTileY =
        Math.min(
            tileCount - 1,
            Math.ceil(
                (
                    tileBounds.maxY -
                    worldBottom
                ) /
                tileWorldHeight
            ) - 1 + TILE_VIEWPORT_MARGIN
        );

    const centerTileX =
        (
            minTileX +
            maxTileX
        ) / 2;

    const centerTileY =
        (
            minTileY +
            maxTileY
        ) / 2;

    /*
     * Request one cheap low-resolution ancestor first. Once it arrives,
     * findCachedTileAncestor() can immediately paint a usable map preview
     * while detailed tiles continue loading in the background.
     */
    if (
        zoom >
        tiles.minZoom
    ) {
        const levels =
            zoom -
            tiles.minZoom;

        const scale =
            Math.pow(
                2,
                levels
            );

        loadTile(
            map,
            tiles.minZoom,
            Math.floor(
                centerTileX /
                scale
            ),
            Math.floor(
                centerTileY /
                scale
            ),
            -queueEpoch * 1000000 -
                100000
        );
    }

    ctx.save();

    /*
     * Renderer is already translated by v.left/v.top.
     * This rect therefore represents the actual map
     * coordinate extent, not the entire tile pyramid.
     */
    ctx.beginPath();

    ctx.rect(
        0,
        0,
        v.mw,
        v.mh
    );

    ctx.clip();

    for (
        let tileY = minTileY;
        tileY <= maxTileY;
        tileY++
    ) {

        const tileWorldTop =
            tileBounds.maxY -
            tileY *
            tileWorldHeight;

        for (
            let tileX = minTileX;
            tileX <= maxTileX;
            tileX++
        ) {

            const tileWorldLeft =
                tileBounds.minX +
                tileX *
                tileWorldWidth;

            const screen =
                worldToLocalScreen(
                    tileWorldLeft,
                    tileWorldTop
                );

            const priority =
                -queueEpoch *
                    1000000 +
                Math.pow(
                    tileX -
                    centerTileX,
                    2
                ) +
                Math.pow(
                    tileY -
                    centerTileY,
                    2
                );

            const tile =
                loadTile(
                    map,
                    zoom,
                    tileX,
                    tileY,
                    priority
                );

            if (
                tile.loaded &&
                !tile.failed
            ) {

                ctx.drawImage(
                    tile.image,
                    screen.x,
                    screen.y,
                    tileScreenWidth + 0.5,
                    tileScreenHeight + 0.5
                );

            } else {

                const ancestor =
                    tile.failed
                        ? null
                        : findCachedTileAncestor(
                            map,
                            tiles,
                            zoom,
                            tileX,
                            tileY
                        );

                if (
                    ancestor
                ) {

                    ctx.drawImage(
                        ancestor.image,
                        ancestor.sourceX,
                        ancestor.sourceY,
                        ancestor.sourceWidth,
                        ancestor.sourceHeight,
                        screen.x,
                        screen.y,
                        tileScreenWidth + 0.5,
                        tileScreenHeight + 0.5
                    );

                } else {

                    ctx.fillStyle =
                        '#151a1d';

                    ctx.fillRect(
                        screen.x,
                        screen.y,
                        tileScreenWidth + 0.5,
                        tileScreenHeight + 0.5
                    );
                }
            }
        }
    }

    ctx.restore();
}

;

/* js/map/contours.js */
/* =========================
   CONTOURS
   ========================= */

/*
 * Terrain contour lines, precomputed by scripts/build-contours.mjs.
 *
 * The heightfield itself is 129 MB per map and js/features/terrain-ballistics.js
 * only ever streams the two chunks a firing solution touches. A contour layer
 * needs the whole map, so the lines are baked at build time into one file per
 * map — a few hundred KB — and fetched here the first time somebody turns the
 * layer on. Nobody who leaves it off ever downloads anything.
 *
 * Lines carry no altitude labels. The heightfield sits on an offset datum
 * (see docs/terrain.md), so an absolute label would be wrong by roughly
 * 900 m; the shape of the ground is what the layer is for.
 */

const CONTOURS_FORMAT = 'wardogs-contours-v1';

/*
 * Maps known to ship a contours.json. Listed rather than probed so the
 * Layers popover can decide whether to offer the toggle without a fetch.
 */
const CONTOUR_MAP_IDS = [
    'bakurani',
    'ozeti',
    'zestafona'
];

/*
 * Every line is stroked twice: a dark casing, then the line itself. Map
 * tiles are photographic, so a single thin stroke disappears into snow on
 * one ridge and into shadow on the next. The casing is what makes the
 * colour legible over all of it.
 */
const CONTOUR_STYLE = {
    casing: 'rgba(0, 0, 0, 0.55)',
    minorWidth: 1,
    majorWidth: 2.2,
    casingExtra: 1.6,
    minorAlpha: 0.75,
    majorAlpha: 1
};

/*
 * Hypsometric ramp, low ground to high. Without it every line is the same
 * colour and a contour map is just a wall of squiggles — you cannot tell a
 * basin from a summit without tracing a line by eye. Colour carries the
 * height so the shape of the ground reads at a glance.
 */
const CONTOUR_RAMP = [
    [0.00, [79, 127, 168]],
    [0.20, [95, 168, 127]],
    [0.42, [176, 189, 92]],
    [0.60, [215, 194, 95]],
    [0.76, [217, 139, 74]],
    [0.90, [201, 96, 63]],
    [1.00, [242, 228, 216]]
];

function contourRampColor(fraction) {
    const t = Math.min(1, Math.max(0, fraction));

    let lower = CONTOUR_RAMP[0];
    let upper = CONTOUR_RAMP[CONTOUR_RAMP.length - 1];

    for (let i = 0; i < CONTOUR_RAMP.length - 1; i += 1) {
        if (t >= CONTOUR_RAMP[i][0] && t <= CONTOUR_RAMP[i + 1][0]) {
            lower = CONTOUR_RAMP[i];
            upper = CONTOUR_RAMP[i + 1];
            break;
        }
    }

    const span = upper[0] - lower[0];

    const local = span > 0
        ? (t - lower[0]) / span
        : 0;

    const channel = index => Math.round(
        lower[1][index] +
        (upper[1][index] - lower[1][index]) * local
    );

    return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

const CONTOUR_CACHE = new Map();

function mapHasContours(mapId) {
    return CONTOUR_MAP_IDS.includes(mapId);
}

function contoursUrl(mapId) {
    return `data/terrain/${mapId}/contours.json`;
}

/*
 * Turns the delta-encoded payload into absolute game coordinates once, so
 * every later frame is a straight coordinate transform.
 *
 * Grid rows run north to south, which is why y is subtracted.
 */
function decodeContours(payload) {
    const quantisation =
        Number(payload.quantisation) || 10;

    const grid = payload.grid || {};

    const originX = Number(grid.originX);
    const originY = Number(grid.originY);
    const stepX = Number(grid.stepX);
    const stepY = Number(grid.stepY);

    if (
        ![originX, originY, stepX, stepY].every(Number.isFinite)
    ) {
        throw new Error('Contour payload has an unusable grid');
    }

    const levels = [];

    /*
     * Heights are relative to the lowest sample in the map's own bounds, so
     * the ramp is stretched across whatever relief this map actually has —
     * Bakurani's 1082 m and Ozeti's 388 m both use the full range.
     */
    const relief =
        Number(payload.reliefMeters) ||
        Math.max(
            1,
            ...(payload.levels || []).map(
                level => Number(level.relativeMeters) || 0
            )
        );

    for (const level of payload.levels || []) {
        const lines = [];

        for (const flat of level.lines || []) {
            const points = new Float32Array(flat.length);

            let x = 0;
            let y = 0;

            let minPointX = Infinity;
            let maxPointX = -Infinity;
            let minPointY = Infinity;
            let maxPointY = -Infinity;

            for (let i = 0; i < flat.length; i += 2) {
                x += flat[i];
                y += flat[i + 1];

                const pointX = originX + (x / quantisation) * stepX;
                const pointY = originY - (y / quantisation) * stepY;

                points[i] = pointX;
                points[i + 1] = pointY;

                if (pointX < minPointX) {
                    minPointX = pointX;
                }

                if (pointX > maxPointX) {
                    maxPointX = pointX;
                }

                if (pointY < minPointY) {
                    minPointY = pointY;
                }

                if (pointY > maxPointY) {
                    maxPointY = pointY;
                }
            }

            lines.push({
                points,
                minX: minPointX,
                maxX: maxPointX,
                minY: minPointY,
                maxY: maxPointY
            });
        }

        levels.push({
            major: Boolean(level.major),
            relativeMeters: Number(level.relativeMeters),
            color: contourRampColor(
                Number(level.relativeMeters) / relief
            ),
            lines
        });
    }

    return {
        mapId: payload.mapId,
        intervalMeters: Number(payload.intervalMeters),
        reliefMeters: relief,
        levels,
        paths: null,
        /*
         * Offscreen raster of the drawn layer, created on first draw and
         * reused until the zoom changes or a pan runs off its margin.
         */
        raster: null
    };
}

/*
 * Resolves to the decoded contours for a map, or null if the map has none.
 * Concurrent callers share one fetch, and a failure is cached as null so a
 * missing file does not re-request on every redraw.
 */
function loadContours(mapId) {
    if (!mapHasContours(mapId)) {
        return Promise.resolve(null);
    }

    if (CONTOUR_CACHE.has(mapId)) {
        return Promise.resolve(CONTOUR_CACHE.get(mapId));
    }

    const finishProgress = typeof beginAssetLoadingProgress === 'function'
        ? beginAssetLoadingProgress(`contours:${mapId}`, { mapId }) : () => {};
    const pending = fetch(contoursUrl(mapId))
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `${response.status} ${response.statusText}`
                );
            }

            return response.json();
        })
        .then(payload => {
            if (payload?.format !== CONTOURS_FORMAT) {
                throw new Error(
                    `Unsupported contour format ${payload?.format}`
                );
            }

            const decoded = decodeContours(payload);

            CONTOUR_CACHE.set(mapId, decoded);

            finishProgress();
            return decoded;
        })
        .catch(error => {
            finishProgress(false);
            console.warn(
                `[contours] Could not load ${mapId} contours; ` +
                'the layer will stay empty.',
                error
            );

            if (
                typeof trackOperationalFailure ===
                    'function'
            ) {
                trackOperationalFailure(
                    'asset-load-failed',
                    {
                        area: 'map',
                        type: 'contours',
                        map: mapId,
                        code: 'load'
                    }
                );
            }

            CONTOUR_CACHE.set(mapId, null);

            return null;
        });

    CONTOUR_CACHE.set(mapId, pending);

    return pending;
}

function cachedContours(mapId) {
    const cached = CONTOUR_CACHE.get(mapId);

    if (!cached || typeof cached.then === 'function') {
        return null;
    }

    return cached;
}

/*
 * Called when the layer is switched on, and on map change while it is on.
 * The fetch is fire-and-forget: draw() renders nothing until it lands, then
 * redraws.
 */
function ensureContoursLoaded(mapId) {
    if (!mapId || CONTOUR_CACHE.has(mapId)) {
        return;
    }

    loadContours(mapId).then(decoded => {
        if (decoded) {
            draw();
        }
    });
}

/*
 * Bakurani is 54 levels of a few hundred polylines each. Stroking that on
 * every frame — twice, once for the casing — makes a drag visibly stutter,
 * and a drag redraws on every pointer move.
 *
 * So the layer is rasterised once into an offscreen canvas covering the
 * viewport plus a margin, and every frame after that is one drawImage. The
 * raster is rebuilt only when the zoom changes or a pan reaches the edge of
 * the margin, which is what makes the cost independent of how many lines
 * the map has.
 */
const CONTOUR_RASTER_MARGIN = 320;

/*
 * Path2D per polyline, in game coordinates. Building a path is the
 * expensive part — Bakurani is 79,615 points across 861 polylines — so it
 * is done once per map and never again. The raster transform carries the
 * scale and the pan instead, which is what makes a zoom step cost nothing
 * to prepare.
 *
 * Each polyline keeps the bounding box computed at decode time so the
 * renderer can skip whatever is nowhere near the raster.
 */
function ensureContourPaths(data) {
    if (data.paths) {
        return data.paths;
    }

    data.paths = data.levels.map(level => {
        const lines = level.lines.map(line => {
            const path = new Path2D();
            const points = line.points;

            path.moveTo(points[0], points[1]);

            for (let i = 2; i < points.length; i += 2) {
                path.lineTo(points[i], points[i + 1]);
            }

            return {
                path,
                minX: line.minX,
                maxX: line.maxX,
                minY: line.minY,
                maxY: line.maxY
            };
        });

        return {
            lines,
            major: level.major,
            color: level.color,
            width: level.major
                ? CONTOUR_STYLE.majorWidth
                : CONTOUR_STYLE.minorWidth,
            alpha: level.major
                ? CONTOUR_STYLE.majorAlpha
                : CONTOUR_STYLE.minorAlpha
        };
    });

    return data.paths;
}

const CONTOUR_MINOR_MAX_SPAN = 0.55;

function contourMinorsVisible(v) {
    const visibleSpan =
        wrap.clientWidth /
        v.scale /
        v.worldWidth;

    return visibleSpan <= CONTOUR_MINOR_MAX_SPAN;
}

/*
 * Renders the layer into `raster`, which covers the local-screen rectangle
 * starting at (originX, originY).
 *
 * Game coordinates go in and the transform does the projection, so the
 * paths never have to be rebuilt. A stroke width has to be divided by the
 * scale to come out the same thickness on screen at any zoom.
 */
function renderContourRaster(data, v, raster) {
    const target = raster.canvas.getContext('2d');
    const ratio = raster.ratio;
    const scale = v.scale;

    target.setTransform(1, 0, 0, 1, 0, 0);

    target.clearRect(
        0,
        0,
        raster.canvas.width,
        raster.canvas.height
    );

    target.setTransform(
        scale * ratio,
        0,
        0,
        -scale * ratio,
        (-v.bounds.minX * scale - raster.originX) * ratio,
        (v.bounds.maxY * scale - raster.originY) * ratio
    );

    const paths = ensureContourPaths(data);

    const pad = 4 / scale;

    const cullMinX = v.bounds.minX + raster.originX / scale - pad;
    const cullMaxX = cullMinX + raster.width / scale + pad * 2;
    const cullMaxY = v.bounds.maxY - raster.originY / scale + pad;
    const cullMinY = cullMaxY - raster.height / scale - pad * 2;

    const majorCasing = new Path2D();
    const minorCasing = new Path2D();

    const drawn = [];

    for (const level of paths) {
        if (!level.major && !raster.minors) {
            continue;
        }

        const merged = new Path2D();

        let any = false;

        for (const line of level.lines) {
            if (
                line.maxX < cullMinX ||
                line.minX > cullMaxX ||
                line.maxY < cullMinY ||
                line.minY > cullMaxY
            ) {
                continue;
            }

            merged.addPath(line.path);
            any = true;
        }

        if (!any) {
            continue;
        }

        (level.major ? majorCasing : minorCasing).addPath(merged);

        drawn.push({
            path: merged,
            color: level.color,
            width: level.width,
            alpha: level.alpha
        });
    }

    target.lineJoin = 'round';
    target.lineCap = 'round';

    /*
     * Every casing first, so one level's casing never cuts a dark notch
     * through a neighbouring line that runs alongside it. The casing is one
     * colour for the whole layer, so the levels merge into two strokes —
     * one per width — instead of one stroke each.
     */
    target.strokeStyle = CONTOUR_STYLE.casing;

    target.lineWidth =
        (CONTOUR_STYLE.minorWidth + CONTOUR_STYLE.casingExtra) / scale;

    target.stroke(minorCasing);

    target.lineWidth =
        (CONTOUR_STYLE.majorWidth + CONTOUR_STYLE.casingExtra) / scale;

    target.stroke(majorCasing);

    for (const level of drawn) {
        target.globalAlpha = level.alpha;
        target.strokeStyle = level.color;
        target.lineWidth = level.width / scale;
        target.stroke(level.path);
    }

    target.globalAlpha = 1;
}

const CONTOUR_REBUILD_DELAY = 140;

const CONTOUR_MAX_STRETCH_IN = 1.8;

const CONTOUR_MAX_STRETCH_OUT = 0.8;

let contourRebuildTimer = null;

let contourRebuildAt = 0;

/*
 * One timer that re-arms itself against a moving deadline, rather than a
 * clear and a fresh timer per zoom step. A profile of a zoom put 81 ms of
 * main-thread time in clearTimeout alone.
 */
function contourRebuildTick() {
    if (!contourRebuildAt) {
        contourRebuildTimer = null;
        return;
    }

    const remaining = contourRebuildAt - performance.now();

    if (remaining > 0) {
        contourRebuildTimer = setTimeout(contourRebuildTick, remaining);
        return;
    }

    contourRebuildTimer = null;
    contourRebuildAt = 0;

    draw();
}

function scheduleContourRebuild() {
    contourRebuildAt = performance.now() + CONTOUR_REBUILD_DELAY;

    if (contourRebuildTimer === null) {
        contourRebuildTimer = setTimeout(
            contourRebuildTick,
            CONTOUR_REBUILD_DELAY
        );
    }
}

function drawContours(currentMap) {
    const mapId = currentMap?.id;

    if (!mapId || !mapHasContours(mapId)) {
        return;
    }

    ensureContoursLoaded(mapId);

    const data = cachedContours(mapId);

    if (!data) {
        return;
    }

    const v = view();

    /*
     * draw() has already translated by (v.left, v.top), so the visible
     * region in that space starts at (-v.left, -v.top).
     */
    const visibleX = -v.left;
    const visibleY = -v.top;
    const visibleWidth = wrap.clientWidth;
    const visibleHeight = wrap.clientHeight;

    const ratio = window.devicePixelRatio || 1;

    const width = visibleWidth + CONTOUR_RASTER_MARGIN * 2;
    const height = visibleHeight + CONTOUR_RASTER_MARGIN * 2;

    const minors = contourMinorsVisible(v);

    let raster = data.raster;

    /*
     * Coverage is tested in game coordinates, not in the local screen space
     * the raster was drawn in, because that space moves with the zoom and a
     * raster from a different scale still has to be placeable.
     */
    const viewMinX = v.bounds.minX + visibleX / v.scale;
    const viewMaxY = v.bounds.maxY - visibleY / v.scale;
    const viewMaxX = viewMinX + visibleWidth / v.scale;
    const viewMinY = viewMaxY - visibleHeight / v.scale;

    const covers =
        raster &&
        viewMinX >= raster.gameMinX &&
        viewMaxX <= raster.gameMaxX &&
        viewMinY >= raster.gameMinY &&
        viewMaxY <= raster.gameMaxY;

    const stretch = raster
        ? v.scale / raster.scale
        : 1;

    const zoomed =
        raster &&
        (
            raster.scale !== v.scale ||
            raster.minors !== minors
        );

    /*
     * A zoom step alone does not rebuild. The existing raster is stretched
     * to the new scale and the rebuild waits until the zoom stops, because
     * stroking the layer is GPU work that does not show up on the main
     * thread and doing it per wheel event is what makes a zoom stutter.
     * Anything the stretch cannot cover rebuilds at once: a new size, a pan
     * off the margin, a zoom in far enough that the stretch turns to mush,
     * or a zoom out far enough to pull ground in from beyond the margin.
     */
    const rebuild =
        !raster ||
        raster.ratio !== ratio ||
        raster.width !== width ||
        raster.height !== height ||
        (
            zoomed
                ? (
                    stretch > CONTOUR_MAX_STRETCH_IN ||
                    stretch < CONTOUR_MAX_STRETCH_OUT
                )
                : !covers
        );

    if (rebuild) {
        contourRebuildAt = 0;

        if (!raster) {
            raster = { canvas: document.createElement('canvas') };
            data.raster = raster;
        }

        raster.scale = v.scale;
        raster.ratio = ratio;
        raster.width = width;
        raster.height = height;
        raster.minors = minors;
        raster.originX = visibleX - CONTOUR_RASTER_MARGIN;
        raster.originY = visibleY - CONTOUR_RASTER_MARGIN;

        raster.gameMinX = v.bounds.minX + raster.originX / v.scale;
        raster.gameMaxY = v.bounds.maxY - raster.originY / v.scale;
        raster.gameMaxX = raster.gameMinX + width / v.scale;
        raster.gameMinY = raster.gameMaxY - height / v.scale;

        /*
         * Assigning to width or height reallocates and zeroes the backing
         * store, which the size almost never needs.
         */
        const pixelWidth = Math.round(width * ratio);
        const pixelHeight = Math.round(height * ratio);

        if (
            raster.canvas.width !== pixelWidth ||
            raster.canvas.height !== pixelHeight
        ) {
            raster.canvas.width = pixelWidth;
            raster.canvas.height = pixelHeight;
        }

        renderContourRaster(data, v, raster);
    } else if (zoomed) {
        scheduleContourRebuild();
    }

    /*
     * Placed from the game rectangle it was drawn for, so a raster built at
     * another scale lands where the ground it describes now sits.
     */
    ctx.drawImage(
        raster.canvas,
        (raster.gameMinX - v.bounds.minX) * v.scale,
        (v.bounds.maxY - raster.gameMaxY) * v.scale,
        (raster.gameMaxX - raster.gameMinX) * v.scale,
        (raster.gameMaxY - raster.gameMinY) * v.scale
    );
}

;

/* js/map/overlays.js */
/* =========================
   USER MARKERS
   ========================= */

function marker(
    p,
    text
) {

    const pos =
        worldToLocalScreen(
            p.x,
            p.y
        );

    ctx.beginPath();

    ctx.arc(
        pos.x,
        pos.y,
        8,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        text === 'O'
            ? '#5fa8d3'
            : '#d86666';

    ctx.fill();

    ctx.strokeStyle =
        '#fff';

    ctx.lineWidth =
        2;

    ctx.stroke();

    ctx.fillStyle =
        '#fff';

    ctx.font =
        'bold 10px system-ui';

    ctx.textAlign =
        'center';

    ctx.textBaseline =
        'alphabetic';

    ctx.fillText(
        text,
        pos.x,
        pos.y + 4
    );
}


/* =========================
   PRESET ZONES
   ========================= */

function drawPresetZones(map) {

    if (
        !map ||
        !Array.isArray(
            map.zones
        )
    ) {
        return;
    }

    const v =
        view();

    map.zones.forEach(
        zone => {

            if (
                typeof zone.x !== 'number' ||
                typeof zone.y !== 'number' ||
                typeof zone.radius !== 'number'
            ) {
                return;
            }

            const pos =
                worldToLocalScreen(
                    storedMetersToWorldCoordinate(zone.x),

                    storedMetersToWorldCoordinate(zone.y)
                );

            const radius =
                (
                    metersToWorldDistance(zone.radius)
                ) *
                v.scale;

            ctx.beginPath();

            ctx.arc(
                pos.x,
                pos.y,
                radius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                hexToRgba(
                    zone.color,
                    0.12
                );

            ctx.fill();

            ctx.strokeStyle =
                zone.color ||
                '#d7a452';

            ctx.lineWidth =
                2;

            ctx.setLineDash([
                7,
                5
            ]);

            ctx.stroke();

            ctx.setLineDash([]);
        }
    );
}


/* =========================
   PRESET POLYGONS
   ========================= */

function getPolygonCenter(points) {

    if (
        !Array.isArray(points) ||
        points.length === 0
    ) {
        return null;
    }

    let signedArea =
        0;

    let centroidX =
        0;

    let centroidY =
        0;

    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        const current =
            points[i];

        const next =
            points[
            (
                i + 1
            ) %
            points.length
                ];

        const cross =
            current.x *
            next.y -
            next.x *
            current.y;

        signedArea +=
            cross;

        centroidX +=
            (
                current.x +
                next.x
            ) *
            cross;

        centroidY +=
            (
                current.y +
                next.y
            ) *
            cross;
    }

    signedArea *=
        0.5;

    if (
        Math.abs(
            signedArea
        ) <
        1e-9
    ) {

        const sum =
            points.reduce(
                (
                    result,
                    point
                ) => {

                    result.x +=
                        point.x;

                    result.y +=
                        point.y;

                    return result;
                },
                {
                    x: 0,
                    y: 0
                }
            );

        return {
            x:
                sum.x /
                points.length,

            y:
                sum.y /
                points.length
        };
    }

    centroidX /=
        6 *
        signedArea;

    centroidY /=
        6 *
        signedArea;

    return {
        x:
        centroidX,

        y:
        centroidY
    };
}

function drawPolygonLabel(
    polygon,
    validPoints
) {

    if (
        !polygon.label
    ) {
        return;
    }

    const center =
        getPolygonCenter(
            validPoints
        );

    if (!center) {
        return;
    }

    const screen =
        worldToLocalScreen(
            storedMetersToWorldCoordinate(center.x),

            storedMetersToWorldCoordinate(center.y)
        );

    ctx.save();

    ctx.font =
        'bold 11px system-ui, sans-serif';

    ctx.textAlign =
        'center';

    ctx.textBaseline =
        'middle';

    const metrics =
        ctx.measureText(
            polygon.label
        );

    const paddingX =
        7;

    const paddingY =
        4;

    const labelWidth =
        metrics.width +
        paddingX *
        2;

    const labelHeight =
        11 +
        paddingY *
        2;

    ctx.fillStyle =
        polygon.labelBackground ||
        'rgba(16, 19, 22, .85)';

    ctx.fillRect(
        screen.x -
        labelWidth /
        2,

        screen.y -
        labelHeight /
        2,

        labelWidth,
        labelHeight
    );

    ctx.strokeStyle =
        polygon.labelBorder ||
        'rgba(255,255,255,.15)';

    ctx.lineWidth =
        1;

    ctx.strokeRect(
        screen.x -
        labelWidth /
        2,

        screen.y -
        labelHeight /
        2,

        labelWidth,
        labelHeight
    );

    ctx.fillStyle =
        polygon.labelColor ||
        '#ffffff';

    ctx.fillText(
        polygon.label,
        screen.x,
        screen.y
    );

    ctx.restore();
}

// MI_UI_Safe_Zone parameters seed the Canvas approximation. Shader-space
// thickness values are converted to bounded screen-pixel widths.
const SPAWN_ZONE_MATERIAL = Object.freeze({
    innerOpacity: 0.192,
    innerGlowStrength: 1.85773,
    outerOpacity: 0.444,
    thickness: 0.02,
    hookThickness: 0.05
});

function drawSpawnZonePolygon(polygon, validPoints) {
    const points = validPoints.map(point => worldToLocalScreen(
        storedMetersToWorldCoordinate(point.x),
        storedMetersToWorldCoordinate(point.y)
    ));
    if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
        return false;
    }

    const edges = points.map((point, index) => {
        const next = points[(index + 1) % points.length];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        return { point, next, dx, dy, length: Math.hypot(dx, dy) };
    });
    if (edges.some(edge => edge.length <= 0)) return false;
    const area = edges.reduce((sum, edge) =>
        sum + edge.point.x * edge.next.y - edge.next.x * edge.point.y, 0);
    if (!Number.isFinite(area) || Math.abs(area) < 1e-6) return false;

    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y));
    const v = view();
    if (maxX < -v.left - 4 || maxY < -v.top - 4 ||
        minX > wrap.clientWidth - v.left + 4 ||
        minY > wrap.clientHeight - v.top + 4) return false;

    const shortestEdge = Math.min(...edges.map(edge => edge.length));
    const highContrast = document.documentElement.dataset.a11yHighContrast === 'true';
    const color = polygon.color || '#d7a452';
    const fillColor = polygon.fillColor || color;
    const opacity = Number.isFinite(polygon.fillOpacity)
        ? Math.max(0, Math.min(1, polygon.fillOpacity))
        : SPAWN_ZONE_MATERIAL.innerOpacity;
    const fillOpacity = highContrast ? Math.max(0.24, opacity) : opacity;
    const glowWidth = Math.min(shortestEdge / 3,
        Math.max(3, Math.min(18, shortestEdge * 0.06)));
    const glowOpacity = highContrast ? 0.3 : SPAWN_ZONE_MATERIAL.innerGlowStrength * 0.1;
    const lineWidth = highContrast ? 3 : Math.max(1,
        Math.min(2, shortestEdge * SPAWN_ZONE_MATERIAL.thickness));
    const hookWidth = highContrast ? 4 : Math.max(1.5,
        Math.min(4, shortestEdge * SPAWN_ZONE_MATERIAL.hookThickness));
    const hookLength = Math.min(24, shortestEdge * 0.28,
        Math.max(4, shortestEdge * 0.16));
    const traceBoundary = () => {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
        ctx.closePath();
    };

    ctx.save();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    traceBoundary();
    ctx.fillStyle = hexToRgba(fillColor, fillOpacity);
    ctx.fill();

    // Fade inward from each real edge instead of using a circular gradient.
    // Clipping preserves the rotated outlines, including their corner points.
    ctx.save();
    ctx.clip();
    edges.forEach(edge => {
        const tx = edge.dx / edge.length;
        const ty = edge.dy / edge.length;
        const winding = area > 0 ? 1 : -1;
        const nx = -ty * winding;
        const ny = tx * winding;
        const midX = (edge.point.x + edge.next.x) / 2;
        const midY = (edge.point.y + edge.next.y) / 2;
        const gradient = ctx.createLinearGradient(midX, midY,
            midX + nx * glowWidth, midY + ny * glowWidth);
        gradient.addColorStop(0, hexToRgba(color, glowOpacity));
        gradient.addColorStop(1, hexToRgba(color, 0));
        const startX = edge.point.x - tx * glowWidth;
        const startY = edge.point.y - ty * glowWidth;
        const endX = edge.next.x + tx * glowWidth;
        const endY = edge.next.y + ty * glowWidth;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(endX + nx * glowWidth, endY + ny * glowWidth);
        ctx.lineTo(startX + nx * glowWidth, startY + ny * glowWidth);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
    });
    ctx.restore();

    traceBoundary();
    ctx.strokeStyle = '#151a1d';
    ctx.lineWidth = lineWidth + 2;
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(color, highContrast ? 1 : SPAWN_ZONE_MATERIAL.outerOpacity);
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Short corner brackets distinguish deployment areas from other polygons.
    ctx.beginPath();
    points.forEach((point, index) => {
        const previous = edges[(index + edges.length - 1) % edges.length];
        const next = edges[index];
        ctx.moveTo(point.x - previous.dx / previous.length * hookLength,
            point.y - previous.dy / previous.length * hookLength);
        ctx.lineTo(point.x, point.y);
        ctx.lineTo(point.x + next.dx / next.length * hookLength,
            point.y + next.dy / next.length * hookLength);
    });
    ctx.strokeStyle = '#151a1d';
    ctx.lineWidth = hookWidth + 2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = hookWidth;
    ctx.stroke();
    ctx.restore();
    return true;
}

function drawPresetPolygons(map) {

    if (
        !map ||
        !Array.isArray(
            map.polygons
        )
    ) {
        return;
    }

    map.polygons.forEach(
        polygon => {

            if (
                !polygon ||
                !Array.isArray(
                    polygon.points
                )
            ) {
                return;
            }

            const validPoints =
                polygon.points.filter(
                    point =>
                        point &&
                        typeof point.x === 'number' &&
                        typeof point.y === 'number'
                );

            if (
                validPoints.length <
                3
            ) {
                return;
            }

            if (polygon.renderStyle === 'spawn') {
                if (drawSpawnZonePolygon(polygon, validPoints)) {
                    drawPolygonLabel(polygon, validPoints);
                }
                return;
            }

            const first =
                worldToLocalScreen(
                    storedMetersToWorldCoordinate(validPoints[0].x),

                    storedMetersToWorldCoordinate(validPoints[0].y)
                );

            ctx.save();

            ctx.beginPath();

            ctx.moveTo(
                first.x,
                first.y
            );

            for (
                let i = 1;
                i < validPoints.length;
                i++
            ) {

                const point =
                    validPoints[i];

                const screen =
                    worldToLocalScreen(
                        storedMetersToWorldCoordinate(point.x),

                        storedMetersToWorldCoordinate(point.y)
                    );

                ctx.lineTo(
                    screen.x,
                    screen.y
                );
            }

            ctx.closePath();

            const color =
                polygon.color ||
                '#d7a452';

            const fillOpacity =
                typeof polygon.fillOpacity ===
                'number'
                    ? Math.max(
                        0,
                        Math.min(
                            1,
                            polygon.fillOpacity
                        )
                    )
                    : 0.15;

            if (
                polygon.fillColor
            ) {

                ctx.fillStyle =
                    hexToRgba(
                        polygon.fillColor,
                        fillOpacity
                    );

            } else {

                ctx.fillStyle =
                    hexToRgba(
                        color,
                        fillOpacity
                    );
            }

            ctx.fill();

            ctx.strokeStyle =
                color;

            ctx.lineWidth =
                typeof polygon.strokeWidth ===
                'number'
                    ? Math.max(
                        0.5,
                        polygon.strokeWidth
                    )
                    : 2;

            if (
                polygon.dashed
            ) {

                ctx.setLineDash(
                    Array.isArray(
                        polygon.dash
                    )
                        ? polygon.dash
                        : [
                            8,
                            6
                        ]
                );

            } else {

                ctx.setLineDash([]);
            }

            ctx.lineJoin =
                'round';

            ctx.lineCap =
                'round';

            ctx.stroke();

            ctx.setLineDash([]);

            ctx.restore();

            drawPolygonLabel(
                polygon,
                validPoints
            );
        }
    );
}


/* =========================
   PRESET MARKER TARGETING
   ========================= */

let SELECTED_PRESET_TARGET_KEY =
    null;

let PRESET_TARGET_SELECTED_AT =
    0;

let PRESET_TARGET_ANIMATION_FRAME =
    null;

let PRESET_MARKER_HOVER_KEY =
    null;

/* =========================
   PRESET MARKER ZOOM VISIBILITY
   ========================= */

/*
 * Marker minZoom / maxZoom values use the actual camera
 * zoom multiplier (S.zoom). Both limits are inclusive.
 * Missing limits mean unbounded.
 *
 * Example:
 *   minZoom: 2   -> hidden below 2x camera zoom
 *   maxZoom: 10  -> hidden above 10x camera zoom
 */
function getPresetMarkerZoomLevel() {

    const zoom =
        Number(S.zoom);

    return Number.isFinite(zoom)
        ? zoom
        : 1;
}

function isPresetMarkerVisibleAtZoom(
    item
) {

    if (!item) {
        return false;
    }

    const zoom =
        getPresetMarkerZoomLevel();

    const minZoom =
        Number(item.minZoom);

    const maxZoom =
        Number(item.maxZoom);

    if (
        Number.isFinite(minZoom) &&
        zoom < minZoom
    ) {
        return false;
    }

    if (
        Number.isFinite(maxZoom) &&
        zoom > maxZoom
    ) {
        return false;
    }

    return true;
}

function getPresetMarkerKey(
    item,
    index,
    mapId = S.map
) {

    return [
        mapId,
        index,
        item.icon || item.emoji || 'marker',
        item.x,
        item.y
    ].join(':');
}

function getPresetMarkerScreenGeometry(
    item
) {

    if (
        !item ||
        typeof item.x !== 'number' ||
        typeof item.y !== 'number'
    ) {
        return null;
    }

    const center =
        toScreen(
            storedMetersToWorldCoordinate(item.x),
            storedMetersToWorldCoordinate(item.y)
        );

    const asset =
        getPresetMarkerAsset(item);

    if (asset) {

        const layout =
            getMarkerImageLayout(
                item,
                asset
            );

        return {
            center,
            width:
                layout.width,
            height:
                layout.height,
            left:
                center.x -
                layout.width *
                layout.anchorX,
            top:
                center.y -
                layout.height *
                layout.anchorY,
            right:
                center.x +
                layout.width *
                (
                    1 -
                    layout.anchorX
                ),
            bottom:
                center.y +
                layout.height *
                (
                    1 -
                    layout.anchorY
                )
        };
    }

    const size =
        getMarkerEmojiSize(
            view()
        );

    return {
        center,
        width: size,
        height: size,
        left:
            center.x -
            size / 2,
        top:
            center.y -
            size / 2,
        right:
            center.x +
            size / 2,
        bottom:
            center.y +
            size / 2
    };
}

function findPresetMarkerAtCanvasPoint(
    x,
    y
) {

    const map =
        getCurrentMap();

    if (
        typeof isMapLayerVisible ===
        'function' &&
        !isMapLayerVisible(
            'presetMarkers'
        )
    ) {
        return null;
    }

    if (
        !map ||
        !Array.isArray(
            map.markers
        )
    ) {
        return null;
    }

    let best =
        null;

    map.markers.forEach(
        (
            item,
            index
        ) => {

            if (
                !isPresetMarkerVisibleAtZoom(
                    item
                )
            ) {
                return;
            }

            const geometry =
                getPresetMarkerScreenGeometry(
                    item
                );

            if (!geometry) {
                return;
            }

            const padding =
                7;

            if (
                x <
                geometry.left -
                padding ||
                x >
                geometry.right +
                padding ||
                y <
                geometry.top -
                padding ||
                y >
                geometry.bottom +
                padding
            ) {
                return;
            }

            const distance =
                Math.hypot(
                    x -
                    geometry.center.x,
                    y -
                    geometry.center.y
                );

            if (
                !best ||
                distance <
                best.distance
            ) {

                best = {
                    item,
                    index,
                    geometry,
                    distance
                };
            }
        }
    );

    return best;
}

function setPresetMarkerHover(
    markerInfo
) {

    const nextKey =
        markerInfo
            ? getPresetMarkerKey(
                markerInfo.item,
                markerInfo.index
            )
            : null;

    if (
        nextKey ===
        PRESET_MARKER_HOVER_KEY
    ) {
        return;
    }

    PRESET_MARKER_HOVER_KEY =
        nextKey;

    c.classList.toggle(
        'preset-marker-hover',
        Boolean(
            nextKey
        )
    );
}

function updatePresetMarkerHover(
    event
) {

    if (
        typeof MAP_TOOL_STATE !==
        'undefined' &&
        [
            'ruler',
            'pencil',
            'eraser',
            'marker'
        ].includes(
            MAP_TOOL_STATE.tool
        )
    ) {

        setPresetMarkerHover(
            null
        );

        return;
    }

    const rect =
        c.getBoundingClientRect();

    setPresetMarkerHover(
        findPresetMarkerAtCanvasPoint(
            event.clientX -
            rect.left,
            event.clientY -
            rect.top
        )
    );
}

function startPresetTargetSelectionAnimation() {

    if (
        PRESET_TARGET_ANIMATION_FRAME
    ) {

        cancelAnimationFrame(
            PRESET_TARGET_ANIMATION_FRAME
        );
    }

    const tick =
        () => {

            draw();

            if (
                performance.now() -
                PRESET_TARGET_SELECTED_AT <
                900
            ) {

                PRESET_TARGET_ANIMATION_FRAME =
                    requestAnimationFrame(
                        tick
                    );

            } else {

                PRESET_TARGET_ANIMATION_FRAME =
                    null;

                draw();
            }
        };

    PRESET_TARGET_ANIMATION_FRAME =
        requestAnimationFrame(
            tick
        );
}

function selectPresetMarkerAsTarget(
    item,
    index
) {

    if (
        !item ||
        typeof item.x !== 'number' ||
        typeof item.y !== 'number'
    ) {
        return false;
    }

    SELECTED_PRESET_TARGET_KEY =
        getPresetMarkerKey(
            item,
            index
        );

    PRESET_TARGET_SELECTED_AT =
        performance.now();

    pushMapToolHistory();

    S.target = {
        x:
            storedMetersToWorldCoordinate(item.x),
        y:
            storedMetersToWorldCoordinate(item.y)
    };

    clamp(
        S.target
    );

    S.mode =
        'target';

    $('targetMode')
        ?.classList
        .add(
            'active'
        );

    $('originMode')
        ?.classList
        .remove(
            'active'
        );

    inputs();

    renderSavedTargets();

    startPresetTargetSelectionAnimation();

    return true;
}

function handlePresetMarkerTargetMouseDown(
    event
) {

    if (
        event.button !==
        0
    ) {
        return false;
    }

    if (
        typeof MAP_TOOL_STATE !==
        'undefined' &&
        [
            'ruler',
            'pencil',
            'eraser',
            'marker'
        ].includes(
            MAP_TOOL_STATE.tool
        )
    ) {
        return false;
    }

    const rect =
        c.getBoundingClientRect();

    const markerInfo =
        findPresetMarkerAtCanvasPoint(
            event.clientX -
            rect.left,
            event.clientY -
            rect.top
        );

    if (!markerInfo) {
        return false;
    }

    if (
        isPointMapLocked('target')
    ) {
        return true;
    }

    return selectPresetMarkerAsTarget(
        markerInfo.item,
        markerInfo.index
    );
}

function getPresetTargetCoordinateTolerance() {
    const coordinatePrecision =
        getCoordinateMetersPerUnit() === 100
            ? 100
            : 1000;

    return (
        0.5 / coordinatePrecision +
        1e-9
    );
}

function getPresetMarkerSelectionProgress(
    item,
    index
) {

    const key =
        getPresetMarkerKey(
            item,
            index
        );

    if (
        key !==
        SELECTED_PRESET_TARGET_KEY
    ) {
        return null;
    }

    /*
     * clamp() stores coordinates at the precision exposed by the current
     * map. Zestafona tower coordinates contain additional source decimals,
     * so compare within half one editable coordinate step instead of using
     * a fixed tolerance that only works for already-rounded map data.
     */
    const targetTolerance =
        getPresetTargetCoordinateTolerance();

    const targetMatches =
        Math.abs(
            S.target.x -
            storedMetersToWorldCoordinate(item.x)
        ) <=
        targetTolerance &&
        Math.abs(
            S.target.y -
            storedMetersToWorldCoordinate(item.y)
        ) <=
        targetTolerance;

    if (!targetMatches) {

        SELECTED_PRESET_TARGET_KEY =
            null;

        return null;
    }

    return Math.min(
        1,
        Math.max(
            0,
            (
                performance.now() -
                PRESET_TARGET_SELECTED_AT
            ) /
            900
        )
    );
}

function getPresetMarkerSelectionScale(
    item,
    index
) {

    const progress =
        getPresetMarkerSelectionProgress(
            item,
            index
        );

    if (progress === null) {
        return 1;
    }

    if (
        progress >=
        0.6
    ) {
        return 1;
    }

    return (
        1 +
        Math.sin(
            (
                progress /
                0.6
            ) *
            Math.PI
        ) *
        0.18
    );
}

function drawPresetMarkerSelection(
    item,
    index,
    x,
    y,
    iconSize
) {

    const progress =
        getPresetMarkerSelectionProgress(
            item,
            index
        );

    if (progress === null) {
        return;
    }

    const baseRadius =
        Math.max(
            15,
            iconSize *
            0.62
        );

    const pulse =
        progress < 1
            ? Math.sin(
                progress *
                Math.PI *
                3
            )
            : 0;

    const radius =
        baseRadius +
        (
            progress < 1
                ? 4 +
                pulse * 2
                : 2
        );

    ctx.save();

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        document.documentElement
            .dataset.theme ===
            'light'
            ? 'rgba(168,121,36,.13)'
            : 'rgba(215,164,82,.12)';

    ctx.fill();

    ctx.strokeStyle =
        getComputedStyle(
            document.documentElement
        )
            .getPropertyValue(
                '--accent'
            )
            .trim() ||
        '#d7a452';

    ctx.lineWidth =
        2;

    ctx.stroke();

    if (
        progress <
        1
    ) {

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius +
            7 +
            progress * 8,
            0,
            Math.PI * 2
        );

        ctx.globalAlpha =
            Math.max(
                0,
                0.55 *
                (
                    1 -
                    progress
                )
            );

        ctx.lineWidth =
            1.5;

        ctx.stroke();
    }

    ctx.restore();
}


/* =========================
   PRESET MARKERS
   ========================= */

const PRESET_TOWER_MARKER_STYLE = Object.freeze({
    width: 32,
    height: 32,
    anchorX: 0.5,
    anchorY: 0.5,
    fontFamily: 'WARDOGS Tower Numbers',
    // The exported text style uses 10 pt; Slate renders at 96 DPI.
    fontSize: 10 * 96 / 72,
    padding: 4,
    outlineOpacity: 0.4,
    shadowOpacity: 0.8,
    shadowOffset: 0.8
});

let PRESET_TOWER_FONT_STARTED = false;

function getPresetTowerNumber(item) {
    if (item?.icon !== 'tower') return null;

    const configured = item.towerNumber;
    if (Number.isInteger(configured) && configured > 0 && configured < 100) {
        return String(configured);
    }

    // Keep older map configurations usable without inferring an array order.
    const match = typeof item.label === 'string'
        ? item.label.match(/(?:^|\s)([1-9]\d?)\s*$/)
        : null;
    return match ? String(Number(match[1])) : null;
}

function getPresetMarkerAsset(item) {
    const asset = typeof item?.icon === 'string'
        ? getMarkerAsset(item.icon)
        : null;
    return asset || (getPresetTowerNumber(item) !== null
        ? PRESET_TOWER_MARKER_STYLE
        : null);
}

function loadPresetTowerNumberFont() {
    if (PRESET_TOWER_FONT_STARTED || typeof FontFace !== 'function' || !document.fonts) {
        return;
    }
    PRESET_TOWER_FONT_STARTED = true;

    try {
        const font = new FontFace(
            PRESET_TOWER_MARKER_STYLE.fontFamily,
            `url("${resourceURL('assets/fonts/barlow/tower-numbers-semibold.woff')}")`,
            { weight: '600', style: 'normal' }
        );
        font.load().then(loaded => {
            document.fonts.add(loaded);
            draw();
        }).catch(() => {}); // System-font numerals remain usable if loading fails.
    } catch {
        // Font support is optional and must never prevent map rendering.
    }
}

function drawPresetTowerMarker(item, x, y, selectionScale = 1) {
    const number = getPresetTowerNumber(item);
    if (number === null) return;

    const style = PRESET_TOWER_MARKER_STYLE;
    const layout = getMarkerImageLayout(item, getPresetMarkerAsset(item));
    const width = layout.width * selectionScale;
    const height = layout.height * selectionScale;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return;
    }
    const left = x - width * layout.anchorX;
    const top = y - height * layout.anchorY;
    const scale = Math.min(width, height) / style.width;
    const image = drawMarkerImage(item, x, y, selectionScale);

    ctx.save();
    ctx.filter = 'none';

    if (!image?.drawn) {
        // Preserve the numbered marker and its hit area while artwork loads.
        ctx.beginPath();
        ctx.moveTo(left + width / 2, top);
        ctx.lineTo(left + width, top + height / 2);
        ctx.lineTo(left + width / 2, top + height);
        ctx.lineTo(left, top + height / 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, .92)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, scale);
        ctx.stroke();
    }

    loadPresetTowerNumberFont();

    const highContrast = document.documentElement?.dataset?.a11yHighContrast === 'true';
    const padding = style.padding * scale;
    const fontSize = style.fontSize * scale * getMapLabelAccessibilityScale();
    const textX = left + width - padding;
    const textY = top + padding;
    const maxWidth = Math.max(1, width - padding * 2);

    ctx.font = `600 ${fontSize}px "${style.fontFamily}", Barlow, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = (highContrast ? 4 : 2) * scale;
    ctx.strokeStyle = `rgba(0, 0, 0, ${highContrast ? 1 : style.outlineOpacity})`;
    ctx.shadowColor = `rgba(0, 0, 0, ${style.shadowOpacity})`;
    ctx.shadowOffsetX = style.shadowOffset * scale;
    ctx.shadowOffsetY = style.shadowOffset * scale;
    ctx.strokeText(number, textX, textY, maxWidth);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(number, textX, textY, maxWidth);
    ctx.restore();
}

function getMarkerEmojiSize(v) {

    return Math.max(
        14,
        Math.min(
            32,
            v.scale * 0.35
        )
    );
}

function getMarkerImageLayout(
    item,
    asset
) {

    const width =
        typeof item.width === 'number' &&
        item.width > 0
            ? item.width
            : asset.width;

    const height =
        typeof item.height === 'number' &&
        item.height > 0
            ? item.height
            : asset.height;

    const scale =
        typeof item.scale === 'number' &&
        item.scale > 0
            ? item.scale
            : 1;

    const anchorX =
        typeof item.anchorX === 'number'
            ? Math.max(
                0,
                Math.min(
                    1,
                    item.anchorX
                )
            )
            : asset.anchorX;

    const anchorY =
        typeof item.anchorY === 'number'
            ? Math.max(
                0,
                Math.min(
                    1,
                    item.anchorY
                )
            )
            : asset.anchorY;

    return {
        width:
            width * scale,

        height:
            height * scale,

        anchorX,
        anchorY
    };
}

function drawMarkerImage(
    item,
    x,
    y,
    scaleMultiplier = 1
) {

    const asset =
        getMarkerAsset(
            item.icon
        );

    if (!asset) {
        return null;
    }

    const imageEntry =
        loadMarkerImage(
            asset
        );

    if (
        !imageEntry ||
        imageEntry.failed
    ) {
        return null;
    }

    const layout =
        getMarkerImageLayout(
            item,
            asset
        );

    if (
        !imageEntry.loaded
    ) {
        return {
            drawn: false,
            height: layout.height,
            anchorY: layout.anchorY
        };
    }

    const drawWidth =
        layout.width *
        scaleMultiplier;

    const drawHeight =
        layout.height *
        scaleMultiplier;

    const left =
        x -
        drawWidth *
        layout.anchorX;

    const top =
        y -
        drawHeight *
        layout.anchorY;

    ctx.save();

    ctx.filter =
        getMapIconCanvasFilter();

    const source =
        getMarkerImageSource(
            asset,
            item.color
        );

    if (!source) {
        ctx.restore();
        return null;
    }

    ctx.drawImage(
        source,
        left,
        top,
        drawWidth,
        drawHeight
    );

    ctx.restore();

    return {
        drawn: true,
        height: drawHeight,
        anchorY: layout.anchorY
    };
}

function drawMarkerEmoji(
    item,
    x,
    y,
    v,
    scaleMultiplier = 1
) {

    const emojiSize =
        getMarkerEmojiSize(
            v
        ) *
        scaleMultiplier;

    ctx.font =
        `${emojiSize}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;

    ctx.fillText(
        item.emoji ||
        '📍',
        x,
        y
    );

    return emojiSize;
}

function getMapLabelAccessibilityScale() {

    const size =
        document.documentElement
            ?.dataset
            ?.a11yTextSize;

    if (size === 'xl') {
        return 1.45;
    }

    if (size === 'large') {
        return 1.2;
    }

    return 1;
}

function drawPresetMarkerLabel(
    item,
    x,
    y,
    visualBottomOffset,
    v
) {

    if (!item.label) {
        return;
    }

    const accessibilityScale =
        getMapLabelAccessibilityScale();

    const labelSize =
        Math.max(
            10,
            Math.min(
                14,
                v.scale * 0.15
            )
        ) *
        accessibilityScale;

    ctx.font =
        `${labelSize}px system-ui, sans-serif`;

    const metrics =
        ctx.measureText(
            item.label
        );

    const paddingX =
        6 *
        accessibilityScale;

    const paddingY =
        3 *
        accessibilityScale;

    const labelWidth =
        metrics.width +
        paddingX * 2;

    const labelHeight =
        labelSize +
        paddingY * 2;

    const labelX =
        x -
        labelWidth / 2;

    const labelY =
        y +
        visualBottomOffset +
        5;

    ctx.fillStyle =
        'rgba(16, 19, 22, .88)';

    ctx.fillRect(
        labelX,
        labelY,
        labelWidth,
        labelHeight
    );

    ctx.strokeStyle =
        'rgba(255, 255, 255, .12)';

    ctx.lineWidth =
        1;

    ctx.strokeRect(
        labelX,
        labelY,
        labelWidth,
        labelHeight
    );

    ctx.fillStyle =
        '#e7edf2';

    ctx.fillText(
        item.label,
        x,
        labelY +
        labelHeight / 2
    );
}

function drawPresetMarkers(map) {

    if (
        !map ||
        !Array.isArray(
            map.markers
        )
    ) {
        return;
    }

    const v =
        view();

    map.markers.forEach(
        (
            item,
            index
        ) => {

            if (
                !isPresetMarkerVisibleAtZoom(
                    item
                )
            ) {
                return;
            }

            if (
                typeof item.x !== 'number' ||
                typeof item.y !== 'number'
            ) {
                return;
            }

            const pos =
                worldToLocalScreen(
                    storedMetersToWorldCoordinate(item.x),
                    storedMetersToWorldCoordinate(item.y)
                );

            const x =
                pos.x;

            const y =
                pos.y;

            ctx.save();

            ctx.textAlign =
                'center';

            ctx.textBaseline =
                'middle';

            let visualBottomOffset =
                0;

            let imageResult =
                null;

            const selectionScale =
                getPresetMarkerSelectionScale(
                    item,
                    index
                );

            const markerAsset =
                getPresetMarkerAsset(item);

            const baseIconSize =
                markerAsset
                    ? Math.max(
                        getMarkerImageLayout(
                            item,
                            markerAsset
                        ).width,
                        getMarkerImageLayout(
                            item,
                            markerAsset
                        ).height
                    )
                    : getMarkerEmojiSize(
                        v
                    );

            drawPresetMarkerSelection(
                item,
                index,
                x,
                y,
                baseIconSize
            );

            if (getPresetTowerNumber(item) !== null) {
                drawPresetTowerMarker(item, x, y, selectionScale);
                ctx.restore();
                return;
            }

            /*
             * If "icon" is specified, try to
             * render an image asset first.
             */
            if (
                typeof item.icon === 'string' &&
                item.icon
            ) {

                imageResult =
                    drawMarkerImage(
                        item,
                        x,
                        y,
                        selectionScale
                    );
            }

            if (
                imageResult &&
                imageResult.drawn
            ) {

                visualBottomOffset =
                    imageResult.height *
                    (
                        1 -
                        imageResult.anchorY
                    );

            } else {

                /*
                 * Emoji remains fully supported
                 * and is also used as a fallback
                 * if an image asset is missing or
                 * fails to load.
                 */
                const emojiSize =
                    drawMarkerEmoji(
                        item,
                        x,
                        y,
                        v,
                        selectionScale
                    );

                visualBottomOffset =
                    emojiSize / 2;
            }

            drawPresetMarkerLabel(
                item,
                x,
                y,
                visualBottomOffset,
                v
            );

            ctx.restore();
        }
    );
}


/* =========================
   COLORS
   ========================= */

function hexToRgba(
    color,
    alpha
) {

    if (!color) {
        return `rgba(215,164,82,${alpha})`;
    }

    if (
        color.startsWith(
            'rgba('
        )
    ) {
        return color;
    }

    if (
        color.startsWith(
            'rgb('
        )
    ) {

        return color
            .replace(
                'rgb(',
                'rgba('
            )
            .replace(
                ')',
                `,${alpha})`
            );
    }

    const hex =
        color.replace(
            '#',
            ''
        );

    if (
        hex.length !== 3 &&
        hex.length !== 6
    ) {
        return `rgba(215,164,82,${alpha})`;
    }

    const normalized =
        hex.length === 3
            ? hex
                .split('')
                .map(
                    char =>
                        char +
                        char
                )
                .join('')
            : hex;

    const r =
        parseInt(
            normalized.substring(
                0,
                2
            ),
            16
        );

    const g =
        parseInt(
            normalized.substring(
                2,
                4
            ),
            16
        );

    const b =
        parseInt(
            normalized.substring(
                4,
                6
            ),
            16
        );

    return `rgba(${r},${g},${b},${alpha})`;
}

;

/* js/map/control-zones.js */
/* =========================
   CONTROL ZONE PRESETS
   ========================= */

const CONTROL_ZONE_STORAGE_KEY =
    'wardogs-control-zones-v1';

const CONTROL_ZONE_STATE = {
    initialized: false,
    selections: Object.create(null),
    uiKey: null
};

// MI_UI_Zone_Circle inherits these values from MI_UI_Zone. The Canvas
// gradient approximates its SDF glow; thickness is normalized, not pixels.
const CONTROL_ZONE_MATERIAL = Object.freeze({
    innerOpacity: 0.128,
    innerGlowStrength: 0.609177,
    outerOpacity: 1,
    thickness: 0.001
});

function getMapControlZones(map = getCurrentMap()) {
    if (!Array.isArray(map?.controlZones)) {
        return [];
    }

    return map.controlZones.filter(zone =>
        typeof zone?.id === 'string' &&
        zone.id.length > 0 &&
        typeof zone.labelKey === 'string' &&
        Number.isFinite(zone.x) &&
        Number.isFinite(zone.y) &&
        Number.isFinite(zone.radiusMeters) &&
        zone.radiusMeters > 0
    );
}

function getSelectedControlZone(map = getCurrentMap()) {
    const id = CONTROL_ZONE_STATE.selections[map?.id];
    return getMapControlZones(map).find(zone => zone.id === id) || null;
}

function loadControlZoneSelections() {
    CONTROL_ZONE_STATE.selections = Object.create(null);

    try {
        const saved = JSON.parse(
            localStorage.getItem(CONTROL_ZONE_STORAGE_KEY)
        );

        if (!saved?.selections || typeof saved.selections !== 'object') {
            return;
        }

        Object.entries(MAPS).forEach(([mapId, map]) => {
            const id = saved.selections[mapId];
            if (getMapControlZones(map).some(zone => zone.id === id)) {
                CONTROL_ZONE_STATE.selections[mapId] = id;
            }
        });
    } catch {
        // A disabled or damaged browser store must not prevent map loading.
    }
}

function selectControlZone(id) {
    const map = getCurrentMap();
    if (!map?.id || (id !== '' && !getMapControlZones(map).some(zone => zone.id === id))) {
        return false;
    }

    if (id === '') {
        delete CONTROL_ZONE_STATE.selections[map.id];
    } else {
        CONTROL_ZONE_STATE.selections[map.id] = id;
        MAP_TOOL_STATE.layers.controlZones = true;
        saveMapToolState();
    }

    try {
        localStorage.setItem(CONTROL_ZONE_STORAGE_KEY, JSON.stringify({
            selections: CONTROL_ZONE_STATE.selections
        }));
    } catch {
        // Keep the selection available for this session without persistence.
    }

    updateControlZoneSelect();
    draw();
    return true;
}

function updateControlZoneSelect() {
    const select = $('controlZoneSelect');
    if (!select) return;

    const map = getCurrentMap();
    const zones = getMapControlZones(map);
    const selected = getSelectedControlZone(map);
    const visible = isMapLayerVisible('controlZones');
    const catalogKey = `${map?.id || ''}:${LANG}`;

    // Keep the native select and its options stable while using arrow keys.
    if (select.dataset.controlZoneCatalog !== catalogKey) {
        const off = document.createElement('option');
        off.value = '';
        off.textContent = tr('controlZoneOff');
        const options = zones.map(zone => {
            const option = document.createElement('option');
            option.value = zone.id;
            option.textContent = `${tr(zone.labelKey)} · ${zone.radiusMeters} m`;
            if (zone.selectionWeight === 0) {
                option.textContent += ` · ${tr('controlZoneInactive')}`;
            }
            return option;
        });
        select.replaceChildren(off, ...options);
        select.dataset.controlZoneCatalog = catalogKey;
    }

    select.disabled = zones.length === 0;
    select.value = selected && visible ? selected.id : '';
    select.title = tr(selected && !visible ? 'controlZoneLayerHidden' : 'controlZoneHint');
    CONTROL_ZONE_STATE.uiKey = `${map?.id || ''}:${visible}`;
}

function initControlZones() {
    const select = $('controlZoneSelect');
    if (!select) return;

    if (!CONTROL_ZONE_STATE.initialized) {
        loadControlZoneSelections();
        select.addEventListener('change', () => selectControlZone(select.value));
        CONTROL_ZONE_STATE.initialized = true;
    }

    updateControlZoneSelect();
}

function drawSelectedControlZone(map, styles) {
    const visible = isMapLayerVisible('controlZones');
    const uiKey = `${map?.id || ''}:${visible}`;
    if (CONTROL_ZONE_STATE.initialized && CONTROL_ZONE_STATE.uiKey !== uiKey) {
        updateControlZoneSelect();
    }

    const zone = getSelectedControlZone(map);
    if (!visible || !zone) return;

    const v = view();
    const center = worldToLocalScreen(zone.x, zone.y);
    const radius = metersToWorldDistance(zone.radiusMeters) * v.scale;
    if (!Number.isFinite(radius) || radius <= 0 ||
        !Number.isFinite(center.x) || !Number.isFinite(center.y)) return;

    const highContrast = document.documentElement.dataset.a11yHighContrast === 'true';
    const outerRadius = radius + (highContrast ? 4 : 3);
    if (center.x + outerRadius < -v.left || center.y + outerRadius < -v.top ||
        center.x - outerRadius > wrap.clientWidth - v.left ||
        center.y - outerRadius > wrap.clientHeight - v.top) return;

    const accent = '#ffffff';
    // A dark backing keeps the white boundary and label readable in both themes.
    const panel = '#151a1d';
    const innerOpacity = highContrast ? 0.18 : CONTROL_ZONE_MATERIAL.innerOpacity;
    const edgeOpacity = innerOpacity + CONTROL_ZONE_MATERIAL.innerGlowStrength * 0.35;
    // Bound the glow in screen pixels so zooming never washes out the map.
    const glowWidth = Math.min(radius * 0.35, Math.max(6, Math.min(24, radius * 0.08)));
    const lineWidth = highContrast ? 3 : Math.max(1.25, Math.min(2,
        radius * 2 * CONTROL_ZONE_MATERIAL.thickness));

    ctx.save();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const fill = ctx.createRadialGradient(
        center.x, center.y, 0,
        center.x, center.y, outerRadius
    );
    fill.addColorStop(0, `rgba(255,255,255,${innerOpacity})`);
    fill.addColorStop((radius - glowWidth) / outerRadius,
        `rgba(255,255,255,${innerOpacity})`);
    fill.addColorStop(radius / outerRadius, `rgba(255,255,255,${edgeOpacity})`);
    fill.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fill;
    ctx.fillRect(center.x - outerRadius, center.y - outerRadius,
        outerRadius * 2, outerRadius * 2);

    // Keep the actual boundary at the configured physical radius. The glow
    // is decorative and does not change the playable zone's geometry.
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = panel;
    ctx.lineWidth = highContrast ? 6 : lineWidth + 2;
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = CONTROL_ZONE_MATERIAL.outerOpacity;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(center.x - 5, center.y);
    ctx.lineTo(center.x + 5, center.y);
    ctx.moveTo(center.x, center.y - 5);
    ctx.lineTo(center.x, center.y + 5);
    ctx.stroke();

    if (radius >= 30) {
        const label = `${tr(zone.labelKey)} · ${zone.radiusMeters} m`;
        const textSize = document.documentElement.dataset.a11yTextSize;
        const fontSize = textSize === 'xl' ? 16 : textSize === 'large' ? 14 : 12;
        ctx.font = `600 ${fontSize}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const width = ctx.measureText(label).width + 14;
        const labelY = center.y - radius + fontSize + 3;
        ctx.fillStyle = panel;
        ctx.fillRect(center.x - width / 2, labelY - fontSize / 2 - 4, width, fontSize + 8);
        ctx.fillStyle = accent;
        ctx.fillText(label, center.x, labelY);
    }

    ctx.restore();
}

;

/* js/map/tools/state.js */
/* =========================
   MAP TOOLS
   ========================= */

const MAP_TOOLS_STORAGE_KEY =
    'wardogs-map-tools';

const MAP_TOOLS_EXPORT_TYPE =
    'wardogs-map-changes';

const MAP_TOOLS_EXPORT_VERSION = 3;

const MAP_TOOLS_IMPORT_LIMITS = {
    drawings: 2000,
    zones: 1000,
    polygons: 1000,
    markers: 5000,
    pointsPerDrawing: 10000
};

const MAP_TOOL_COLORS = [
    { id: 'danger', color: '#d86666', titleKey: 'mapToolColorDanger' },
    { id: 'warning', color: '#d98b5f', titleKey: 'mapToolColorWarning' },
    { id: 'objective', color: '#d7a452', titleKey: 'mapToolColorObjective' },
    { id: 'friendly', color: '#82c596', titleKey: 'mapToolColorFriendly' },
    { id: 'base', color: '#5fa8d3', titleKey: 'mapToolColorBase' },
    { id: 'utility', color: '#67b7b0', titleKey: 'mapToolColorUtility' },
    { id: 'special', color: '#a889c9', titleKey: 'mapToolColorSpecial' },
    { id: 'neutral', color: '#aeb8bf', titleKey: 'mapToolColorNeutral' },
    { id: 'inactive', color: '#59636b', titleKey: 'mapToolColorInactive' }
];

const MAP_TOOL_MARKER_COLORS = [
    { id: 'blue', color: '#5fa8d3', titleKey: 'mapToolMarkerColorBlue' },
    { id: 'red', color: '#d86666', titleKey: 'mapToolMarkerColorRed' },
    { id: 'green', color: '#82c596', titleKey: 'mapToolMarkerColorGreen' }
];

function normalizeMapToolMarkerColor(value) {
    const color =
        typeof value === 'string'
            ? value.toLowerCase()
            : '';

    return MAP_TOOL_MARKER_COLORS.some(
        item => item.color === color
    )
        ? color
        : null;
}

const MAP_TOOL_STATE = {
    tool: null,
    pencilColor: '#d7a452',
    selectedMarkerIcon: null,
    selectedMarkerColor: '#5fa8d3',

    rulerStart: null,
    rulerEnd: null,
    rulerDragging: false,

    pencilDragging: false,
    activePath: null,

    zoneStart: null,
    zoneEnd: null,
    zoneDragging: false,

    polygonDraft: null,
    polygonHover: null,

    drawings: [],
    zones: [],
    polygons: [],
    markers: [],

    hoverPathId: null,
    hoverDeletePoint: null,
    hoverShapeType: null,
    hoverShapeId: null,
    hoverMarkerId: null,

    searchPoint: null,

    undoStack: [],
    redoStack: [],

    layers: {
        tiles: true,
        /*
         * Off by default: the contour lines are a separate few-hundred-KB
         * download, only made when somebody actually asks for them.
         */
        contours: false,
        grid: true,
        controlZones: true,
        zones: true,
        polygons: true,
        presetMarkers: true,
        drawings: true,
        userMarkers: true,
        artillery: true,
        cursorCoords: true
    }
};

function mapToolId() {
    return (
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 9)
    );
}

function currentMapToolMapId() {
    return S.map || 'custom';
}

function snapshotMapToolContent() {
    return {
        mapId: currentMapToolMapId(),
        drawings: structuredClone(MAP_TOOL_STATE.drawings),
        zones: structuredClone(MAP_TOOL_STATE.zones),
        polygons: structuredClone(MAP_TOOL_STATE.polygons),
        markers: structuredClone(MAP_TOOL_STATE.markers),
        origin: structuredClone(S.origin),
        target: structuredClone(S.target),
        mode: S.mode
    };
}

function updateMapToolHistoryUI() {
    if (lobby?.active) { lobby.updateHistoryUI(); return; }
    const undoButton =
        $('mapToolUndoButton');

    const redoButton =
        $('mapToolRedoButton');

    if (undoButton) {
        undoButton.disabled =
            MAP_TOOL_STATE.undoStack.length === 0;
    }

    if (redoButton) {
        redoButton.disabled =
            MAP_TOOL_STATE.redoStack.length === 0;
    }
}

function restoreMapToolContent(snapshot) {
    if (!snapshot) {
        return;
    }

    MAP_TOOL_STATE.drawings =
        structuredClone(snapshot.drawings || []);

    MAP_TOOL_STATE.zones =
        structuredClone(snapshot.zones || []);

    MAP_TOOL_STATE.polygons =
        structuredClone(snapshot.polygons || []);

    MAP_TOOL_STATE.markers =
        structuredClone(snapshot.markers || []);

    if (
        snapshot.origin &&
        Number.isFinite(snapshot.origin.x) &&
        Number.isFinite(snapshot.origin.y)
    ) {
        S.origin = structuredClone(snapshot.origin);
        clamp(S.origin);
    }

    if (
        snapshot.target &&
        Number.isFinite(snapshot.target.x) &&
        Number.isFinite(snapshot.target.y)
    ) {
        S.target = structuredClone(snapshot.target);
        clamp(S.target);
    }

    if (
        snapshot.mode === 'origin' ||
        snapshot.mode === 'target'
    ) {
        S.mode = snapshot.mode;
    }

    $('originMode')?.classList.toggle(
        'active',
        S.mode === 'origin'
    );

    $('targetMode')?.classList.toggle(
        'active',
        S.mode === 'target'
    );

    MAP_TOOL_STATE.hoverPathId = null;
    MAP_TOOL_STATE.hoverDeletePoint = null;
    MAP_TOOL_STATE.hoverShapeType = null;
    MAP_TOOL_STATE.hoverShapeId = null;
    MAP_TOOL_STATE.hoverMarkerId = null;

    saveMapToolState();
    inputs();
    renderSavedTargets();
    updateMapToolHistoryUI();
}

function pushMapToolHistory() {
    if (lobby?.active) return;
    MAP_TOOL_STATE.undoStack.push(
        snapshotMapToolContent()
    );

    if (
        MAP_TOOL_STATE.undoStack.length > 100
    ) {
        MAP_TOOL_STATE.undoStack.shift();
    }

    MAP_TOOL_STATE.redoStack = [];
    updateMapToolHistoryUI();
}

function resetMapToolHistory() {
    MAP_TOOL_STATE.undoStack = [];
    MAP_TOOL_STATE.redoStack = [];
    updateMapToolHistoryUI();
}

function undoMapToolAction() {
    if (lobby?.active) return lobby.undo();
    if (!MAP_TOOL_STATE.undoStack.length) {
        return false;
    }

    MAP_TOOL_STATE.redoStack.push(
        snapshotMapToolContent()
    );

    restoreMapToolContent(
        MAP_TOOL_STATE.undoStack.pop()
    );

    return true;
}

function redoMapToolAction() {
    if (lobby?.active) return lobby.redo();
    if (!MAP_TOOL_STATE.redoStack.length) {
        return false;
    }

    MAP_TOOL_STATE.undoStack.push(
        snapshotMapToolContent()
    );

    restoreMapToolContent(
        MAP_TOOL_STATE.redoStack.pop()
    );

    return true;
}

function matchesConfiguredCombo(event, combo) {
    if (!combo) return false;
    const parts = String(combo).toLowerCase().split('+').map(part => part.trim());
    const key = parts.pop();
    return getKeyboardShortcutKey(event) === key &&
        event.ctrlKey === parts.includes('ctrl') &&
        event.metaKey === parts.includes('meta') &&
        event.altKey === parts.includes('alt') &&
        event.shiftKey === parts.includes('shift');
}

function saveMapToolState(state = MAP_TOOL_STATE) {
    if (lobby?.active) { lobby.capture(); return true; }
    try {
        localStorage.setItem(
            MAP_TOOLS_STORAGE_KEY,
            JSON.stringify({
                drawings: state.drawings,
                zones: state.zones,
                polygons: state.polygons,
                markers: state.markers,
                layers: state.layers
            })
        );
        return true;
    } catch (error) {
        console.warn(
            'Failed to save map tools state:',
            error
        );
        return false;
    }
}

function loadMapToolState() {
    try {
        const raw =
            localStorage.getItem(
                MAP_TOOLS_STORAGE_KEY
            );

        if (!raw) {
            return;
        }

        const parsed = normalizeImportedMapToolPayload(
            JSON.parse(raw)
        );

        MAP_TOOL_STATE.drawings = parsed.drawings;
        MAP_TOOL_STATE.zones = parsed.zones;
        MAP_TOOL_STATE.polygons = parsed.polygons;
        MAP_TOOL_STATE.markers = parsed.markers;

        if (parsed.layers) {
            MAP_TOOL_STATE.layers = {
                ...MAP_TOOL_STATE.layers,
                ...parsed.layers
            };
        }

    } catch (error) {
        console.warn(
            'Failed to load map tools state:',
            error
        );

        MAP_TOOL_STATE.drawings = [];
        MAP_TOOL_STATE.zones = [];
        MAP_TOOL_STATE.polygons = [];
        MAP_TOOL_STATE.markers = [];
    }
}

function setMapDataTransferStatus(
    key = null,
    isError = false
) {
    const status = $('mapDataTransferStatus');

    if (!status) {
        return;
    }

    status.textContent = key ? tr(key) : '';
    status.classList.toggle('error', Boolean(isError));
}

function createMapToolExportPayload() {
    return {
        type: MAP_TOOLS_EXPORT_TYPE,
        version: MAP_TOOLS_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        data: {
            drawings: structuredClone(MAP_TOOL_STATE.drawings),
            zones: structuredClone(MAP_TOOL_STATE.zones),
            polygons: structuredClone(MAP_TOOL_STATE.polygons),
            markers: structuredClone(MAP_TOOL_STATE.markers),
            layers: structuredClone(MAP_TOOL_STATE.layers)
        }
    };
}

function exportMapToolChanges() {
    downloadWardogsJson(
        `wardogs-map-changes-${wardogsExportTimestamp()}.json`,
        createMapToolExportPayload()
    );

    setMapDataTransferStatus();

    if (typeof trackAnalytics === 'function') {
        trackAnalytics('map-changes-exported', {
            drawings: MAP_TOOL_STATE.drawings.length,
            zones: MAP_TOOL_STATE.zones.length,
            polygons: MAP_TOOL_STATE.polygons.length,
            markers: MAP_TOOL_STATE.markers.length
        });
    }
}

function importedMapId(value) {
    if (typeof value !== 'string' || !value.trim()) {
        return currentMapToolMapId();
    }

    return value.trim().slice(0, 64);
}

function normalizeImportedMapToolDrawing(drawing) {
    if (!drawing || typeof drawing !== 'object' || !Array.isArray(drawing.points)) {
        return null;
    }

    const points = drawing.points
        .slice(0, MAP_TOOLS_IMPORT_LIMITS.pointsPerDrawing)
        .filter(point =>
            point &&
            Number.isFinite(Number(point.x)) &&
            Number.isFinite(Number(point.y))
        )
        .map(point => ({
            x: Number(point.x),
            y: Number(point.y)
        }));

    if (points.length < 2) {
        return null;
    }

    const color =
        typeof drawing.color === 'string' &&
        /^#[0-9a-f]{6}$/i.test(drawing.color)
            ? drawing.color
            : '#d7a452';

    return {
        id: mapToolId(),
        mapId: importedMapId(drawing.mapId),
        color,
        points
    };
}

function normalizeImportedMapToolZone(zone) {
    if (
        !zone ||
        typeof zone !== 'object' ||
        !Number.isFinite(Number(zone.x)) ||
        !Number.isFinite(Number(zone.y)) ||
        !Number.isFinite(Number(zone.radius)) ||
        Number(zone.radius) <= 0
    ) {
        return null;
    }

    const color =
        typeof zone.color === 'string' &&
        /^#[0-9a-f]{6}$/i.test(zone.color)
            ? zone.color
            : '#d7a452';

    return {
        id: mapToolId(),
        mapId: importedMapId(zone.mapId),
        color,
        x: Number(zone.x),
        y: Number(zone.y),
        radius: Number(zone.radius)
    };
}

function normalizeImportedMapToolPolygon(polygon) {
    if (
        !polygon ||
        typeof polygon !== 'object' ||
        !Array.isArray(polygon.points)
    ) {
        return null;
    }

    const points = polygon.points
        .slice(0, MAP_TOOLS_IMPORT_LIMITS.pointsPerDrawing)
        .filter(point =>
            point &&
            Number.isFinite(Number(point.x)) &&
            Number.isFinite(Number(point.y))
        )
        .map(point => ({
            x: Number(point.x),
            y: Number(point.y)
        }));

    if (points.length < 3) {
        return null;
    }

    const color =
        typeof polygon.color === 'string' &&
        /^#[0-9a-f]{6}$/i.test(polygon.color)
            ? polygon.color
            : '#d7a452';

    return {
        id: mapToolId(),
        mapId: importedMapId(polygon.mapId),
        color,
        points
    };
}

function normalizeImportedMapToolMarker(marker) {
    if (
        !marker ||
        typeof marker !== 'object' ||
        typeof marker.icon !== 'string' ||
        !Number.isFinite(Number(marker.x)) ||
        !Number.isFinite(Number(marker.y))
    ) {
        return null;
    }

    const asset = getMarkerAsset(marker.icon);

    if (!asset || !asset.placeable) {
        return null;
    }

    const color =
        asset.colorable
            ? normalizeMapToolMarkerColor(
                marker.color
            )
            : null;

    return {
        id: mapToolId(),
        mapId: importedMapId(marker.mapId),
        icon: marker.icon,
        x: Number(marker.x),
        y: Number(marker.y),
        ...(color ? { color } : {})
    };
}

function normalizeImportedMapLayers(layers) {
    if (!layers || typeof layers !== 'object') {
        return null;
    }

    const normalized = {};

    Object.keys(MAP_TOOL_STATE.layers).forEach(key => {
        if (typeof layers[key] === 'boolean') {
            normalized[key] = layers[key];
        }
    });

    return Object.keys(normalized).length ? normalized : null;
}

function normalizeImportedMapToolPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid map changes payload');
    }

    const source =
        payload.type === MAP_TOOLS_EXPORT_TYPE
            ? payload.data
            : payload.data && typeof payload.data === 'object'
                ? payload.data
                : payload;

    if (!source || typeof source !== 'object') {
        throw new Error('Invalid map changes payload');
    }

    const drawings = Array.isArray(source.drawings)
        ? source.drawings
            .slice(0, MAP_TOOLS_IMPORT_LIMITS.drawings)
            .map(normalizeImportedMapToolDrawing)
            .filter(Boolean)
        : [];

    const zones = Array.isArray(source.zones)
        ? source.zones
            .slice(0, MAP_TOOLS_IMPORT_LIMITS.zones)
            .map(normalizeImportedMapToolZone)
            .filter(Boolean)
        : [];

    const polygons = Array.isArray(source.polygons)
        ? source.polygons
            .slice(0, MAP_TOOLS_IMPORT_LIMITS.polygons)
            .map(normalizeImportedMapToolPolygon)
            .filter(Boolean)
        : [];

    const markers = Array.isArray(source.markers)
        ? source.markers
            .slice(0, MAP_TOOLS_IMPORT_LIMITS.markers)
            .map(normalizeImportedMapToolMarker)
            .filter(Boolean)
        : [];

    const layers = normalizeImportedMapLayers(source.layers);

    if (
        !drawings.length &&
        !zones.length &&
        !polygons.length &&
        !markers.length &&
        !layers
    ) {
        throw new Error('No supported map changes found');
    }

    return {
        drawings,
        zones,
        polygons,
        markers,
        layers
    };
}

function applyImportedMapToolChanges(imported) {
    const next = {
        drawings: [
            ...MAP_TOOL_STATE.drawings,
            ...imported.drawings
        ],
        zones: [
            ...MAP_TOOL_STATE.zones,
            ...imported.zones
        ],
        polygons: [
            ...MAP_TOOL_STATE.polygons,
            ...imported.polygons
        ],
        markers: [
            ...MAP_TOOL_STATE.markers,
            ...imported.markers
        ],
        layers: imported.layers
            ? {
                ...MAP_TOOL_STATE.layers,
                ...imported.layers
            }
            : MAP_TOOL_STATE.layers
    };

    for (const name of ['drawings', 'zones', 'polygons', 'markers']) {
        if (next[name].length > MAP_TOOLS_IMPORT_LIMITS[name]) {
            throw new Error(`Map tool ${name} limit exceeded`);
        }
    }

    const collaborative = lobby?.active === true;

    if (!collaborative && !saveMapToolState(next)) {
        throw new Error('Map changes could not be persisted');
    }

    if (
        imported.drawings.length ||
        imported.zones.length ||
        imported.polygons.length ||
        imported.markers.length
    ) {
        pushMapToolHistory();
    }

    MAP_TOOL_STATE.drawings = next.drawings;
    MAP_TOOL_STATE.zones = next.zones;
    MAP_TOOL_STATE.polygons = next.polygons;
    MAP_TOOL_STATE.markers = next.markers;
    MAP_TOOL_STATE.layers = next.layers;

    if (collaborative) {
        lobby.capture();
    }

    MAP_TOOL_STATE.hoverPathId = null;
    MAP_TOOL_STATE.hoverDeletePoint = null;
    MAP_TOOL_STATE.hoverShapeType = null;
    MAP_TOOL_STATE.hoverShapeId = null;
    MAP_TOOL_STATE.hoverMarkerId = null;

    buildMapLayers();
    updateMapToolsUI();
    draw();
}

async function importMapToolChanges() {
    try {
        const file = await selectWardogsJsonFile();

        if (!file) {
            return;
        }

        const payload = await readWardogsJsonFile(file);
        const imported = normalizeImportedMapToolPayload(payload);

        applyImportedMapToolChanges(imported);
        setMapDataTransferStatus('mapToolImportSuccess');

        if (typeof trackAnalytics === 'function') {
            trackAnalytics('map-changes-imported', {
                drawings: imported.drawings.length,
                zones: imported.zones.length,
                polygons: imported.polygons.length,
                markers: imported.markers.length,
                layers: Boolean(imported.layers)
            });
        }
    } catch (error) {
        console.warn('Failed to import map changes:', error);
        setMapDataTransferStatus('mapToolImportInvalid', true);
    }
}

function clearCurrentMapToolContent() {
    const mapId =
        currentMapToolMapId();

    const collections = [
        'drawings',
        'zones',
        'polygons',
        'markers'
    ];

    const hasContent =
        collections.some(
            name =>
                MAP_TOOL_STATE[name].some(
                    item =>
                        item.mapId === mapId
                )
        );

    if (!hasContent) {
        return false;
    }

    pushMapToolHistory();

    collections.forEach(name => {
        MAP_TOOL_STATE[name] =
            MAP_TOOL_STATE[name].filter(
                item =>
                    item.mapId !== mapId
            );
    });

    MAP_TOOL_STATE.hoverPathId = null;
    MAP_TOOL_STATE.hoverDeletePoint = null;
    MAP_TOOL_STATE.hoverShapeType = null;
    MAP_TOOL_STATE.hoverShapeId = null;
    MAP_TOOL_STATE.hoverMarkerId = null;

    saveMapToolState();
    updateMapToolsUI();
    draw();

    return true;
}

;

/* js/map/tools/controls.js */
/* =========================
   MAP TOOL CONTROLS
   ========================= */

function setMapTool(tool) {
    const previousTool =
        MAP_TOOL_STATE.tool;

    const nextTool =
        MAP_TOOL_STATE.tool === tool
            ? null
            : tool;

    MAP_TOOL_STATE.tool =
        nextTool;

    if (
        previousTool === 'fireAdjust' &&
        nextTool !== 'fireAdjust' &&
        typeof setFireAdjustmentPick ===
            'function'
    ) {
        setFireAdjustmentPick(false);
    }

    MAP_TOOL_STATE.rulerStart = null;
    MAP_TOOL_STATE.rulerEnd = null;
    MAP_TOOL_STATE.rulerDragging = false;
    MAP_TOOL_STATE.pencilDragging = false;
    MAP_TOOL_STATE.activePath = null;
    MAP_TOOL_STATE.zoneStart = null;
    MAP_TOOL_STATE.zoneEnd = null;
    MAP_TOOL_STATE.zoneDragging = false;
    MAP_TOOL_STATE.polygonDraft = null;
    MAP_TOOL_STATE.polygonHover = null;
    MAP_TOOL_STATE.hoverPathId = null;
    MAP_TOOL_STATE.hoverDeletePoint = null;
    MAP_TOOL_STATE.hoverShapeType = null;
    MAP_TOOL_STATE.hoverShapeId = null;
    MAP_TOOL_STATE.hoverMarkerId = null;

    if (MAP_TOOL_STATE.tool === 'zone') {
        MAP_TOOL_STATE.layers.zones = true;
        saveMapToolState();
    }

    if (MAP_TOOL_STATE.tool === 'polygon') {
        MAP_TOOL_STATE.layers.polygons = true;
        saveMapToolState();
    }

    updateMapToolsUI();
    draw();
}

function selectMapTool(tool) {
    if (MAP_TOOL_STATE.tool === tool) {
        return;
    }

    setMapTool(tool);
}

function activateColorMapTool(tool) {
    const changed =
        MAP_TOOL_STATE.tool !== tool;

    if (changed) {
        setMapTool(tool);
        closeMapToolMenus(
            'pencilPalette'
        );
        $('pencilPalette')
            ?.classList.add('open');
        updateMapToolsUI();
        return;
    }

    toggleMapToolMenu(
        'pencilPalette'
    );
}

function ensureEraserPopover() {
    const bar =
        document.querySelector(
            '.map-tools-bar'
        );

    if (!bar) {
        return null;
    }

    let popover =
        $('eraserPopover');

    if (!popover) {
        popover =
            document.createElement(
                'div'
            );

        popover.id =
            'eraserPopover';

        /*
         * Reuse the coordinate-search popover shell and primary action styles
         * so the eraser menu follows the same layout, responsive sizing and
         * accessibility behavior as the existing Map Tools windows.
         */
        popover.className =
            'map-tool-popover map-tool-coordinate-search';

        bar.before(popover);
    }

    return popover;
}

function buildEraserPopover() {
    const container =
        ensureEraserPopover();

    if (!container) {
        return;
    }

    container.innerHTML = '';

    const title =
        document.createElement(
            'div'
        );

    title.className =
        'map-tool-popover-title';

    title.textContent =
        tr('mapToolEraser');

    const clearButton =
        document.createElement(
            'button'
        );

    clearButton.type = 'button';
    clearButton.className =
        'map-tool-search-go';

    const clearLabel =
        tr('mapToolEraseAll');

    clearButton.textContent =
        clearLabel;

    clearButton.setAttribute(
        'aria-label',
        clearLabel
    );

    clearButton.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            clearCurrentMapToolContent();
        }
    );

    container.append(
        title,
        clearButton
    );
}

function activateEraserTool() {
    buildEraserPopover();

    const changed =
        MAP_TOOL_STATE.tool !==
        'eraser';

    if (changed) {
        setMapTool('eraser');
        closeMapToolMenus(
            'eraserPopover'
        );
        $('eraserPopover')
            ?.classList.add('open');
        updateMapToolsUI();
        return;
    }

    toggleMapToolMenu(
        'eraserPopover'
    );
}

function activateMarkerPicker() {
    /*
     * Browsing marker icons must not leave another map interaction armed
     * underneath the picker. An already-selected marker remains active so
     * reopening the picker only changes its icon or color.
     */
    if (
        MAP_TOOL_STATE.tool !==
        'marker'
    ) {
        setMapTool(null);
    }

    toggleMapToolMenu(
        'markerPicker'
    );
}

function closeMapToolMenus(
    except = null,
    {
        preserveFireAdjustment = false
    } = {}
) {
    let closedFireAdjustment =
        false;

    ['pencilPalette', 'eraserPopover', 'markerPicker', 'coordinateSearchPopover', 'mapLayersPopover', 'mapDataTransferPopover', 'fireAdjustmentPopover'].forEach(
        id => {
            if (id === except) {
                return;
            }

            const element = $(id);

            if (element) {
                if (
                    id === 'fireAdjustmentPopover' &&
                    element.classList.contains('open')
                ) {
                    closedFireAdjustment = true;
                }

                element.classList.remove('open');
            }
        }
    );

    if (
        closedFireAdjustment &&
        !preserveFireAdjustment
    ) {
        if (
            typeof setFireAdjustmentPick ===
                'function'
        ) {
            setFireAdjustmentPick(false);
        }

        if (
            MAP_TOOL_STATE.tool ===
            'fireAdjust'
        ) {
            MAP_TOOL_STATE.tool = null;
        }
    }

    /*
     * Keep toolbar highlight state synchronized
     * when menus are closed by outside clicks,
     * Escape or another tool.
     */
    if (
        typeof updateMapToolsUI ===
        'function'
    ) {
        updateMapToolsUI();
    }
}

function toggleMapToolMenu(id) {
    const element = $(id);

    if (!element) {
        return;
    }

    const shouldOpen =
        !element.classList.contains('open');

    closeMapToolMenus(
        shouldOpen ? id : null
    );

    element.classList.toggle(
        'open',
        shouldOpen
    );

    updateMapToolsUI();
}

function isMapToolMenuOpen(id) {

    return Boolean(
        $(id)?.classList.contains(
            'open'
        )
    );
}

function setMobileMapToolsOpen(open) {
    const tools = $('mapTools');
    const toggle = $('mobileMapToolsToggle');

    if (!tools || !toggle) {
        return;
    }

    const expanded = Boolean(open);

    tools.classList.toggle(
        'mobile-map-tools-open',
        expanded
    );

    toggle.classList.toggle(
        'active',
        expanded
    );

    toggle.setAttribute(
        'aria-expanded',
        expanded ? 'true' : 'false'
    );

    if (!expanded) {
        closeMapToolMenus();
    }
}

function toggleMobileMapTools() {
    const tools = $('mapTools');

    if (!tools) {
        return;
    }

    setMobileMapToolsOpen(
        !tools.classList.contains(
            'mobile-map-tools-open'
        )
    );
}

function updateMapToolsUI() {
    document
        .querySelectorAll('.map-tool-button[data-tool]')
        .forEach(button => {

            const tool =
                button.dataset.tool;

            let active =
                tool ===
                MAP_TOOL_STATE.tool;

            /*
             * Menu-only tools should only look active
             * while their popover is actually open.
             * Their internal tool state can remain set
             * without leaving a permanently highlighted
             * toolbar icon.
             */
            if (tool === 'marker') {
                active =
                    isMapToolMenuOpen(
                        'markerPicker'
                    );
            }

            if (
                tool ===
                'coordinateSearch'
            ) {
                active =
                    isMapToolMenuOpen(
                        'coordinateSearchPopover'
                    );
            }

            if (tool === 'layers') {
                active =
                    isMapToolMenuOpen(
                        'mapLayersPopover'
                    );
            }

            if (tool === 'dataTransfer') {
                active =
                    isMapToolMenuOpen(
                        'mapDataTransferPopover'
                    );
            }

            if (tool === 'fireAdjust') {
                active =
                    isMapToolMenuOpen(
                        'fireAdjustmentPopover'
                    );
            }

            button.classList.toggle(
                'active',
                active
            );
        });

    document
        .querySelectorAll('.map-tool-palette .map-tool-color')
        .forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.color ===
                MAP_TOOL_STATE.pencilColor
            );
        });

    document
        .querySelectorAll('.map-tool-marker-color')
        .forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.color ===
                MAP_TOOL_STATE.selectedMarkerColor
            );
        });

    document
        .querySelectorAll('.map-tool-marker-option')
        .forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.icon ===
                MAP_TOOL_STATE.selectedMarkerIcon
            );
        });

    const interactionHint =
        $('mapToolInteractionHint');

    const interactionHintKey =
        MAP_TOOL_STATE.tool === 'zone'
            ? 'mapToolZoneHint'
            : MAP_TOOL_STATE.tool === 'polygon'
                ? 'mapToolPolygonHint'
                : null;

    if (interactionHint) {
        interactionHint.hidden =
            !interactionHintKey;

        interactionHint.textContent =
            interactionHintKey
                ? tr(interactionHintKey)
                : '';
    }

    if (c) {
        c.classList.toggle(
            'map-tool-active',
            [
                'ruler',
                'pencil',
                'zone',
                'polygon',
                'eraser',
                'marker'
            ].includes(MAP_TOOL_STATE.tool)
        );

        c.classList.toggle(
            'map-tool-pencil-active',
            MAP_TOOL_STATE.tool === 'pencil'
        );

        c.classList.toggle(
            'map-tool-eraser-active',
            MAP_TOOL_STATE.tool === 'eraser'
        );
    }
}

function buildPencilPalette() {
    const container =
        $('pencilPalette');

    if (!container) {
        return;
    }

    container.innerHTML = '';

    MAP_TOOL_COLORS.forEach(item => {
        const button =
            document.createElement('button');

        button.type = 'button';
        button.className =
            'map-tool-color';
        button.dataset.color =
            item.color;
        const title =
            tr(item.titleKey);

        button.title =
            title;
        button.setAttribute(
            'aria-label',
            title
        );
        button.style.setProperty(
            '--tool-color',
            item.color
        );

        button.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                MAP_TOOL_STATE.pencilColor =
                    item.color;

                if (
                    ![
                        'pencil',
                        'zone',
                        'polygon'
                    ].includes(
                        MAP_TOOL_STATE.tool
                    )
                ) {
                    selectMapTool(
                        'pencil'
                    );
                }

                updateMapToolsUI();
            }
        );

        container.appendChild(button);
    });
}

function buildMarkerPicker() {
    const container =
        $('markerPicker');

    if (!container) {
        return;
    }

    container.innerHTML = '';

    const colorSection =
        document.createElement('div');

    colorSection.className =
        'map-tool-marker-colors';

    colorSection.setAttribute(
        'role',
        'group'
    );

    colorSection.setAttribute(
        'aria-label',
        tr('mapToolMarkerColor')
    );

    const colorTitle =
        document.createElement('span');

    colorTitle.className =
        'map-tool-marker-color-title';

    colorTitle.textContent =
        tr('mapToolMarkerColor');

    colorSection.appendChild(
        colorTitle
    );

    MAP_TOOL_MARKER_COLORS.forEach(
        item => {
            const button =
                document.createElement('button');

            const title =
                tr(item.titleKey);

            button.type = 'button';
            button.className =
                'map-tool-marker-color';
            button.dataset.color =
                item.color;
            button.title = title;
            button.setAttribute(
                'aria-label',
                title
            );
            button.style.setProperty(
                '--tool-color',
                item.color
            );

            button.addEventListener(
                'click',
                event => {
                    event.stopPropagation();

                    MAP_TOOL_STATE.selectedMarkerColor =
                        item.color;

                    updateMapToolsUI();
                }
            );

            colorSection.appendChild(
                button
            );
        }
    );

    container.appendChild(
        colorSection
    );

    const assets =
        Object.values(MAP_ASSETS)
            .filter(
                asset =>
                    asset.placeable
            );

    if (!assets.length) {
        const empty =
            document.createElement('div');

        empty.className =
            'map-tool-picker-empty';
        empty.textContent =
            tr('mapToolNoMarkerAssets');

        container.appendChild(empty);
        return;
    }

    assets.forEach(asset => {
        const button =
            document.createElement('button');

        button.type = 'button';
        button.className =
            'map-tool-marker-option';
        const label =
            getMarkerAssetLabel(asset);

        button.dataset.icon =
            asset.id;

        button.dataset.colorable =
            asset.colorable
                ? 'true'
                : 'false';
        button.title =
            label;
        button.setAttribute(
            'aria-label',
            label
        );

        const image =
            document.createElement('img');

        image.src =
            resourceURL(asset.path);
        image.alt = '';
        image.draggable = false;

        const fallback =
            document.createElement('span');

        fallback.className =
            'map-tool-marker-fallback';
        fallback.textContent =
            asset.id.slice(0, 2).toUpperCase();

        image.addEventListener(
            'error',
            () => {
                image.style.display = 'none';
                fallback.style.display = 'grid';
            }
        );

        button.appendChild(image);
        button.appendChild(fallback);

        button.addEventListener(
            'click',
            event => {
                event.stopPropagation();

                MAP_TOOL_STATE.selectedMarkerIcon =
                    asset.id;
                selectMapTool(
                    'marker'
                );

                updateMapToolsUI();
                closeMapToolMenus();
            }
        );

        container.appendChild(button);
    });
}

function formatShortcut(action) {
    const shortcut = getMapToolShortcut(action);

    if (!shortcut) {
        return '';
    }

    if (shortcut === 'escape') {
        return 'Esc';
    }

    return shortcut.length === 1
        ? shortcut.toUpperCase()
        : shortcut;
}

function setToolButtonLabel(button, key, shortcutAction = null) {
    if (!button) {
        return;
    }

    const label = tr(key);
    const shortcut = shortcutAction
        ? formatShortcut(shortcutAction)
        : '';
    const fullLabel = shortcut
        ? `${label} (${shortcut})`
        : label;

    button.title = fullLabel;
    button.setAttribute('aria-label', fullLabel);
}

function isMapLayerVisible(layer) {
    return MAP_TOOL_STATE.layers[layer] !== false;
}

function setMapLayerVisible(layer, visible) {
    if (!(layer in MAP_TOOL_STATE.layers)) {
        return;
    }

    MAP_TOOL_STATE.layers[layer] = Boolean(visible);
    saveMapToolState();

    /*
     * Start the download the moment the layer is asked for rather than
     * waiting for the redraw, so the lines appear as soon as they can.
     */
    if (
        layer === 'contours' &&
        visible &&
        typeof ensureContoursLoaded === 'function'
    ) {
        ensureContoursLoaded(currentMapToolMapId());
    }

    if (
        layer === 'cursorCoords' &&
        !MAP_TOOL_STATE.layers.cursorCoords
    ) {
        const cursor = $('cursorCoords');

        if (cursor) {
            cursor.style.display = 'none';
        }
    }

    draw();
}


function setMapLayerGroupVisible(layerIds, visible) {
    const nextVisible = Boolean(visible);

    layerIds.forEach(layer => {
        if (layer in MAP_TOOL_STATE.layers) {
            MAP_TOOL_STATE.layers[layer] =
                nextVisible;
        }
    });

    saveMapToolState();

    if (
        nextVisible &&
        layerIds.includes('contours') &&
        typeof ensureContoursLoaded === 'function'
    ) {
        ensureContoursLoaded(
            currentMapToolMapId()
        );
    }

    if (
        !nextVisible &&
        layerIds.includes('cursorCoords')
    ) {
        const cursor = $('cursorCoords');

        if (cursor) {
            cursor.style.display = 'none';
        }
    }

    draw();
}

function buildMapLayers() {
    const container = $('mapLayersPopover');

    if (!container) {
        return;
    }

    const contourLayer = (
        typeof mapHasContours === 'function' &&
        mapHasContours(
            currentMapToolMapId()
        )
    )
        ? [['contours', 'mapLayerContours']]
        : [];

    const groups = [
        {
            id: 'base',
            titleKey: 'map',
            items: [
                ['tiles', 'mapLayerMap'],
                ...contourLayer,
                ['grid', 'mapLayerGrid']
            ]
        },
        {
            id: 'tactical',
            titleKey: 'mapToolMarkers',
            items: [
                ['controlZones', 'controlZone'],
                ['zones', 'mapLayerZones'],
                ['polygons', 'mapLayerPolygons'],
                ['presetMarkers', 'mapLayerPresetMarkers'],
                ['artillery', 'mapLayerArtillery']
            ]
        },
        {
            id: 'personal',
            titleKey: 'mapToolsToggle',
            items: [
                ['drawings', 'mapLayerDrawings'],
                ['userMarkers', 'mapLayerUserMarkers'],
                ['cursorCoords', 'mapLayerCursorCoordinates']
            ]
        }
    ];

    const icons = {
        tiles: `
            <path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/>
        `,
        contours: `
            <path d="M3 7c3-2 5 2 8 0s5-2 10 0"/>
            <path d="M3 12c3-2 5 2 8 0s5-2 10 0"/>
            <path d="M3 17c3-2 5 2 8 0s5-2 10 0"/>
        `,
        grid: `
            <path d="M4 4h16v16H4z"/>
            <path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>
        `,
        controlZones: `
            <circle cx="12" cy="12" r="9"/>
            <path d="M9 18V6h7l-2 3 2 3H9"/>
        `,
        zones: `
            <circle cx="12" cy="12" r="7"/>
            <path d="M12 5v14M5 12h14"/>
        `,
        polygons: `
            <path d="m5 17 2-10 9-3 4 8-5 8Z"/>
        `,
        presetMarkers: `
            <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/>
            <circle cx="12" cy="10" r="2"/>
        `,
        drawings: `
            <path d="M4 18.5 5.5 14 15 4.5l4.5 4.5-9.5 9.5Z"/>
            <path d="m13.5 6 4.5 4.5"/>
        `,
        userMarkers: `
            <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/>
            <path d="m12 7 .9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3Z"/>
        `,
        artillery: `
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        `,
        cursorCoords: `
            <path d="m5 3 13 9-6 1.5L9.5 19Z"/>
        `
    };

    const createLayerIcon = id => {
        const icon =
            document.createElement('span');

        icon.className =
            'map-layer-icon';

        icon.setAttribute(
            'aria-hidden',
            'true'
        );

        icon.innerHTML = `
            <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                ${icons[id] || ''}
            </svg>
        `;

        return icon;
    };

    container.innerHTML = '';

    const title =
        document.createElement('div');

    title.className =
        'map-tool-popover-title';

    title.textContent =
        tr('mapToolLayers');

    container.appendChild(title);

    groups.forEach(group => {
        const section =
            document.createElement('section');

        section.className =
            'map-layer-group';

        section.dataset.layerGroup =
            group.id;

        const groupToggle =
            document.createElement('label');

        groupToggle.className =
            'map-layer-group-toggle';

        const groupTitle =
            document.createElement('span');

        groupTitle.className =
            'map-layer-group-title';

        groupTitle.textContent =
            tr(group.titleKey);

        const groupCheckbox =
            document.createElement('input');

        groupCheckbox.type =
            'checkbox';

        const visibility =
            group.items.map(
                ([id]) =>
                    isMapLayerVisible(id)
            );

        const allVisible =
            visibility.every(Boolean);

        const anyVisible =
            visibility.some(Boolean);

        groupCheckbox.checked =
            allVisible;

        groupCheckbox.indeterminate =
            anyVisible &&
            !allVisible;

        groupCheckbox.addEventListener(
            'change',
            event => {
                event.stopPropagation();

                setMapLayerGroupVisible(
                    group.items.map(
                        ([id]) => id
                    ),
                    groupCheckbox.checked
                );

                buildMapLayers();
            }
        );

        groupToggle.append(
            groupTitle,
            groupCheckbox
        );

        section.appendChild(
            groupToggle
        );

        const items =
            document.createElement('div');

        items.className =
            'map-layer-group-items';

        group.items.forEach(
            ([id, key]) => {
                const label =
                    document.createElement('label');

                label.className =
                    'map-layer-toggle';

                const icon =
                    createLayerIcon(id);

                const text =
                    document.createElement('span');

                text.className =
                    'map-layer-label';

                text.textContent =
                    tr(key);

                const checkbox =
                    document.createElement('input');

                checkbox.type =
                    'checkbox';

                checkbox.checked =
                    isMapLayerVisible(id);

                checkbox.addEventListener(
                    'change',
                    () => {
                        setMapLayerVisible(
                            id,
                            checkbox.checked
                        );

                        buildMapLayers();
                    }
                );

                label.append(
                    icon,
                    text,
                    checkbox
                );

                items.appendChild(label);
            }
        );

        section.appendChild(items);
        container.appendChild(section);
    });

    updateMapToolHistoryUI();
}

function buildMapDataTransfer() {
    const container = $('mapDataTransferPopover');

    if (!container) {
        return;
    }

    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'map-tool-popover-title';
    title.textContent = tr('mapToolDataTransfer');

    const hint = document.createElement('div');
    hint.className = 'map-tool-data-transfer-hint';
    hint.textContent = tr('mapToolDataTransferHint');

    const actions = document.createElement('div');
    actions.className = 'map-tool-data-transfer-actions';

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.textContent = tr('mapToolExportChanges');
    exportButton.addEventListener('click', event => {
        event.stopPropagation();
        exportMapToolChanges();
    });

    const importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.textContent = tr('mapToolImportChanges');
    importButton.addEventListener('click', async event => {
        event.stopPropagation();
        await importMapToolChanges();
    });

    actions.append(exportButton, importButton);

    const status = document.createElement('div');
    status.id = 'mapDataTransferStatus';
    status.className = 'map-tool-data-transfer-status';

    container.append(title, hint, actions, status);
}

function centerMapOnWorldPoint(point) {
    if (!isWorldPointInsideMap(point)) {
        return false;
    }

    const rect = c.getBoundingClientRect();
    const current = toScreen(point.x, point.y);

    S.panX += rect.width / 2 - current.x;
    S.panY += rect.height / 2 - current.y;

    MAP_TOOL_STATE.searchPoint = {
        x: point.x,
        y: point.y
    };

    draw();
    return true;
}

function submitCoordinateSearch() {
    const xInput = $('coordinateSearchX');
    const yInput = $('coordinateSearchY');
    const error = $('coordinateSearchError');

    const xMeters = Number(xInput?.value);
    const yMeters = Number(yInput?.value);

    if (!Number.isFinite(xMeters) || !Number.isFinite(yMeters)) {
        if (error) error.textContent = tr('mapToolSearchInvalid');
        return;
    }

    const point =
        getCoordinateMetersPerUnit() === 100
            ? {
                x: xMeters,
                y: yMeters
            }
            : {
                x: xMeters / 1000,
                y: yMeters / 1000
            };

    if (!centerMapOnWorldPoint(point)) {
        if (error) error.textContent = tr('mapToolSearchOutOfBounds');
        return;
    }

    if (error) error.textContent = '';

    if (
        typeof trackAnalytics ===
        'function'
    ) {
        trackAnalytics(
            'coordinate-search',
            {
                map: S.map
            }
        );
    }

    closeMapToolMenus();
}

function updateCoordinateSearchDefaults() {
    const xInput = $('coordinateSearchX');
    const yInput = $('coordinateSearchY');

    if (!xInput || !yInput) {
        return;
    }

    const bounds = getViewBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    if (!xInput.value) xInput.value = formatGameCoordinate(centerX);
    if (!yInput.value) yInput.value = formatGameCoordinate(centerY);
}

function handleMapToolShortcut(event) {
    const target = event.target;

    if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
    ) {
        return false;
    }

    const key =
        getKeyboardShortcutKey(
            event
        );

    if (
        MAP_TOOL_STATE.tool === 'polygon' &&
        key === 'enter'
    ) {
        return finishPolygonDraft();
    }

    if (
        MAP_TOOL_STATE.tool === 'polygon' &&
        ['backspace', 'delete'].includes(key) &&
        MAP_TOOL_STATE.polygonDraft?.points?.length
    ) {
        MAP_TOOL_STATE.polygonDraft.points.pop();

        if (!MAP_TOOL_STATE.polygonDraft.points.length) {
            MAP_TOOL_STATE.polygonDraft = null;
            MAP_TOOL_STATE.polygonHover = null;
        }

        draw();
        return true;
    }

    const undoShortcut = getMapToolShortcut('undo') || 'ctrl+z';
    const redoShortcut = getMapToolShortcut('redo') || 'ctrl+y';
    const redoAltShortcut = getMapToolShortcut('redoAlt') || 'ctrl+shift+z';

    if (matchesConfiguredCombo(event, undoShortcut)) return undoMapToolAction();
    if (matchesConfiguredCombo(event, redoShortcut) || matchesConfiguredCombo(event, redoAltShortcut)) {
        return redoMapToolAction();
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
        return false;
    }

    const shortcuts = {
        ruler: getMapToolShortcut('ruler'),
        pencil: getMapToolShortcut('pencil'),
        zone: getMapToolShortcut('zone'),
        polygon: getMapToolShortcut('polygon'),
        eraser: getMapToolShortcut('eraser'),
        marker: getMapToolShortcut('marker'),
        coordinateSearch: getMapToolShortcut('coordinateSearch'),
        layers: getMapToolShortcut('layers'),
        fireAdjust: getMapToolShortcut('fireAdjust'),
        clearTool: getMapToolShortcut('clearTool')
    };

    if (key === shortcuts.clearTool) {
        MAP_TOOL_STATE.searchPoint = null;
        closeMapToolMenus();
        setMapTool(null);
        return true;
    }

    if (key === shortcuts.ruler) {
        closeMapToolMenus();
        setMapTool('ruler');
        return true;
    }

    if (key === shortcuts.pencil) {
        activateColorMapTool('pencil');
        return true;
    }

    if (key === shortcuts.zone) {
        activateColorMapTool('zone');
        return true;
    }

    if (key === shortcuts.polygon) {
        activateColorMapTool('polygon');
        return true;
    }

    if (key === shortcuts.eraser) {
        activateEraserTool();
        return true;
    }

    if (key === shortcuts.marker) {
        activateMarkerPicker();
        return true;
    }

    if (key === shortcuts.coordinateSearch) {
        selectMapTool('coordinateSearch');
        updateMapToolsUI();
        updateCoordinateSearchDefaults();
        toggleMapToolMenu('coordinateSearchPopover');
        $('coordinateSearchX')?.focus();
        return true;
    }

    if (key === shortcuts.layers) {
        selectMapTool('layers');
        updateMapToolsUI();
        buildMapLayers();
        toggleMapToolMenu('mapLayersPopover');
        return true;
    }

    if (
        shortcuts.fireAdjust &&
        key === shortcuts.fireAdjust &&
        typeof toggleFireAdjustmentTool === 'function'
    ) {
        toggleFireAdjustmentTool();
        return true;
    }

    return false;
}

function ensureMapShapeTools() {
    const bar =
        document.querySelector(
            '.map-tools-bar'
        );

    if (!bar) {
        return;
    }

    if (!$('mapToolInteractionHint')) {
        const hint =
            document.createElement(
                'div'
            );

        hint.id =
            'mapToolInteractionHint';

        hint.className =
            'map-tool-interaction-hint';

        hint.hidden = true;
        hint.setAttribute(
            'role',
            'status'
        );

        bar.before(hint);
    }

    const definitions = [
        {
            id: 'mapToolZone',
            tool: 'zone',
            icon: `
                <circle cx="12" cy="12" r="7"/>
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <path d="M12 5v3M12 16v3M5 12h3M16 12h3"/>
            `
        },
        {
            id: 'mapToolPolygon',
            tool: 'polygon',
            icon: `
                <path d="m5 17 2-10 9-3 4 8-5 8Z"/>
                <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/>
                <circle cx="16" cy="4" r="1.2" fill="currentColor" stroke="none"/>
                <circle cx="20" cy="12" r="1.2" fill="currentColor" stroke="none"/>
                <circle cx="15" cy="20" r="1.2" fill="currentColor" stroke="none"/>
                <circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none"/>
            `
        }
    ];

    const insertBefore =
        $('mapToolEraser') ||
        $('mapToolMarker') ||
        null;

    definitions.forEach(definition => {
        if ($(definition.id)) {
            return;
        }

        const button =
            document.createElement(
                'button'
            );

        button.type = 'button';
        button.id = definition.id;
        button.className = 'map-tool-button';
        button.dataset.tool = definition.tool;
        button.innerHTML = `
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                ${definition.icon}
            </svg>
        `;

        bar.insertBefore(
            button,
            insertBefore
        );
    });
}

function ensureMapHistoryTools() {
    const bar =
        document.querySelector(
            '.map-tools-bar'
        );

    if (!bar) {
        return;
    }

    const createButton =
        (id, direction) => {
            const button =
                document.createElement(
                    'button'
                );

            button.type = 'button';
            button.id = id;
            button.className =
                `map-tool-button map-tool-history-button map-tool-history-${direction}`;

            button.innerHTML =
                direction === 'undo'
                    ? `
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M9 8 5 12l4 4"/>
                            <path d="M5 12h7.5a5.5 5.5 0 0 1 5.5 5.5"/>
                        </svg>
                    `
                    : `
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="m15 8 4 4-4 4"/>
                            <path d="M19 12h-7.5A5.5 5.5 0 0 0 6 17.5"/>
                        </svg>
                    `;

            button.addEventListener(
                'click',
                event => {
                    event.stopPropagation();

                    if (
                        direction ===
                        'undo'
                    ) {
                        undoMapToolAction();
                    } else {
                        redoMapToolAction();
                    }
                }
            );

            return button;
        };

    let undoButton =
        $('mapToolUndoButton');

    let redoButton =
        $('mapToolRedoButton');

    if (!undoButton) {
        undoButton =
            createButton(
                'mapToolUndoButton',
                'undo'
            );
    }

    if (!redoButton) {
        redoButton =
            createButton(
                'mapToolRedoButton',
                'redo'
            );
    }

    const layersButton =
        $('mapToolLayers');

    if (layersButton) {
        if (!undoButton.isConnected) {
            bar.insertBefore(
                undoButton,
                layersButton
            );
        }

        if (!redoButton.isConnected) {
            bar.insertBefore(
                redoButton,
                layersButton
            );
        }
    } else {
        if (!undoButton.isConnected) {
            bar.appendChild(
                undoButton
            );
        }

        if (!redoButton.isConnected) {
            bar.appendChild(
                redoButton
            );
        }
    }

    updateMapToolHistoryUI();
}

function updateMapToolsLocalization() {
    ensureMapShapeTools();
    ensureMapHistoryTools();
    buildEraserPopover();

    if (typeof initReloadTrainer === 'function') {
        initReloadTrainer();
        updateReloadTrainerLocalization();
    }

    const undoButton =
        $('mapToolUndoButton');

    const redoButton =
        $('mapToolRedoButton');

    const rulerButton = $('mapToolRuler');
    const pencilButton = $('mapToolPencil');
    const zoneButton = $('mapToolZone');
    const polygonButton = $('mapToolPolygon');
    const eraserButton = $('mapToolEraser');
    const markerButton = $('mapToolMarker');
    const searchButton = $('mapToolCoordinateSearch');
    const layersButton = $('mapToolLayers');
    const dataTransferButton = $('mapToolDataTransfer');
    const mobileToolsToggle = $('mobileMapToolsToggle');

    setToolButtonLabel(
        undoButton,
        'mapToolUndo',
        'undo'
    );

    setToolButtonLabel(
        redoButton,
        'mapToolRedo',
        'redo'
    );

    setToolButtonLabel(rulerButton, 'mapToolRuler', 'ruler');
    setToolButtonLabel(pencilButton, 'mapToolPencil', 'pencil');
    setToolButtonLabel(zoneButton, 'mapLayerZones', 'zone');
    setToolButtonLabel(polygonButton, 'mapLayerPolygons', 'polygon');
    setToolButtonLabel(eraserButton, 'mapToolEraser', 'eraser');
    setToolButtonLabel(markerButton, 'mapToolMarkers', 'marker');
    setToolButtonLabel(searchButton, 'mapToolCoordinateSearch', 'coordinateSearch');
    setToolButtonLabel(layersButton, 'mapToolLayers', 'layers');
    setToolButtonLabel(dataTransferButton, 'mapToolDataTransfer');
    setToolButtonLabel(mobileToolsToggle, 'mapToolsToggle');

    buildPencilPalette();
    buildMarkerPicker();
    buildMapLayers();
    buildMapDataTransfer();

    /*
     * Fire adjustment is an optional runtime feature; it injects its own
     * toolbar button and popover when the script is loaded.
     */
    if (
        typeof buildFireAdjustmentPopover ===
        'function'
    ) {
        buildFireAdjustmentPopover();

        setToolButtonLabel(
            $('mapToolFireAdjustment'),
            'fireAdjustment',
            'fireAdjust'
        );
    }

    const goButton = $('coordinateSearchGo');
    if (goButton) goButton.textContent = tr('mapToolSearchGo');
    const searchTitle = $('coordinateSearchTitle');
    if (searchTitle) searchTitle.textContent = tr('mapToolCoordinateSearch');

    updateMapToolsUI();
}

function initMapTools() {
    loadMapToolState();
    updateMapToolsLocalization();

    const rulerButton =
        $('mapToolRuler');
    const pencilButton =
        $('mapToolPencil');
    const zoneButton =
        $('mapToolZone');
    const polygonButton =
        $('mapToolPolygon');
    const eraserButton =
        $('mapToolEraser');
    const markerButton =
        $('mapToolMarker');
    const searchButton =
        $('mapToolCoordinateSearch');
    const layersButton =
        $('mapToolLayers');
    const dataTransferButton =
        $('mapToolDataTransfer');
    const mobileToolsToggle =
        $('mobileMapToolsToggle');

    mobileToolsToggle?.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            toggleMobileMapTools();
        }
    );

    rulerButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            closeMapToolMenus();
            setMapTool('ruler');
        }
    );

    pencilButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            activateColorMapTool(
                'pencil'
            );
        }
    );

    zoneButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            activateColorMapTool(
                'zone'
            );
        }
    );

    polygonButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            activateColorMapTool(
                'polygon'
            );
        }
    );

    eraserButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            activateEraserTool();
        }
    );

    markerButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            /*
             * Opening Markers is a real tool switch: cancel any ruler,
             * drawing, eraser or fire-adjustment mode before showing the
             * picker. Selecting an icon commits marker placement mode.
             */
            activateMarkerPicker();
        }
    );

    searchButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            selectMapTool('coordinateSearch');
            updateMapToolsUI();
            updateCoordinateSearchDefaults();
            toggleMapToolMenu('coordinateSearchPopover');
            $('coordinateSearchX')?.focus();
        }
    );

    layersButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            selectMapTool('layers');
            updateMapToolsUI();
            buildMapLayers();
            toggleMapToolMenu('mapLayersPopover');
        }
    );

    dataTransferButton?.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            selectMapTool('dataTransfer');
            updateMapToolsUI();
            buildMapDataTransfer();
            toggleMapToolMenu('mapDataTransferPopover');
        }
    );

    $('coordinateSearchGo')?.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            submitCoordinateSearch();
        }
    );

    ['coordinateSearchX', 'coordinateSearchY'].forEach(id => {
        $(id)?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitCoordinateSearch();
            }
        });
    });

    c?.addEventListener(
        'dblclick',
        event => {
            if (
                MAP_TOOL_STATE.tool !==
                'polygon'
            ) {
                return;
            }

            event.preventDefault();
            finishPolygonDraft();
        }
    );

    document.addEventListener(
        'click',
        event => {
            if (
                !event.target.closest(
                    '.map-tools'
                )
            ) {
                closeMapToolMenus();
            }
        }
    );

    updateMapToolsUI();
}

;

/* js/map/tools/interactions.js */
/* =========================
   MAP TOOL INTERACTIONS
   ========================= */

function isWorldPointInsideMap(point) {
    const bounds =
        getViewBounds();

    return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
    );
}

function constrainRulerEnd(
    start,
    end,
    constrained
) {
    if (
        !constrained ||
        !start ||
        !end
    ) {
        return end;
    }

    const deltaX =
        end.x - start.x;

    const deltaY =
        end.y - start.y;

    return Math.abs(deltaX) >= Math.abs(deltaY)
        ? {
            x: end.x,
            y: start.y
        }
        : {
            x: start.x,
            y: end.y
        };
}

function addPencilPoint(point) {
    const path =
        MAP_TOOL_STATE.activePath;

    if (!path) {
        return;
    }

    const last =
        path.points[
            path.points.length - 1
        ];

    if (!last) {
        path.points.push({
            x: point.x,
            y: point.y
        });
        return;
    }

    const screenA =
        toScreen(last.x, last.y);
    const screenB =
        toScreen(point.x, point.y);

    if (
        Math.hypot(
            screenB.x - screenA.x,
            screenB.y - screenA.y
        ) < 3
    ) {
        return;
    }

    path.points.push({
        x: point.x,
        y: point.y
    });
}

function finishZoneDraft() {
    if (
        !MAP_TOOL_STATE.zoneDragging ||
        !MAP_TOOL_STATE.zoneStart ||
        !MAP_TOOL_STATE.zoneEnd
    ) {
        return false;
    }

    const start =
        MAP_TOOL_STATE.zoneStart;

    const end =
        MAP_TOOL_STATE.zoneEnd;

    const radius =
        Math.hypot(
            end.x - start.x,
            end.y - start.y
        );

    MAP_TOOL_STATE.zoneDragging = false;
    MAP_TOOL_STATE.zoneStart = null;
    MAP_TOOL_STATE.zoneEnd = null;

    if (
        radius * view().scale < 4
    ) {
        draw();
        return true;
    }

    pushMapToolHistory();

    MAP_TOOL_STATE.zones.push({
        id: mapToolId(),
        mapId: currentMapToolMapId(),
        color: MAP_TOOL_STATE.pencilColor,
        x: start.x,
        y: start.y,
        radius
    });

    saveMapToolState();

    if (
        typeof trackAnalytics ===
            'function'
    ) {
        trackAnalytics(
            'zone-created',
            {
                map: S.map
            }
        );
    }

    draw();
    return true;
}

function addPolygonPoint(point) {
    if (!MAP_TOOL_STATE.polygonDraft) {
        MAP_TOOL_STATE.polygonDraft = {
            id: mapToolId(),
            mapId: currentMapToolMapId(),
            color: MAP_TOOL_STATE.pencilColor,
            points: [
                {
                    x: point.x,
                    y: point.y
                }
            ]
        };

        MAP_TOOL_STATE.polygonHover = {
            x: point.x,
            y: point.y
        };

        draw();
        return true;
    }

    const draft =
        MAP_TOOL_STATE.polygonDraft;

    const first =
        draft.points[0];

    if (
        draft.points.length >= 3 &&
        first
    ) {
        const firstScreen =
            toScreen(
                first.x,
                first.y
            );

        const pointScreen =
            toScreen(
                point.x,
                point.y
            );

        if (
            Math.hypot(
                pointScreen.x - firstScreen.x,
                pointScreen.y - firstScreen.y
            ) <= 14
        ) {
            return finishPolygonDraft();
        }
    }

    const last =
        draft.points[
            draft.points.length - 1
        ];

    const lastScreen =
        toScreen(
            last.x,
            last.y
        );

    const pointScreen =
        toScreen(
            point.x,
            point.y
        );

    if (
        Math.hypot(
            pointScreen.x - lastScreen.x,
            pointScreen.y - lastScreen.y
        ) < 3
    ) {
        return true;
    }

    draft.points.push({
        x: point.x,
        y: point.y
    });

    MAP_TOOL_STATE.polygonHover = {
        x: point.x,
        y: point.y
    };

    draw();
    return true;
}

function finishPolygonDraft() {
    const draft =
        MAP_TOOL_STATE.polygonDraft;

    if (
        !draft ||
        !Array.isArray(draft.points) ||
        draft.points.length < 3
    ) {
        return false;
    }

    pushMapToolHistory();

    MAP_TOOL_STATE.polygons.push({
        ...draft,
        points: structuredClone(
            draft.points
        )
    });

    MAP_TOOL_STATE.polygonDraft = null;
    MAP_TOOL_STATE.polygonHover = null;

    saveMapToolState();

    if (
        typeof trackAnalytics ===
            'function'
    ) {
        trackAnalytics(
            'polygon-created',
            {
                map: S.map
            }
        );
    }

    draw();
    return true;
}

function placeMapToolMarker(point) {
    const asset =
        getMarkerAsset(
            MAP_TOOL_STATE.selectedMarkerIcon
        );

    if (
        !asset ||
        !asset.placeable
    ) {
        MAP_TOOL_STATE.selectedMarkerIcon = null;
        toggleMapToolMenu(
            'markerPicker'
        );
        updateMapToolsUI();
        return;
    }

    pushMapToolHistory();

    MAP_TOOL_STATE.markers.push({
        id: mapToolId(),
        mapId: currentMapToolMapId(),
        icon: MAP_TOOL_STATE.selectedMarkerIcon,
        x: point.x,
        y: point.y,
        ...(asset.colorable
            ? {
                color:
                    MAP_TOOL_STATE.selectedMarkerColor
            }
            : {})
    });

    saveMapToolState();

    if (
        typeof trackAnalytics ===
        'function'
    ) {
        trackAnalytics(
            'user-marker-placed',
            {
                map: S.map
            }
        );
    }

    draw();
}

function findPencilPathAtCanvasPoint(
    canvasX,
    canvasY
) {
    let best = null;

    MAP_TOOL_STATE.drawings
        .filter(
            path =>
                path.mapId ===
                currentMapToolMapId()
        )
        .forEach(path => {
            for (
                let i = 1;
                i < path.points.length;
                i++
            ) {
                const aWorld =
                    path.points[i - 1];

                const bWorld =
                    path.points[i];

                const a =
                    toScreen(
                        aWorld.x,
                        aWorld.y
                    );

                const b =
                    toScreen(
                        bWorld.x,
                        bWorld.y
                    );

                const hit =
                    pointToSegmentDistance(
                        canvasX,
                        canvasY,
                        a.x,
                        a.y,
                        b.x,
                        b.y
                    );

                if (
                    hit.distance <= 12 &&
                    (
                        !best ||
                        hit.distance <
                        best.distance
                    )
                ) {
                    best = {
                        id: path.id,
                        distance: hit.distance,
                        point: {
                            x:
                                aWorld.x +
                                (
                                    bWorld.x -
                                    aWorld.x
                                ) * hit.t,
                            y:
                                aWorld.y +
                                (
                                    bWorld.y -
                                    aWorld.y
                                ) * hit.t
                        }
                    };
                }
            }
        });

    return best;
}

function isCanvasPointInsidePolygon(
    canvasX,
    canvasY,
    points
) {
    let inside = false;

    for (
        let current = 0,
            previous = points.length - 1;
        current < points.length;
        previous = current++
    ) {
        const a = points[current];
        const b = points[previous];

        const crosses =
            (a.y > canvasY) !==
                (b.y > canvasY) &&
            canvasX <
                (
                    (b.x - a.x) *
                    (canvasY - a.y)
                ) /
                (
                    b.y - a.y ||
                    Number.EPSILON
                ) +
                a.x;

        if (crosses) {
            inside = !inside;
        }
    }

    return inside;
}

function findMapToolShapeAtCanvasPoint(
    canvasX,
    canvasY
) {
    let best = null;

    if (isMapLayerVisible('zones')) {
        MAP_TOOL_STATE.zones
            .filter(
                zone =>
                    zone.mapId ===
                        currentMapToolMapId() &&
                    Number.isFinite(zone.x) &&
                    Number.isFinite(zone.y) &&
                    Number.isFinite(zone.radius) &&
                    zone.radius > 0
            )
            .forEach(zone => {
                const center =
                    toScreen(
                        zone.x,
                        zone.y
                    );

                const radius =
                    zone.radius *
                    view().scale;

                const centerDistance =
                    Math.hypot(
                        canvasX - center.x,
                        canvasY - center.y
                    );

                if (
                    centerDistance >
                    radius + 10
                ) {
                    return;
                }

                const distance =
                    Math.abs(
                        centerDistance -
                        radius
                    );

                if (
                    !best ||
                    distance < best.distance
                ) {
                    best = {
                        type: 'zone',
                        id: zone.id,
                        distance
                    };
                }
            });
    }

    if (isMapLayerVisible('polygons')) {
        MAP_TOOL_STATE.polygons
            .filter(
                polygon =>
                    polygon.mapId ===
                        currentMapToolMapId() &&
                    Array.isArray(
                        polygon.points
                    ) &&
                    polygon.points.length >= 3
            )
            .forEach(polygon => {
                const points =
                    polygon.points.map(
                        point =>
                            toScreen(
                                point.x,
                                point.y
                            )
                    );

                let edgeDistance =
                    Infinity;

                for (
                    let index = 0;
                    index < points.length;
                    index++
                ) {
                    const a = points[index];
                    const b =
                        points[
                            (index + 1) %
                            points.length
                        ];

                    edgeDistance =
                        Math.min(
                            edgeDistance,
                            pointToSegmentDistance(
                                canvasX,
                                canvasY,
                                a.x,
                                a.y,
                                b.x,
                                b.y
                            ).distance
                        );
                }

                if (
                    edgeDistance > 10 &&
                    !isCanvasPointInsidePolygon(
                        canvasX,
                        canvasY,
                        points
                    )
                ) {
                    return;
                }

                if (
                    !best ||
                    edgeDistance < best.distance
                ) {
                    best = {
                        type: 'polygon',
                        id: polygon.id,
                        distance: edgeDistance
                    };
                }
            });
    }

    return best;
}

function setMapToolShapeHover(hit) {
    const nextType =
        hit?.type || null;

    const nextId =
        hit?.id || null;

    const changed =
        nextType !==
            MAP_TOOL_STATE.hoverShapeType ||
        nextId !==
            MAP_TOOL_STATE.hoverShapeId;

    MAP_TOOL_STATE.hoverShapeType =
        nextType;

    MAP_TOOL_STATE.hoverShapeId =
        nextId;

    return changed;
}

function setPencilPathHover(hit) {
    MAP_TOOL_STATE.hoverPathId =
        hit?.id || null;

    MAP_TOOL_STATE.hoverDeletePoint =
        hit?.point || null;
}

function eraseMapToolItemAtCanvasPoint(
    canvasX,
    canvasY
) {
    /*
     * User markers sit visually above pencil strokes, so the eraser
     * checks them first. This also makes touch deletion predictable
     * when a marker happens to overlap a drawing.
     */
    const markerHit =
        findMapToolMarkerAtCanvasPoint(
            canvasX,
            canvasY
        );

    setMapToolMarkerHover(markerHit);

    if (markerHit) {
        setPencilPathHover(null);
        setMapToolShapeHover(null);
        return deleteHoveredMapToolMarker();
    }

    const pathHit =
        findPencilPathAtCanvasPoint(
            canvasX,
            canvasY
        );

    setPencilPathHover(pathHit);

    if (pathHit) {
        setMapToolShapeHover(null);
        return deleteHoveredPencilPath();
    }

    const shapeHit =
        findMapToolShapeAtCanvasPoint(
            canvasX,
            canvasY
        );

    setMapToolShapeHover(shapeHit);

    if (shapeHit) {
        return deleteHoveredMapToolShape();
    }

    draw();
    return false;
}

function deleteHoveredPencilPath() {
    if (!MAP_TOOL_STATE.hoverPathId) {
        return false;
    }

    const before =
        MAP_TOOL_STATE.drawings.length;

    pushMapToolHistory();

    MAP_TOOL_STATE.drawings =
        MAP_TOOL_STATE.drawings.filter(
            item =>
                item.id !==
                MAP_TOOL_STATE.hoverPathId
        );

    MAP_TOOL_STATE.hoverPathId = null;
    MAP_TOOL_STATE.hoverDeletePoint = null;

    if (
        MAP_TOOL_STATE.drawings.length !==
        before
    ) {
        saveMapToolState();
        draw();
        return true;
    }

    return false;
}

function deleteHoveredMapToolShape() {
    const type =
        MAP_TOOL_STATE.hoverShapeType;

    const id =
        MAP_TOOL_STATE.hoverShapeId;

    const collectionName =
        type === 'zone'
            ? 'zones'
            : type === 'polygon'
                ? 'polygons'
                : null;

    if (!collectionName || !id) {
        return false;
    }

    const collection =
        MAP_TOOL_STATE[collectionName];

    if (
        !collection.some(
            item =>
                item.id === id
        )
    ) {
        return false;
    }

    pushMapToolHistory();

    MAP_TOOL_STATE[collectionName] =
        collection.filter(
            item =>
                item.id !== id
        );

    setMapToolShapeHover(null);
    saveMapToolState();
    draw();
    return true;
}

function getHoveredMapToolMarker() {
    if (!MAP_TOOL_STATE.hoverMarkerId) {
        return null;
    }

    return (
        MAP_TOOL_STATE.markers.find(
            item =>
                item.id ===
                MAP_TOOL_STATE.hoverMarkerId
        ) || null
    );
}

function deleteHoveredMapToolMarker() {
    if (!MAP_TOOL_STATE.hoverMarkerId) {
        return false;
    }

    const before =
        MAP_TOOL_STATE.markers.length;

    pushMapToolHistory();

    MAP_TOOL_STATE.markers =
        MAP_TOOL_STATE.markers.filter(
            item =>
                item.id !==
                MAP_TOOL_STATE.hoverMarkerId
        );

    MAP_TOOL_STATE.hoverMarkerId = null;

    if (
        MAP_TOOL_STATE.markers.length !==
        before
    ) {
        saveMapToolState();
        draw();
        return true;
    }

    return false;
}

function getMapToolMarkerScreenGeometry(item) {
    const asset =
        getMarkerAsset(item.icon);

    if (!asset) {
        return null;
    }

    const center =
        toScreen(
            item.x,
            item.y
        );

    const width = asset.width;
    const height = asset.height;

    const left =
        center.x -
        width * asset.anchorX;

    const top =
        center.y -
        height * asset.anchorY;

    return {
        center,
        width,
        height,
        left,
        top,
        right: left + width,
        bottom: top + height,
        deleteX: left + width + 3,
        deleteY: top - 3
    };
}

function findMapToolMarkerAtCanvasPoint(
    canvasX,
    canvasY
) {
    let best = null;

    MAP_TOOL_STATE.markers
        .filter(
            item =>
                item.mapId ===
                currentMapToolMapId()
        )
        .forEach(item => {
            const geometry =
                getMapToolMarkerScreenGeometry(item);

            if (!geometry) {
                return;
            }

            const padding = 8;

            if (
                canvasX >= geometry.left - padding &&
                canvasX <= geometry.right + padding &&
                canvasY >= geometry.top - padding &&
                canvasY <= geometry.bottom + padding
            ) {
                const distance =
                    Math.hypot(
                        canvasX - geometry.center.x,
                        canvasY - geometry.center.y
                    );

                if (
                    !best ||
                    distance < best.distance
                ) {
                    best = {
                        id: item.id,
                        distance
                    };
                }
            }
        });

    return best;
}

function setMapToolMarkerHover(hit) {
    const nextId =
        hit?.id || null;

    if (
        nextId ===
        MAP_TOOL_STATE.hoverMarkerId
    ) {
        return false;
    }

    MAP_TOOL_STATE.hoverMarkerId =
        nextId;

    return true;
}

function updateMapToolMarkerHover(event) {
    const rect =
        c.getBoundingClientRect();

    const hit =
        findMapToolMarkerAtCanvasPoint(
            event.clientX - rect.left,
            event.clientY - rect.top
        );

    if (setMapToolMarkerHover(hit)) {
        draw();
    }
}

function handleMapToolMouseDown(
    event,
    world
) {
    if (
        event.button !== 0 ||
        !MAP_TOOL_STATE.tool
    ) {
        return false;
    }

    if (
        MAP_TOOL_STATE.tool === 'eraser'
    ) {
        const rect =
            c.getBoundingClientRect();

        eraseMapToolItemAtCanvasPoint(
            event.clientX - rect.left,
            event.clientY - rect.top
        );

        return true;
    }

    if (
        MAP_TOOL_STATE.tool === 'marker' &&
        MAP_TOOL_STATE.hoverMarkerId
    ) {
        const item =
            getHoveredMapToolMarker();

        const geometry =
            item
                ? getMapToolMarkerScreenGeometry(item)
                : null;

        if (geometry) {
            const rect =
                c.getBoundingClientRect();

            const mouseX =
                event.clientX - rect.left;

            const mouseY =
                event.clientY - rect.top;

            if (
                Math.hypot(
                    mouseX - geometry.deleteX,
                    mouseY - geometry.deleteY
                ) <= 12
            ) {
                deleteHoveredMapToolMarker();
                return true;
            }
        }
    }

    if (!isWorldPointInsideMap(world)) {
        return true;
    }

    if (
        MAP_TOOL_STATE.tool === 'ruler'
    ) {
        MAP_TOOL_STATE.rulerStart = {
            x: world.x,
            y: world.y
        };
        MAP_TOOL_STATE.rulerEnd = {
            x: world.x,
            y: world.y
        };
        MAP_TOOL_STATE.rulerDragging = true;
        draw();
        return true;
    }

    if (
        MAP_TOOL_STATE.tool === 'pencil'
    ) {
        const path = {
            id: mapToolId(),
            mapId: currentMapToolMapId(),
            color: MAP_TOOL_STATE.pencilColor,
            points: []
        };

        MAP_TOOL_STATE.activePath =
            path;
        MAP_TOOL_STATE.pencilDragging =
            true;

        addPencilPoint(world);
        draw();
        return true;
    }

    if (
        MAP_TOOL_STATE.tool === 'zone'
    ) {
        MAP_TOOL_STATE.zoneStart = {
            x: world.x,
            y: world.y
        };

        MAP_TOOL_STATE.zoneEnd = {
            x: world.x,
            y: world.y
        };

        MAP_TOOL_STATE.zoneDragging = true;
        draw();
        return true;
    }

    if (
        MAP_TOOL_STATE.tool === 'polygon'
    ) {
        return addPolygonPoint(
            world
        );
    }

    if (
        MAP_TOOL_STATE.tool === 'marker'
    ) {
        placeMapToolMarker(world);
        return true;
    }

    return false;
}

function handleMapToolMouseMove(
    event,
    world
) {
    if (!MAP_TOOL_STATE.tool) {
        return false;
    }

    if (
        MAP_TOOL_STATE.tool === 'ruler' &&
        MAP_TOOL_STATE.rulerDragging
    ) {
        MAP_TOOL_STATE.rulerEnd =
            constrainRulerEnd(
                MAP_TOOL_STATE.rulerStart,
                {
                    x: world.x,
                    y: world.y
                },
                event.shiftKey
            );
        draw();
        return true;
    }

    if (
        MAP_TOOL_STATE.tool === 'pencil'
    ) {
        if (
            MAP_TOOL_STATE.pencilDragging
        ) {
            if (
                isWorldPointInsideMap(world)
            ) {
                addPencilPoint(world);
            }

            draw();
            return true;
        }

        return false;
    }

    if (
        MAP_TOOL_STATE.tool === 'zone' &&
        MAP_TOOL_STATE.zoneDragging
    ) {
        if (
            isWorldPointInsideMap(world)
        ) {
            MAP_TOOL_STATE.zoneEnd = {
                x: world.x,
                y: world.y
            };
        }

        draw();
        return true;
    }

    if (
        MAP_TOOL_STATE.tool === 'polygon' &&
        MAP_TOOL_STATE.polygonDraft
    ) {
        MAP_TOOL_STATE.polygonHover =
            isWorldPointInsideMap(world)
                ? {
                    x: world.x,
                    y: world.y
                }
                : null;

        draw();
        return true;
    }

    if (
        MAP_TOOL_STATE.tool === 'eraser'
    ) {
        const rect =
            c.getBoundingClientRect();

        const canvasX =
            event.clientX - rect.left;

        const canvasY =
            event.clientY - rect.top;

        const markerHit =
            findMapToolMarkerAtCanvasPoint(
                canvasX,
                canvasY
            );

        const markerChanged =
            setMapToolMarkerHover(
                markerHit
            );

        const pathHit =
            markerHit
                ? null
                : findPencilPathAtCanvasPoint(
                    canvasX,
                    canvasY
                );

        const previousPathId =
            MAP_TOOL_STATE.hoverPathId;

        setPencilPathHover(pathHit);

        const shapeHit =
            markerHit || pathHit
                ? null
                : findMapToolShapeAtCanvasPoint(
                    canvasX,
                    canvasY
                );

        const shapeChanged =
            setMapToolShapeHover(
                shapeHit
            );

        if (
            markerChanged ||
            shapeChanged ||
            previousPathId !==
            MAP_TOOL_STATE.hoverPathId
        ) {
            draw();
        }

        return false;
    }

    if (
        MAP_TOOL_STATE.tool === 'marker'
    ) {
        updateMapToolMarkerHover(event);
        return false;
    }

    return false;
}

function handleMapToolMouseUp() {
    if (
        MAP_TOOL_STATE.rulerDragging
    ) {
        const start =
            MAP_TOOL_STATE.rulerStart;

        const end =
            MAP_TOOL_STATE.rulerEnd;

        MAP_TOOL_STATE.rulerDragging =
            false;
        MAP_TOOL_STATE.rulerStart =
            null;
        MAP_TOOL_STATE.rulerEnd =
            null;

        if (
            start &&
            end &&
            Math.hypot(
                end.x - start.x,
                end.y - start.y
            ) > 0
        ) {
            if (
                typeof trackAnalytics ===
                'function'
            ) {
                trackAnalytics(
                    'ruler-used',
                    {
                        map: S.map
                    }
                );
            }
        }

        draw();
        return true;
    }

    if (
        MAP_TOOL_STATE.pencilDragging
    ) {
        MAP_TOOL_STATE.pencilDragging =
            false;

        const path =
            MAP_TOOL_STATE.activePath;

        if (
            path &&
            path.points.length >= 2
        ) {
            pushMapToolHistory();
            MAP_TOOL_STATE.drawings.push(
                path
            );
            saveMapToolState();

            if (
                typeof trackAnalytics ===
                'function'
            ) {
                trackAnalytics(
                    'drawing-created',
                    {
                        map: S.map
                    }
                );
            }
        }

        MAP_TOOL_STATE.activePath =
            null;
        draw();
        return true;
    }

    if (
        MAP_TOOL_STATE.zoneDragging
    ) {
        return finishZoneDraft();
    }

    return false;
}

function pointToSegmentDistance(
    px,
    py,
    ax,
    ay,
    bx,
    by
) {
    const dx = bx - ax;
    const dy = by - ay;

    if (
        dx === 0 &&
        dy === 0
    ) {
        return {
            distance:
                Math.hypot(
                    px - ax,
                    py - ay
                ),
            t: 0
        };
    }

    const t =
        Math.max(
            0,
            Math.min(
                1,
                (
                    (px - ax) * dx +
                    (py - ay) * dy
                ) /
                (
                    dx * dx +
                    dy * dy
                )
            )
        );

    const x = ax + t * dx;
    const y = ay + t * dy;

    return {
        distance:
            Math.hypot(
                px - x,
                py - y
            ),
        t
    };
}

function updatePencilHover(event) {
    const rect =
        c.getBoundingClientRect();

    const hit =
        findPencilPathAtCanvasPoint(
            event.clientX - rect.left,
            event.clientY - rect.top
        );

    setPencilPathHover(hit);
    draw();
}

;

/* js/map/tools/rendering.js */
/* =========================
   MAP TOOL RENDERING
   ========================= */

function drawMapToolZone(zone, preview = false) {
    if (
        !zone ||
        !Number.isFinite(zone.x) ||
        !Number.isFinite(zone.y) ||
        !Number.isFinite(zone.radius) ||
        zone.radius <= 0
    ) {
        return;
    }

    const center =
        worldToLocalScreen(
            zone.x,
            zone.y
        );

    const radius =
        zone.radius *
        view().scale;

    const hovered =
        MAP_TOOL_STATE.tool === 'eraser' &&
        MAP_TOOL_STATE.hoverShapeType === 'zone' &&
        MAP_TOOL_STATE.hoverShapeId === zone.id;

    const color =
        hovered
            ? '#d86666'
            : zone.color || '#d7a452';

    ctx.save();
    ctx.beginPath();
    ctx.arc(
        center.x,
        center.y,
        radius,
        0,
        Math.PI * 2
    );
    ctx.fillStyle =
        hexToRgba(
            color,
            preview ? 0.08 : 0.14
        );
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.setLineDash(
        preview
            ? [5, 4]
            : [7, 5]
    );
    ctx.stroke();
    ctx.setLineDash([]);

    if (preview) {
        ctx.beginPath();
        ctx.arc(
            center.x,
            center.y,
            3,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = color;
        ctx.fill();
    }

    ctx.restore();
}

function drawMapToolZones() {
    MAP_TOOL_STATE.zones
        .filter(
            zone =>
                zone.mapId ===
                currentMapToolMapId()
        )
        .forEach(
            zone =>
                drawMapToolZone(zone)
        );

    if (
        MAP_TOOL_STATE.zoneDragging &&
        MAP_TOOL_STATE.zoneStart &&
        MAP_TOOL_STATE.zoneEnd
    ) {
        drawMapToolZone(
            {
                id: 'active-zone',
                mapId: currentMapToolMapId(),
                color: MAP_TOOL_STATE.pencilColor,
                x: MAP_TOOL_STATE.zoneStart.x,
                y: MAP_TOOL_STATE.zoneStart.y,
                radius: Math.hypot(
                    MAP_TOOL_STATE.zoneEnd.x -
                        MAP_TOOL_STATE.zoneStart.x,
                    MAP_TOOL_STATE.zoneEnd.y -
                        MAP_TOOL_STATE.zoneStart.y
                )
            },
            true
        );
    }
}

function drawMapToolPolygon(
    polygon,
    {
        draft = false,
        hoverPoint = null
    } = {}
) {
    if (
        !polygon ||
        !Array.isArray(polygon.points) ||
        !polygon.points.length
    ) {
        return;
    }

    const points = [
        ...polygon.points
    ];

    if (draft && hoverPoint) {
        points.push(
            hoverPoint
        );
    }

    const screenPoints =
        points.map(
            point =>
                worldToLocalScreen(
                    point.x,
                    point.y
                )
        );

    const hovered =
        MAP_TOOL_STATE.tool === 'eraser' &&
        MAP_TOOL_STATE.hoverShapeType === 'polygon' &&
        MAP_TOOL_STATE.hoverShapeId === polygon.id;

    const color =
        hovered
            ? '#d86666'
            : polygon.color || '#d7a452';

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(
        screenPoints[0].x,
        screenPoints[0].y
    );

    for (
        let index = 1;
        index < screenPoints.length;
        index++
    ) {
        ctx.lineTo(
            screenPoints[index].x,
            screenPoints[index].y
        );
    }

    if (!draft && polygon.points.length >= 3) {
        ctx.closePath();
        ctx.fillStyle =
            hexToRgba(
                color,
                0.15
            );
        ctx.fill();
    } else if (
        draft &&
        polygon.points.length >= 3
    ) {
        ctx.lineTo(
            screenPoints[0].x,
            screenPoints[0].y
        );
        ctx.fillStyle =
            hexToRgba(
                color,
                0.08
            );
        ctx.fill();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(
        draft
            ? [5, 4]
            : []
    );
    ctx.stroke();
    ctx.setLineDash([]);

    if (draft) {
        polygon.points.forEach(
            (point, index) => {
                const screen =
                    worldToLocalScreen(
                        point.x,
                        point.y
                    );

                ctx.beginPath();
                ctx.arc(
                    screen.x,
                    screen.y,
                    index === 0 ? 5 : 3.5,
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle =
                    index === 0
                        ? '#ffffff'
                        : color;
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        );
    }

    ctx.restore();
}

function drawMapToolPolygons() {
    MAP_TOOL_STATE.polygons
        .filter(
            polygon =>
                polygon.mapId ===
                currentMapToolMapId()
        )
        .forEach(
            polygon =>
                drawMapToolPolygon(
                    polygon
                )
        );

    if (
        MAP_TOOL_STATE.polygonDraft &&
        MAP_TOOL_STATE.polygonDraft.mapId ===
            currentMapToolMapId()
    ) {
        drawMapToolPolygon(
            MAP_TOOL_STATE.polygonDraft,
            {
                draft: true,
                hoverPoint:
                    MAP_TOOL_STATE.polygonHover
            }
        );
    }
}

function drawMapToolPath(path) {
    if (
        !path ||
        !Array.isArray(path.points) ||
        path.points.length < 2
    ) {
        return;
    }

    ctx.save();
    ctx.beginPath();

    path.points.forEach(
        (point, index) => {
            const screen =
                worldToLocalScreen(
                    point.x,
                    point.y
                );

            if (index === 0) {
                ctx.moveTo(
                    screen.x,
                    screen.y
                );
            } else {
                ctx.lineTo(
                    screen.x,
                    screen.y
                );
            }
        }
    );

    ctx.strokeStyle =
        path.color || '#d7a452';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
}

function drawMapToolDrawings() {
    MAP_TOOL_STATE.drawings
        .filter(
            path =>
                path.mapId ===
                currentMapToolMapId()
        )
        .forEach(drawMapToolPath);

    if (
        MAP_TOOL_STATE.activePath &&
        MAP_TOOL_STATE.activePath.mapId ===
        currentMapToolMapId()
    ) {
        drawMapToolPath(
            MAP_TOOL_STATE.activePath
        );
    }
}

function drawMapToolMarker(item) {
    const asset =
        getMarkerAsset(item.icon);

    if (!asset) {
        return;
    }

    const entry =
        loadMarkerImage(asset);

    if (
        !entry ||
        !entry.loaded ||
        entry.failed
    ) {
        return;
    }

    const pos =
        worldToLocalScreen(
            item.x,
            item.y
        );

    const width =
        asset.width;
    const height =
        asset.height;

    const source =
        getMarkerImageSource(
            asset,
            item.color
        );

    if (!source) {
        return;
    }

    ctx.save();

    ctx.filter =
        getMapIconCanvasFilter();

    ctx.drawImage(
        source,
        pos.x - width * asset.anchorX,
        pos.y - height * asset.anchorY,
        width,
        height
    );

    ctx.restore();
}

function drawMapToolMarkers() {
    MAP_TOOL_STATE.markers
        .filter(
            marker =>
                marker.mapId ===
                currentMapToolMapId()
        )
        .forEach(drawMapToolMarker);
}

function formatRulerDistance(distanceWorld) {
    const meters =
        worldDistanceToMeters(distanceWorld);

    const distanceKm =
        meters / 1000;

    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }

    return `${distanceKm.toFixed(2)} km · ${Math.round(meters)} m`;
}

function getRulerBearing(start, end) {
    const dx =
        end.x - start.x;

    const dy =
        end.y - start.y;

    let angle =
        Math.atan2(
            dx,
            dy
        ) *
        180 /
        Math.PI;

    if (angle < 0) {
        angle += 360;
    }

    return angle;
}

function drawRulerOverlay() {
    if (
        !MAP_TOOL_STATE.rulerDragging ||
        !MAP_TOOL_STATE.rulerStart ||
        !MAP_TOOL_STATE.rulerEnd
    ) {
        return;
    }

    const start =
        worldToLocalScreen(
            MAP_TOOL_STATE.rulerStart.x,
            MAP_TOOL_STATE.rulerStart.y
        );
    const end =
        worldToLocalScreen(
            MAP_TOOL_STATE.rulerEnd.x,
            MAP_TOOL_STATE.rulerEnd.y
        );

    const distance =
        Math.hypot(
            MAP_TOOL_STATE.rulerEnd.x -
            MAP_TOOL_STATE.rulerStart.x,
            MAP_TOOL_STATE.rulerEnd.y -
            MAP_TOOL_STATE.rulerStart.y
        );

    ctx.save();
    ctx.strokeStyle = '#d7a452';
    ctx.fillStyle = '#d7a452';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    [start, end].forEach(point => {
        ctx.beginPath();
        ctx.arc(
            point.x,
            point.y,
            4,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });

    const bearing =
        getRulerBearing(
            MAP_TOOL_STATE.rulerStart,
            MAP_TOOL_STATE.rulerEnd
        );

    const label =
        `${formatRulerDistance(distance)} · ${bearing.toFixed(1)}°`;

    const midX =
        (start.x + end.x) / 2;
    const midY =
        (start.y + end.y) / 2;

    ctx.font =
        'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics =
        ctx.measureText(label);
    const width =
        metrics.width + 16;
    const height = 26;

    ctx.fillStyle =
        'rgba(16, 19, 22, .92)';
    ctx.fillRect(
        midX - width / 2,
        midY - height / 2 - 12,
        width,
        height
    );

    ctx.strokeStyle =
        'rgba(255,255,255,.14)';
    ctx.strokeRect(
        midX - width / 2,
        midY - height / 2 - 12,
        width,
        height
    );

    ctx.fillStyle = '#e7edf2';
    ctx.fillText(
        label,
        midX,
        midY - 12
    );

    ctx.restore();
}

function drawEraserAffordance() {
    if (
        MAP_TOOL_STATE.tool !== 'eraser' ||
        !MAP_TOOL_STATE.hoverPathId ||
        !MAP_TOOL_STATE.hoverDeletePoint ||
        MAP_TOOL_STATE.pencilDragging
    ) {
        return;
    }

    const point =
        worldToLocalScreen(
            MAP_TOOL_STATE.hoverDeletePoint.x,
            MAP_TOOL_STATE.hoverDeletePoint.y
        );

    ctx.save();

    ctx.beginPath();
    ctx.arc(
        point.x,
        point.y,
        10,
        0,
        Math.PI * 2
    );
    ctx.fillStyle =
        'rgba(16, 19, 22, .95)';
    ctx.fill();
    ctx.strokeStyle = '#d86666';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = '#d86666';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(
        point.x - 3.5,
        point.y - 3.5
    );
    ctx.lineTo(
        point.x + 3.5,
        point.y + 3.5
    );
    ctx.moveTo(
        point.x + 3.5,
        point.y - 3.5
    );
    ctx.lineTo(
        point.x - 3.5,
        point.y + 3.5
    );
    ctx.stroke();

    ctx.restore();
}

function drawMarkerDeleteAffordance() {
    if (
        !['marker', 'eraser'].includes(
            MAP_TOOL_STATE.tool
        ) ||
        !MAP_TOOL_STATE.hoverMarkerId
    ) {
        return;
    }

    const item =
        getHoveredMapToolMarker();

    const geometry =
        item
            ? getMapToolMarkerScreenGeometry(item)
            : null;

    if (!geometry) {
        return;
    }

    const v = view();

    const point = {
        x: geometry.deleteX - v.left,
        y: geometry.deleteY - v.top
    };

    ctx.save();

    ctx.beginPath();
    ctx.arc(
        point.x,
        point.y,
        10,
        0,
        Math.PI * 2
    );
    ctx.fillStyle =
        'rgba(16, 19, 22, .95)';
    ctx.fill();
    ctx.strokeStyle = '#d86666';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = '#d86666';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(
        point.x - 3.5,
        point.y - 3.5
    );
    ctx.lineTo(
        point.x + 3.5,
        point.y + 3.5
    );
    ctx.moveTo(
        point.x + 3.5,
        point.y - 3.5
    );
    ctx.lineTo(
        point.x - 3.5,
        point.y + 3.5
    );
    ctx.stroke();

    ctx.restore();
}

function drawCoordinateSearchPoint() {
    const point = MAP_TOOL_STATE.searchPoint;

    if (!point || !isWorldPointInsideMap(point)) {
        return;
    }

    const pos = worldToLocalScreen(point.x, point.y);

    ctx.save();
    ctx.strokeStyle = '#d7a452';
    ctx.fillStyle = 'rgba(215,164,82,.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x - 18, pos.y);
    ctx.lineTo(pos.x + 18, pos.y);
    ctx.moveTo(pos.x, pos.y - 18);
    ctx.lineTo(pos.x, pos.y + 18);
    ctx.stroke();
    ctx.restore();
}

function drawMapToolTransient() {
    drawCoordinateSearchPoint();
    drawRulerOverlay();
    drawEraserAffordance();
    drawMarkerDeleteAffordance();
}

;

/* js/map/grid.js */
/* =========================
   GRID
   ========================= */

function drawGrid() {

    const v =
        view();

    const major =
        '#6f7a82';

    const minor =
        '#3b444b';

    const coordinateMetersPerUnit =
        getCoordinateMetersPerUnit();

    const minorStep =
        coordinateMetersPerUnit === 100
            ? 1
            : 0.1;

    const majorStep =
        coordinateMetersPerUnit === 100
            ? 10
            : 1;

    const startX =
        Math.ceil(
            v.bounds.minX /
            minorStep
        ) *
        minorStep;

    const endX =
        Math.floor(
            v.bounds.maxX /
            minorStep
        ) *
        minorStep;

    const startY =
        Math.ceil(
            v.bounds.minY /
            minorStep
        ) *
        minorStep;

    const endY =
        Math.floor(
            v.bounds.maxY /
            minorStep
        ) *
        minorStep;

    for (
        let x =
            startX;

        x <=
        endX +
        1e-9;

        x +=
            minorStep
    ) {

        const rounded =
            Math.round(
                x *
                10
            ) /
            10;

        const local =
            worldToLocalScreen(
                rounded,
                v.bounds.maxY
            );

        const isMajor =
            Math.abs(
                rounded / majorStep -
                Math.round(
                    rounded / majorStep
                )
            ) <
            1e-8;

        ctx.strokeStyle =
            isMajor
                ? major
                : minor;

        ctx.lineWidth =
            isMajor
                ? 1
                : 0.65;

        ctx.beginPath();

        ctx.moveTo(
            local.x,
            0
        );

        ctx.lineTo(
            local.x,
            v.mh
        );

        ctx.stroke();
    }

    for (
        let y =
            startY;

        y <=
        endY +
        1e-9;

        y +=
            minorStep
    ) {

        const rounded =
            Math.round(
                y *
                10
            ) /
            10;

        const local =
            worldToLocalScreen(
                v.bounds.minX,
                rounded
            );

        const isMajor =
            Math.abs(
                rounded / majorStep -
                Math.round(
                    rounded / majorStep
                )
            ) <
            1e-8;

        ctx.strokeStyle =
            isMajor
                ? major
                : minor;

        ctx.lineWidth =
            isMajor
                ? 1
                : 0.65;

        ctx.beginPath();

        ctx.moveTo(
            0,
            local.y
        );

        ctx.lineTo(
            v.mw,
            local.y
        );

        ctx.stroke();
    }
}

function drawCoordinateLabels() {

    const v =
        view();

    const styles =
        getComputedStyle(
            document.documentElement
        );

    ctx.fillStyle =
        styles
            .getPropertyValue(
                '--muted'
            )
            .trim() ||
        '#89959e';

    ctx.font =
        '10px system-ui';

    const coordinateMetersPerUnit =
        getCoordinateMetersPerUnit();

    const labelStep =
        coordinateMetersPerUnit === 100
            ? 10
            : 1;

    const firstX =
        Math.ceil(v.bounds.minX / labelStep) * labelStep;

    const lastX =
        Math.floor(v.bounds.maxX / labelStep) * labelStep;

    const firstY =
        Math.ceil(v.bounds.minY / labelStep) * labelStep;

    const lastY =
        Math.floor(v.bounds.maxY / labelStep) * labelStep;

    ctx.textBaseline =
        'top';

    ctx.textAlign =
        'center';

    for (
        let x =
            firstX;

        x <=
        lastX;

        x += labelStep
    ) {

        const local =
            worldToLocalScreen(
                x,
                v.bounds.minY
            );

        ctx.fillText(
            formatGameCoordinate(x),
            local.x,
            v.mh +
            9
        );
    }

    ctx.textBaseline =
        'middle';

    ctx.textAlign =
        'right';

    for (
        let y =
            firstY;

        y <=
        lastY;

        y += labelStep
    ) {

        const local =
            worldToLocalScreen(
                v.bounds.minX,
                y
            );

        ctx.fillText(
            formatGameCoordinate(y),
            -8,
            local.y
        );
    }

    ctx.textBaseline =
        'alphabetic';
}

;

/* js/map/renderer.js */
/* =========================
   CANVAS RESIZE
   ========================= */

function resize() {

    const d =
        window.devicePixelRatio ||
        1;

    c.width =
        wrap.clientWidth *
        d;

    c.height =
        wrap.clientHeight *
        d;

    ctx.setTransform(
        d,
        0,
        0,
        d,
        0,
        0
    );

    draw();
}


/* =========================
   DRAW
   ========================= */

function draw() {

    if (!wrap) {
        return;
    }

    if (typeof queueAssetLoadingProgressUpdate === 'function') {
        queueAssetLoadingProgressUpdate();
    }

    const W =
        wrap.clientWidth;

    const H =
        wrap.clientHeight;

    const v =
        view();

    ctx.clearRect(
        0,
        0,
        W,
        H
    );

    const styles =
        getComputedStyle(
            document.documentElement
        );

    ctx.fillStyle =
        styles
            .getPropertyValue(
                '--map-bg'
            )
            .trim() ||
        '#0d1012';

    ctx.fillRect(
        0,
        0,
        W,
        H
    );

    ctx.save();

    ctx.translate(
        v.left,
        v.top
    );

    ctx.fillStyle =
        styles
            .getPropertyValue(
                '--panel-bg'
            )
            .trim() ||
        '#151a1d';

    ctx.fillRect(
        0,
        0,
        v.mw,
        v.mh
    );

    const currentMap =
        getCurrentMap();

    const currentWeapon =
        WEAPONS[S.weapon] || null;

    /*
     * Layer 1:
     * base map tiles.
     */
    if (
        currentMap?.tiles &&
        isMapLayerVisible('tiles')
    ) {

        drawTileMap(
            currentMap
        );

        /*
         * Color tiles are intentionally dimmed slightly so tactical
         * overlays stay readable over bright/saturated terrain imagery.
         * Keep this below contours, grid, zones, drawings and artillery
         * so only the map artwork itself is darkened.
         */
        if (S.mapStyle === 'color') {
            ctx.save();
            ctx.fillStyle =
                'rgba(0,0,0,.20)';
            ctx.fillRect(
                0,
                0,
                v.mw,
                v.mh
            );
            ctx.restore();
        }
    }

    /*
     * Layer 2:
     * terrain contours, above the tiles they describe and below
     * everything drawn on top of the ground.
     */
    if (isMapLayerVisible('contours')) {
        drawContours(currentMap);
    }

    /*
     * Layer 3:
     * coordinate grid.
     */
    if (isMapLayerVisible('grid')) {
        drawGrid();
        drawCoordinateLabels();
    }

    drawSelectedControlZone(currentMap, styles);

    /*
     * Layer 4:
     * circular zones.
     */
    if (isMapLayerVisible('zones')) {
        drawPresetZones(currentMap);
        drawMapToolZones();
    }

    /*
     * Layer 5:
     * arbitrary polygons.
     */
    if (isMapLayerVisible('polygons')) {
        drawPresetPolygons(currentMap);
        drawMapToolPolygons();
    }

    /*
     * User pencil drawings are persistent
     * map annotations and live below the
     * artillery solution overlays.
     */
    if (isMapLayerVisible('drawings')) {
        drawMapToolDrawings();
    }

    if (
        isMapLayerVisible('artillery') &&
        currentWeapon
    ) {
        const a =
            worldToLocalScreen(
                S.origin.x,
                S.origin.y
            );

        const b =
            worldToLocalScreen(
                S.target.x,
                S.target.y
            );

        const maxRange =
            currentWeapon.maxRange ??
            currentWeapon.range;

        const minRange =
            currentWeapon.minRange ??
            0;

        const rangePx =
            kilometersToWorldDistance(maxRange) *
            v.scale;

        const minRangePx =
            kilometersToWorldDistance(minRange) *
            v.scale;

        /*
         * Layer 6:
         * artillery range.
         */
        ctx.beginPath();

        ctx.arc(
            a.x,
            a.y,
            rangePx,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            'rgba(215,164,82,.08)';

        ctx.fill();

        ctx.strokeStyle =
            '#d7a452';

        ctx.lineWidth =
            2;

        ctx.setLineDash([
            7,
            5
        ]);

        ctx.stroke();

        ctx.setLineDash([]);

        if (minRangePx > 0) {
            ctx.beginPath();

            ctx.arc(
                a.x,
                a.y,
                minRangePx,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                '#d86666';

            ctx.lineWidth =
                1.5;

            ctx.setLineDash([
                4,
                4
            ]);

            ctx.stroke();
            ctx.setLineDash([]);
        }

        /*
         * Layer 7:
         * origin -> target line.
         */
        ctx.strokeStyle =
            '#d7a452';

        ctx.lineWidth =
            2;

        ctx.setLineDash([
            8,
            6
        ]);

        ctx.beginPath();

        ctx.moveTo(
            a.x,
            a.y
        );

        ctx.lineTo(
            b.x,
            b.y
        );

        ctx.stroke();

        ctx.setLineDash([]);

        /*
         * Layer 8:
         * artillery / target markers.
         */
        if (
            typeof drawSphDispersionOverlay ===
                'function'
        ) {
            drawSphDispersionOverlay();
        }

        marker(
            S.origin,
            'O'
        );

        marker(
            S.target,
            'T'
        );

    }

    /*
     * Fire-adjustment ghost/impact overlay sits on top of the artillery
     * markers and below preset icons.
     */
    if (
        isMapLayerVisible('artillery') &&
        typeof drawFireAdjustmentOverlay ===
            'function'
    ) {
        drawFireAdjustmentOverlay();
    }

    /*
     * Other lobby participants expose only their personal origin and
     * target markers. Their range circles are deliberately never drawn.
     */
    if (
        isMapLayerVisible('artillery') &&
        lobby?.active
    ) {
        lobby.drawPeers();
    }

    /*
     * Layer 9:
     * preset icons are ALWAYS drawn last.
     *
     * This prevents tiles, grid, zones,
     * polygons and artillery overlays from
     * covering map icons.
     */
    if (isMapLayerVisible('presetMarkers')) {
        drawPresetMarkers(currentMap);
    }

    /*
     * User-placed markers and transient
     * tool UI are rendered on top.
     */
    if (isMapLayerVisible('userMarkers')) {
        drawMapToolMarkers();
    }
    drawMapToolTransient();

    ctx.restore();

    result();
}

;

/* js/features/coordinates.js */
/* =========================
   COORDINATE COPY / PASTE
   ========================= */

const COORDINATE_FEEDBACK_DELAY = 1100;

function parseSharedCoordinates(value) {
    const text = String(value ?? '').trim();

    if (!text) {
        return null;
    }

    const numberPattern =
        '[+-]?\\d+(?:[\\.,]\\d+)?';

    const xMatch = text.match(
        new RegExp(
            `(?:^|[^a-z])x\\s*[:=]?\\s*(${numberPattern})`,
            'i'
        )
    );

    const yMatch = text.match(
        new RegExp(
            `(?:^|[^a-z])y\\s*[:=]?\\s*(${numberPattern})`,
            'i'
        )
    );

    const parseNumber = raw =>
        Number(
            String(raw)
                .replace(',', '.')
        );

    if (xMatch && yMatch) {
        const x = parseNumber(xMatch[1]);
        const y = parseNumber(yMatch[1]);

        return (
            Number.isFinite(x) &&
            Number.isFinite(y)
        )
            ? { x, y }
            : null;
    }

    const numbers = text.match(
        new RegExp(numberPattern, 'g')
    );

    if (!numbers || numbers.length !== 2) {
        return null;
    }

    const x = parseNumber(numbers[0]);
    const y = parseNumber(numbers[1]);

    return (
        Number.isFinite(x) &&
        Number.isFinite(y)
    )
        ? { x, y }
        : null;
}

function getSharedCoordinateText(type) {
    const point = S[type];

    if (!point) {
        return '';
    }

    return (
        `x${formatGameCoordinate(point.x)}, ` +
        `y${formatGameCoordinate(point.y)}`
    );
}

function coordinateActionButton(type, action) {
    const prefix =
        type === 'origin'
            ? 'Origin'
            : 'Target';

    const suffix =
        action === 'copy'
            ? 'Copy'
            : 'Paste';

    return $(`coordinate${prefix}${suffix}`);
}

function flashCoordinateAction(
    type,
    action,
    key
) {
    const button =
        coordinateActionButton(
            type,
            action
        );

    if (!button) {
        return;
    }

    button.textContent = tr(key);

    window.setTimeout(
        () => {
            if (!button.isConnected) {
                return;
            }

            button.textContent = tr(
                action === 'copy'
                    ? 'copyCoordinates'
                    : 'pasteCoordinates'
            );
        },
        COORDINATE_FEEDBACK_DELAY
    );
}

async function copyPointCoordinates(type) {
    const text =
        getSharedCoordinateText(type);

    if (!text) {
        return;
    }

    try {
        if (
            !navigator.clipboard ||
            typeof navigator.clipboard.writeText !== 'function'
        ) {
            throw new Error(
                'Clipboard write is unavailable'
            );
        }

        await navigator.clipboard.writeText(text);

        flashCoordinateAction(
            type,
            'copy',
            'coordinatesCopied'
        );

    } catch (_) {
        window.prompt(
            tr('copyCoordinatesPrompt'),
            text
        );
    }
}

async function readCoordinateClipboard() {
    if (
        navigator.clipboard &&
        typeof navigator.clipboard.readText === 'function'
    ) {
        try {
            const value =
                await navigator.clipboard.readText();

            if (value) {
                return value;
            }
        } catch (_) {
            // Fall back to a manual paste prompt below.
        }
    }

    return window.prompt(
        tr('pasteCoordinatesPrompt'),
        ''
    );
}

function applySharedCoordinates(
    type,
    coordinates
) {
    if (!coordinates) {
        return false;
    }

    const xInput =
        type === 'origin'
            ? $('ox')
            : $('tx');

    const yInput =
        type === 'origin'
            ? $('oy')
            : $('ty');

    if (!xInput || !yInput) {
        return false;
    }

    xInput.value = coordinates.x;
    yInput.value = coordinates.y;

    inputPoint(type);

    renderSavedTargets();

    return true;
}

async function pastePointCoordinates(type) {
    const text = await readCoordinateClipboard();

    if (text === null) {
        return;
    }

    const coordinates =
        parseSharedCoordinates(text);

    if (!coordinates) {
        flashCoordinateAction(
            type,
            'paste',
            'invalidCoordinates'
        );
        return;
    }

    if (
        applySharedCoordinates(
            type,
            coordinates
        )
    ) {
        flashCoordinateAction(
            type,
            'paste',
            'coordinatesPasted'
        );
    }
}

;

/* js/features/point-locks.js */
/* =========================
   POINT MAP LOCKS
   ========================= */

const POINT_MAP_LOCKS = {
    origin: false,
    target: false
};

function isPointMapLocked(type) {
    return Boolean(
        POINT_MAP_LOCKS[type]
    );
}

function setPointMapLocked(type, locked) {
    if (!(type in POINT_MAP_LOCKS)) {
        return;
    }

    POINT_MAP_LOCKS[type] =
        Boolean(locked);

    updatePointLocksUI();
    draw();
}

function togglePointMapLock(type) {
    setPointMapLocked(
        type,
        !isPointMapLocked(type)
    );
}

function updatePointLocksUI() {
    [
        ['origin', 'coordinateOriginLock', 'originMode'],
        ['target', 'coordinateTargetLock', 'targetMode']
    ].forEach(
        ([type, buttonId, modeId]) => {
            const locked =
                isPointMapLocked(type);

            const button = $(buttonId);
            const modeButton = $(modeId);

            if (button) {
                const actionLabel = tr(
                    locked
                        ? 'unlockPosition'
                        : 'lockPosition'
                );

                button.textContent = '';

                button.classList.toggle(
                    'active',
                    locked
                );

                button.setAttribute(
                    'aria-pressed',
                    locked
                        ? 'true'
                        : 'false'
                );

                button.setAttribute(
                    'aria-label',
                    actionLabel
                );

                button.title = tr(
                    locked
                        ? 'unlockPositionHint'
                        : 'lockPositionHint'
                );
            }

            modeButton?.classList.toggle(
                'point-map-locked',
                locked
            );
        }
    );
}

;

/* js/features/fire-adjustment.js */
/* =========================
   FIRE ADJUSTMENT
   ========================= */

/*
 * Closes the observe -> correct loop. A miss is entered either as a
 * correction relative to the artillery -> target line ("add 50, right 20",
 * as seen from the artillery position) or as the observed impact point.
 * Either way the aim point moves by the inverse of the miss, through the
 * same snapshot -> mutate -> clamp -> inputs() path as every other target
 * writer, so undo, persistence, locks and lobby presence need no extra work.
 */

const FIRE_ADJUSTMENT_FEEDBACK_DELAY = 1100;

const FIRE_ADJUSTMENT_DEFAULT_STEP = 50;

/* A single correction is capped well beyond any in-game engagement range. */
const FIRE_ADJUSTMENT_MAX_STEP = 100000;

const FIRE_ADJUSTMENT_STATE = {
    /* One-shot map pick armed by "Mark impact on map". */
    picking: false,

    /* Distance one arrow press adds to the staged correction, in meters. */
    step: FIRE_ADJUSTMENT_DEFAULT_STEP,

    /*
     * Correction staged by the arrow pad, in meters, positive = add / right.
     * Arrow presses accumulate here so that a combined correction such as
     * "add 50, right 20" is built up before it is committed by Apply.
     */
    draft: {
        rangeMeters: 0,
        deflectionMeters: 0
    },

    /*
     * Last applied correction, kept for the map overlay and the status line.
     * Cleared as soon as the target moves by any other means.
     */
    last: null
};

/*
 * Unit vectors of the artillery -> target line in world units.
 * `along` points from the artillery towards the target, `right` is the
 * clockwise perpendicular, i.e. to the right when looking from the artillery
 * at the target. With +X east and +Y north that is (dy, -dx).
 * A zero-length line falls back to north/east, which matches the 0° azimuth
 * the result panel shows for that case.
 */
function fireAdjustmentAxes() {
    const dx =
        S.target.x -
        S.origin.x;

    const dy =
        S.target.y -
        S.origin.y;

    const length =
        Math.hypot(dx, dy);

    if (length === 0) {
        return {
            along: { x: 0, y: 1 },
            right: { x: 1, y: 0 }
        };
    }

    return {
        along: {
            x: dx / length,
            y: dy / length
        },
        right: {
            x: dy / length,
            y: -dx / length
        }
    };
}

/*
 * Step distance currently typed into the centre of the arrow pad. The state
 * copy survives popover rebuilds (language switch, first open).
 */
function readFireAdjustmentStep() {
    const input =
        $('fireAdjustmentStep');

    if (!input) {
        return FIRE_ADJUSTMENT_STATE.step;
    }

    const value =
        Number(
            String(input.value)
                .replace(',', '.')
        );

    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return 0;
    }

    return Math.min(
        Math.abs(value),
        FIRE_ADJUSTMENT_MAX_STEP
    );
}

/*
 * Staged correction in signed meters:
 * positive range = add (farther), positive deflection = right.
 */
function readFireAdjustmentCorrection() {
    return {
        rangeMeters:
            FIRE_ADJUSTMENT_STATE.draft.rangeMeters,
        deflectionMeters:
            FIRE_ADJUSTMENT_STATE.draft.deflectionMeters
    };
}

function clearFireAdjustmentDraft() {
    FIRE_ADJUSTMENT_STATE.draft = {
        rangeMeters: 0,
        deflectionMeters: 0
    };

    updateFireAdjustmentUI();
}

/*
 * One arrow press. `axis` is 'range' (add/drop) or 'deflection'
 * (right/left), `sign` is +1 for add/right. Presses accumulate, so the
 * opposite arrow walks the staged value back and ↑↑ stages two steps.
 */
function nudgeFireAdjustment(axis, sign) {
    const step =
        readFireAdjustmentStep();

    if (!step) {
        $('fireAdjustmentStep')?.focus();
        return;
    }

    FIRE_ADJUSTMENT_STATE.step = step;

    const key =
        axis === 'range'
            ? 'rangeMeters'
            : 'deflectionMeters';

    const next =
        FIRE_ADJUSTMENT_STATE.draft[key] +
        sign * step;

    FIRE_ADJUSTMENT_STATE.draft[key] =
        Math.max(
            -FIRE_ADJUSTMENT_MAX_STEP,
            Math.min(
                FIRE_ADJUSTMENT_MAX_STEP,
                next
            )
        );

    updateFireAdjustmentUI();
}

/*
 * Moves the target by a world-unit delta. Returns false when nothing
 * changed so callers can skip feedback and history.
 * The status line is derived from the delta that was actually applied,
 * so a correction truncated by the map bounds is reported truthfully.
 */
function shiftFireAdjustmentTarget(delta, mode, impact) {
    if (
        !Number.isFinite(delta.x) ||
        !Number.isFinite(delta.y) ||
        (delta.x === 0 && delta.y === 0)
    ) {
        return false;
    }

    const axes =
        fireAdjustmentAxes();

    const previousTarget = {
        x: S.target.x,
        y: S.target.y
    };

    pushMapToolHistory();

    S.target = {
        x: previousTarget.x + delta.x,
        y: previousTarget.y + delta.y
    };

    clamp(S.target);

    const appliedX =
        S.target.x - previousTarget.x;

    const appliedY =
        S.target.y - previousTarget.y;

    FIRE_ADJUSTMENT_STATE.last = {
        mode,
        impact,
        rangeMeters:
            worldDistanceToMeters(
                appliedX * axes.along.x +
                appliedY * axes.along.y
            ),
        deflectionMeters:
            worldDistanceToMeters(
                appliedX * axes.right.x +
                appliedY * axes.right.y
            ),
        mapId: S.map,
        previousTarget,
        appliedTarget: {
            x: S.target.x,
            y: S.target.y
        }
    };

    if (
        typeof requestTerrainBallisticsForCurrentState ===
            'function'
    ) {
        requestTerrainBallisticsForCurrentState();
    }

    inputs();

    renderSavedTargets();

    if (
        typeof trackAnalytics ===
        'function'
    ) {
        trackAnalytics(
            'fire-adjusted',
            {
                map: S.map,
                weapon: S.weapon,
                mode
            }
        );
    }

    return true;
}

function applyFireAdjustmentCorrection() {
    const {
        rangeMeters,
        deflectionMeters
    } = readFireAdjustmentCorrection();

    if (
        rangeMeters === 0 &&
        deflectionMeters === 0
    ) {
        flashFireAdjustmentButton(
            'fireAdjustmentApply',
            'fireAdjustmentNoChange',
            'fireAdjustmentApply'
        );
        return false;
    }

    const axes =
        fireAdjustmentAxes();

    const along =
        metersToWorldDistance(rangeMeters);

    const right =
        metersToWorldDistance(deflectionMeters);

    const applied =
        shiftFireAdjustmentTarget(
            {
                x: axes.along.x * along + axes.right.x * right,
                y: axes.along.y * along + axes.right.y * right
            },
            'correction',
            null
        );

    if (applied) {
        clearFireAdjustmentDraft();

        flashFireAdjustmentButton(
            'fireAdjustmentApply',
            'fireAdjustmentApplied',
            'fireAdjustmentApply'
        );
    }

    return applied;
}

/*
 * The round landed at `impact` while aiming at the current target, so the
 * aim point moves by (target - impact). A measured impact supersedes
 * anything staged on the arrow pad, so the staged correction is dropped.
 */
function applyFireAdjustmentImpact(impact) {
    const applied =
        shiftFireAdjustmentTarget(
            {
                x: S.target.x - impact.x,
                y: S.target.y - impact.y
            },
            'impact',
            {
                x: impact.x,
                y: impact.y
            }
        );

    if (applied) {
        clearFireAdjustmentDraft();
    }

    return applied;
}

/*
 * Shared coordinates arrive in the same units as the coordinate inputs:
 * game units on 100 m/unit maps, meters everywhere else (see inputPoint).
 */
function sharedCoordinatesToWorld(coordinates) {
    const scale =
        getCoordinateMetersPerUnit();

    return scale === 100
        ? { x: coordinates.x, y: coordinates.y }
        : {
            x: coordinates.x / 1000,
            y: coordinates.y / 1000
        };
}

async function pasteFireAdjustmentImpact() {
    const text =
        await readCoordinateClipboard();

    if (text === null) {
        return;
    }

    const coordinates =
        parseSharedCoordinates(text);

    if (!coordinates) {
        flashFireAdjustmentButton(
            'fireAdjustmentPasteImpact',
            'invalidCoordinates',
            'fireAdjustmentPasteImpact'
        );
        return;
    }

    const impact =
        sharedCoordinatesToWorld(coordinates);

    if (!isWorldPointInsideMap(impact)) {
        flashFireAdjustmentButton(
            'fireAdjustmentPasteImpact',
            'invalidCoordinates',
            'fireAdjustmentPasteImpact'
        );
        return;
    }

    if (applyFireAdjustmentImpact(impact)) {
        flashFireAdjustmentButton(
            'fireAdjustmentPasteImpact',
            'fireAdjustmentApplied',
            'fireAdjustmentPasteImpact'
        );
    }
}


/* =========================
   MAP PICK
   ========================= */

function isFireAdjustmentPickArmed() {
    return FIRE_ADJUSTMENT_STATE.picking;
}

function setFireAdjustmentPick(armed) {
    const next =
        Boolean(armed);

    if (FIRE_ADJUSTMENT_STATE.picking === next) {
        return;
    }

    FIRE_ADJUSTMENT_STATE.picking = next;

    if (
        next &&
        typeof setMobileSheetOpen === 'function'
    ) {
        /* The map has to be visible to tap on it. */
        setMobileSheetOpen(false);
    }

    updateFireAdjustmentUI();
}

function cancelFireAdjustmentPick() {
    if (!FIRE_ADJUSTMENT_STATE.picking) {
        return false;
    }

    setFireAdjustmentPick(false);
    return true;
}

/*
 * Called from the canvas pointer handlers with the world point under the
 * pointer. Returns true when the event was consumed by the pick, so the
 * caller must not place a point or start a drag.
 */
function handleFireAdjustmentMapPick(world) {
    if (!FIRE_ADJUSTMENT_STATE.picking) {
        return false;
    }

    if (
        !world ||
        !isWorldPointInsideMap(world)
    ) {
        return true;
    }

    setFireAdjustmentPick(false);

    applyFireAdjustmentImpact(world);

    return true;
}


/* =========================
   UI
   ========================= */

function flashFireAdjustmentButton(
    buttonId,
    key,
    restoreKey
) {
    const button = $(buttonId);

    if (!button) {
        return;
    }

    button.textContent = tr(key);

    window.setTimeout(
        () => {
            if (!button.isConnected) {
                return;
            }

            button.textContent = tr(restoreKey);
        },
        FIRE_ADJUSTMENT_FEEDBACK_DELAY
    );
}

function formatFireAdjustmentSummary(last) {
    const parts = [];

    const range =
        Math.round(Math.abs(last.rangeMeters));

    const deflection =
        Math.round(Math.abs(last.deflectionMeters));

    if (range > 0) {
        parts.push(
            `${tr(
                last.rangeMeters > 0
                    ? 'fireAdjustmentAdd'
                    : 'fireAdjustmentDrop'
            )} ${range} m`
        );
    }

    if (deflection > 0) {
        parts.push(
            `${tr(
                last.deflectionMeters > 0
                    ? 'fireAdjustmentRight'
                    : 'fireAdjustmentLeft'
            )} ${deflection} m`
        );
    }

    if (!parts.length) {
        parts.push(
            `${tr('fireAdjustmentAdd')} 0 m`
        );
    }

    return parts.join(' · ');
}

/*
 * The overlay and status line describe the current target only while the
 * target is still where the correction put it.
 */
function getActiveFireAdjustment() {
    const last =
        FIRE_ADJUSTMENT_STATE.last;

    if (!last) {
        return null;
    }

    if (
        last.mapId !== S.map ||
        last.appliedTarget.x !== S.target.x ||
        last.appliedTarget.y !== S.target.y
    ) {
        FIRE_ADJUSTMENT_STATE.last = null;
        return null;
    }

    return last;
}

function ensureFireAdjustmentBanner() {
    let banner =
        $('fireAdjustmentBanner');

    if (banner) {
        return banner;
    }

    const map =
        document.querySelector('.map');

    if (!map) {
        return null;
    }

    banner =
        document.createElement('div');

    banner.id =
        'fireAdjustmentBanner';

    banner.className =
        'fire-adjustment-banner';

    banner.hidden = true;

    banner.setAttribute(
        'role',
        'status'
    );

    const text =
        document.createElement('span');

    text.className =
        'fire-adjustment-banner-text';

    const cancel =
        document.createElement('button');

    cancel.type =
        'button';

    cancel.className =
        'fire-adjustment-banner-cancel';

    cancel.addEventListener(
        'click',
        () => cancelFireAdjustmentPick()
    );

    banner.append(
        text,
        cancel
    );

    map.appendChild(banner);

    return banner;
}

/*
 * Toolbar button and popover are injected at runtime, the way the shape and
 * history tools are, so the feature needs no markup in the page shells.
 */
function ensureFireAdjustmentTool() {
    const bar =
        document.querySelector(
            '.map-tools-bar'
        );

    if (!bar) {
        return null;
    }

    let popover =
        $('fireAdjustmentPopover');

    if (!popover) {
        popover =
            document.createElement('div');

        popover.id =
            'fireAdjustmentPopover';

        popover.className =
            'map-tool-popover map-tool-fire-adjustment';

        bar.before(popover);
    }

    if (!$('mapToolFireAdjustment')) {
        const button =
            document.createElement('button');

        button.type = 'button';

        button.id =
            'mapToolFireAdjustment';

        button.className =
            'map-tool-button';

        button.dataset.tool =
            'fireAdjust';

        button.innerHTML = `
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="10" cy="14" r="5.5"/>
                <path d="M10 6v2.5M10 19.5V17M2.5 14H5M17.5 14H15"/>
                <path d="m14.5 9.5 5-5"/>
                <path d="M15.5 4h4v4"/>
            </svg>
        `;

        button.addEventListener(
            'click',
            event => {
                event.stopPropagation();
                toggleFireAdjustmentTool();
            }
        );

        bar.insertBefore(
            button,
            $('mapToolCoordinateSearch') ||
            null
        );
    }

    return popover;
}

function createFireAdjustmentNudge(
    axis,
    sign,
    direction,
    glyph
) {
    const button =
        document.createElement('button');

    button.type = 'button';

    button.className =
        `fire-adjustment-nudge fire-adjustment-nudge-${direction}`;

    button.dataset.axis = axis;

    button.dataset.sign =
        String(sign);

    const label =
        tr(
            `fireAdjustment${
                direction.charAt(0).toUpperCase()
            }${
                direction.slice(1)
            }`
        );

    button.setAttribute(
        'aria-label',
        label
    );

    button.title = label;

    button.innerHTML = `
        <span class="fire-adjustment-nudge-glyph" aria-hidden="true">${glyph}</span>
        <span class="fire-adjustment-nudge-label"></span>
    `;

    setText(
        button.querySelector('.fire-adjustment-nudge-label'),
        label
    );

    button.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            nudgeFireAdjustment(
                axis,
                sign
            );
        }
    );

    return button;
}

function createFireAdjustmentStepField() {
    const input =
        document.createElement('input');

    input.id =
        'fireAdjustmentStep';

    input.className =
        'fire-adjustment-step';

    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.inputMode = 'decimal';

    input.value =
        String(
            FIRE_ADJUSTMENT_STATE.step
        );

    const label =
        tr('fireAdjustmentStep');

    input.setAttribute(
        'aria-label',
        label
    );

    input.title = label;

    input.addEventListener(
        'input',
        () => {
            const step =
                readFireAdjustmentStep();

            if (step) {
                FIRE_ADJUSTMENT_STATE.step =
                    step;
            }
        }
    );

    input.addEventListener(
        'keydown',
        event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyFireAdjustmentCorrection();
            }
        }
    );

    const field =
        document.createElement('div');

    field.className =
        'fire-adjustment-step-field';

    const unit =
        document.createElement('span');

    unit.className =
        'fire-adjustment-step-unit';

    unit.setAttribute(
        'aria-hidden',
        'true'
    );

    unit.textContent = 'm';

    field.append(
        input,
        unit
    );

    return field;
}

function createFireAdjustmentButton(
    id,
    key,
    className,
    handler
) {
    const button =
        document.createElement('button');

    button.type = 'button';
    button.id = id;

    if (className) {
        button.className = className;
    }

    setText(
        button,
        tr(key)
    );

    button.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            handler();
        }
    );

    return button;
}

/*
 * Rebuilt on language change, like the other map-tool popovers.
 */
function buildFireAdjustmentPopover() {
    const popover =
        ensureFireAdjustmentTool();

    if (!popover) {
        return;
    }

    popover.replaceChildren();

    const title =
        document.createElement('div');

    title.className =
        'map-tool-popover-title';

    setText(
        title,
        tr('fireAdjustment')
    );

    /*
     * The pad reads like a fire order: the vertical axis is range, the
     * horizontal one deflection, and the centre holds the distance that one
     * arrow press stages.
     */
    const pad =
        document.createElement('div');

    pad.className =
        'fire-adjustment-pad';

    pad.setAttribute(
        'role',
        'group'
    );

    pad.setAttribute(
        'aria-label',
        tr('fireAdjustment')
    );

    pad.append(
        createFireAdjustmentNudge(
            'range',
            1,
            'add',
            '&#8593;'
        ),
        createFireAdjustmentNudge(
            'deflection',
            -1,
            'left',
            '&#8592;'
        ),
        createFireAdjustmentStepField(),
        createFireAdjustmentNudge(
            'deflection',
            1,
            'right',
            '&#8594;'
        ),
        createFireAdjustmentNudge(
            'range',
            -1,
            'drop',
            '&#8595;'
        )
    );

    const draft =
        document.createElement('div');

    draft.id =
        'fireAdjustmentDraft';

    draft.className =
        'fire-adjustment-draft';

    draft.hidden = true;

    const draftText =
        document.createElement('span');

    draftText.className =
        'fire-adjustment-draft-text';

    const clearLabel =
        tr('fireAdjustmentClear');

    const draftClear =
        createFireAdjustmentButton(
            'fireAdjustmentClear',
            'fireAdjustmentClear',
            'fire-adjustment-draft-clear',
            clearFireAdjustmentDraft
        );

    /* Icon-only button: the label lives in the accessible name. */
    draftClear.innerHTML =
        '<span aria-hidden="true">&#10005;</span>';

    draftClear.setAttribute(
        'aria-label',
        clearLabel
    );

    draftClear.title =
        clearLabel;

    draft.append(
        draftText,
        draftClear
    );

    const impactActions =
        document.createElement('div');

    impactActions.className =
        'fire-adjustment-impact-actions';

    const pick =
        createFireAdjustmentButton(
            'fireAdjustmentPick',
            'fireAdjustmentMarkImpact',
            '',
            () => setFireAdjustmentPick(
                !FIRE_ADJUSTMENT_STATE.picking
            )
        );

    pick.setAttribute(
        'aria-pressed',
        'false'
    );

    impactActions.append(
        pick,
        createFireAdjustmentButton(
            'fireAdjustmentPasteImpact',
            'fireAdjustmentPasteImpact',
            '',
            pasteFireAdjustmentImpact
        )
    );

    const status =
        document.createElement('div');

    status.id =
        'fireAdjustmentLast';

    status.className =
        'hint fire-adjustment-last';

    status.hidden = true;

    const hint =
        document.createElement('p');

    hint.className = 'hint';

    setText(
        hint,
        tr('fireAdjustmentHint')
    );

    popover.append(
        title,
        pad,
        draft,
        createFireAdjustmentButton(
            'fireAdjustmentApply',
            'fireAdjustmentApply',
            'fire-adjustment-apply',
            applyFireAdjustmentCorrection
        ),
        impactActions,
        status,
        hint
    );

    updateFireAdjustmentUI();
}

/*
 * Opening the tool arms the impact pick, because the usual sequence right
 * after a shot is "open, click where it landed". Closing it disarms again;
 * the pad stays usable while the pick is armed.
 */
function toggleFireAdjustmentTool() {
    setMapTool(
        'fireAdjust'
    );

    buildFireAdjustmentPopover();

    toggleMapToolMenu(
        'fireAdjustmentPopover'
    );

    setFireAdjustmentPick(
        isMapToolMenuOpen(
            'fireAdjustmentPopover'
        )
    );
}

function updateFireAdjustmentUI() {
    const picking =
        FIRE_ADJUSTMENT_STATE.picking;

    const pickButton =
        $('fireAdjustmentPick');

    if (pickButton) {
        pickButton.classList.toggle(
            'active',
            picking
        );

        pickButton.setAttribute(
            'aria-pressed',
            picking
                ? 'true'
                : 'false'
        );
    }

    const banner =
        ensureFireAdjustmentBanner();

    if (banner) {
        if (banner.hidden === picking) {
            banner.hidden = !picking;
        }

        if (picking) {
            setText(
                banner.querySelector('.fire-adjustment-banner-text'),
                tr('fireAdjustmentPickHint')
            );

            setText(
                banner.querySelector('.fire-adjustment-banner-cancel'),
                tr('fireAdjustmentPickCancel')
            );
        }
    }

    const drafted =
        FIRE_ADJUSTMENT_STATE.draft;

    const staged =
        drafted.rangeMeters !== 0 ||
        drafted.deflectionMeters !== 0;

    const draftLine =
        $('fireAdjustmentDraft');

    if (draftLine) {
        if (staged) {
            setText(
                draftLine.querySelector('.fire-adjustment-draft-text'),
                `${tr('fireAdjustmentPending')}: ${formatFireAdjustmentSummary(drafted)}`
            );
        }

        if (draftLine.hidden !== !staged) {
            draftLine.hidden = !staged;
        }
    }

    document
        .querySelectorAll('.fire-adjustment-nudge')
        .forEach(button => {
            const value =
                button.dataset.axis === 'range'
                    ? drafted.rangeMeters
                    : drafted.deflectionMeters;

            const active =
                value !== 0 &&
                Math.sign(value) ===
                Number(button.dataset.sign);

            button.classList.toggle(
                'active',
                active
            );
        });

    const status =
        $('fireAdjustmentLast');

    if (status) {
        const last =
            getActiveFireAdjustment();

        if (last) {
            setText(
                status,
                `${tr('fireAdjustmentLast')}: ${formatFireAdjustmentSummary(last)}`
            );
        }

        if (status.hidden !== !last) {
            status.hidden = !last;
        }
    }
}

function bindFireAdjustment() {
    buildFireAdjustmentPopover();
}


/* =========================
   MAP OVERLAY
   ========================= */

/*
 * Ghost of the previous aim point, the observed impact when one was marked,
 * and the shift that the correction applied. Drawn between the artillery
 * markers and the preset icons.
 */
function drawFireAdjustmentOverlay() {
    const last =
        getActiveFireAdjustment();

    if (!last) {
        return;
    }

    const previous =
        worldToLocalScreen(
            last.previousTarget.x,
            last.previousTarget.y
        );

    const current =
        worldToLocalScreen(
            S.target.x,
            S.target.y
        );

    ctx.save();

    ctx.strokeStyle =
        'rgba(216,102,102,.85)';

    ctx.lineWidth =
        1.5;

    ctx.setLineDash([
        3,
        4
    ]);

    ctx.beginPath();

    if (last.impact) {
        const impact =
            worldToLocalScreen(
                last.impact.x,
                last.impact.y
            );

        ctx.moveTo(
            impact.x,
            impact.y
        );

        ctx.lineTo(
            previous.x,
            previous.y
        );
    }

    ctx.moveTo(
        previous.x,
        previous.y
    );

    ctx.lineTo(
        current.x,
        current.y
    );

    ctx.stroke();

    ctx.setLineDash([]);

    /* Previous aim point: hollow ring. */
    ctx.beginPath();

    ctx.arc(
        previous.x,
        previous.y,
        7,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    if (last.impact) {
        const impact =
            worldToLocalScreen(
                last.impact.x,
                last.impact.y
            );

        /* Impact: cross with a label. */
        ctx.lineWidth =
            2;

        ctx.beginPath();

        ctx.moveTo(
            impact.x - 6,
            impact.y - 6
        );

        ctx.lineTo(
            impact.x + 6,
            impact.y + 6
        );

        ctx.moveTo(
            impact.x + 6,
            impact.y - 6
        );

        ctx.lineTo(
            impact.x - 6,
            impact.y + 6
        );

        ctx.stroke();

        ctx.fillStyle =
            'rgba(216,102,102,.95)';

        const labelScale =
            typeof getMapLabelAccessibilityScale === 'function'
                ? getMapLabelAccessibilityScale()
                : 1;

        ctx.font =
            `bold ${10 * labelScale}px system-ui`;

        ctx.textAlign =
            'center';

        ctx.textBaseline =
            'top';

        ctx.fillText(
            tr('fireAdjustmentImpactLabel'),
            impact.x,
            impact.y + 9
        );
    }

    ctx.restore();
}

;

/* js/features/reload-trainer.js */
/* =========================
   ACTIVE RELOAD TRAINER
   ========================= */

const RELOAD_TRAINER_KEYS = ['w', 'a', 's', 'd'];
const RELOAD_TRAINER_SECTIONS = 4;
const RELOAD_TRAINER_SEQUENCE_LENGTH = 4;
const RELOAD_TRAINER_SECTION_MS = 6500;
const RELOAD_TRAINER_STORAGE_KEY = 'wardogs-reload-trainer-best-v1';
const RELOAD_TRAINER_FAILURE_DELAY = 450;

function createReloadTrainerSession({
    now = () => performance.now(),
    random = Math.random,
    bestTimeMs = null
} = {}) {
    const state = {
        phase: 'idle', sequence: [], inputIndex: 0, sections: 0,
        startedAt: null, sectionStartedAt: null, elapsedMs: 0, bestTimeMs, streak: 0
    };

    function nextSequence() {
        state.inputIndex = 0;
        state.sequence = Array.from({ length: RELOAD_TRAINER_SEQUENCE_LENGTH },
            () => RELOAD_TRAINER_KEYS[Math.floor(random() * RELOAD_TRAINER_KEYS.length)]);
    }

    function elapsed() {
        return state.phase === 'playing'
            ? Math.max(0, now() - state.startedAt) : state.elapsedMs;
    }

    function sectionProgress() {
        return state.phase === 'playing'
            ? Math.max(0, Math.min(1, (now() - state.sectionStartedAt) / RELOAD_TRAINER_SECTION_MS))
            : 0;
    }

    function start() {
        if (state.phase === 'playing') state.streak = 0;
        state.phase = 'playing';
        state.sections = 0;
        state.startedAt = now();
        state.sectionStartedAt = state.startedAt;
        state.elapsedMs = 0;
        nextSequence();
    }

    function finishSection(completedAt) {
        state.elapsedMs = Math.max(0, completedAt - state.startedAt);
        state.sections++;
        state.sectionStartedAt = completedAt;
        if (state.sections < RELOAD_TRAINER_SECTIONS) {
            nextSequence();
            return 'section';
        }
        state.inputIndex = RELOAD_TRAINER_SEQUENCE_LENGTH;
        state.phase = 'complete';
        state.streak++;
        if (state.bestTimeMs === null || state.elapsedMs < state.bestTimeMs) {
            state.bestTimeMs = state.elapsedMs;
        }
        return 'complete';
    }

    function advance() {
        if (state.phase !== 'playing') return 'ignored';
        const timestamp = now();
        let result = 'waiting';
        while (state.phase === 'playing'
            && timestamp - state.sectionStartedAt >= RELOAD_TRAINER_SECTION_MS) {
            // Keep the exact deadline when a frame arrives late; do not accumulate frame drift.
            result = finishSection(state.sectionStartedAt + RELOAD_TRAINER_SECTION_MS);
        }
        return result;
    }

    function press(key) {
        if (state.phase !== 'playing' || !RELOAD_TRAINER_KEYS.includes(key)) return 'ignored';
        const transition = advance();
        // Do not judge a key against a replacement sequence that has not been displayed yet.
        if (transition !== 'waiting') return transition;
        state.elapsedMs = elapsed();
        if (key !== state.sequence[state.inputIndex]) {
            state.phase = 'failed';
            state.sections = 0;
            state.streak = 0;
            return 'failed';
        }
        state.inputIndex++;
        return state.inputIndex < RELOAD_TRAINER_SEQUENCE_LENGTH
            ? 'correct' : finishSection(now());
    }

    function interrupt() {
        if (!['playing', 'failed'].includes(state.phase)) return;
        state.elapsedMs = elapsed();
        state.phase = 'interrupted';
        state.sections = 0;
        state.inputIndex = 0;
        state.streak = 0;
    }

    return { state, start, press, elapsed, sectionProgress, advance, interrupt };
}

const RELOAD_TRAINER = {
    session: null, initialized: false, frame: null, retryTimer: null,
    returnFocus: null
};

function readReloadTrainerBest() {
    try {
        const raw = localStorage.getItem(RELOAD_TRAINER_STORAGE_KEY);
        const value = raw === null ? NaN : Number(raw);
        return Number.isFinite(value) && value > 0 ? value : null;
    } catch (_) {
        return null;
    }
}

function saveReloadTrainerBest() {
    try {
        localStorage.setItem(RELOAD_TRAINER_STORAGE_KEY,
            String(RELOAD_TRAINER.session.state.bestTimeMs));
    } catch (_) { /* Training also works when browser storage is unavailable. */ }
}

function isReloadTrainerOpen() {
    return $('reloadTrainerDialog')?.open === true;
}

function reloadTrainerTime(milliseconds) {
    return `${(milliseconds / 1000).toFixed(2)} ${tr('reloadTrainerSeconds')}`;
}

function stopReloadTrainerTimers() {
    if (RELOAD_TRAINER.frame !== null) cancelAnimationFrame(RELOAD_TRAINER.frame);
    if (RELOAD_TRAINER.retryTimer !== null) window.clearTimeout(RELOAD_TRAINER.retryTimer);
    RELOAD_TRAINER.frame = null;
    RELOAD_TRAINER.retryTimer = null;
}

function updateReloadTrainerClock() {
    const output = $('reloadTrainerTime');
    if (output) output.textContent = reloadTrainerTime(RELOAD_TRAINER.session.elapsed());
}

function updateReloadTrainerRing() {
    const session = RELOAD_TRAINER.session;
    const state = session.state;
    document.querySelectorAll('[data-reload-section]').forEach((section, index) => {
        section.classList.toggle('is-complete', index < state.sections);
        section.classList.toggle('is-current', index === state.sections && state.phase === 'playing');
        const fill = index < state.sections ? 1
            : index === state.sections ? session.sectionProgress() : 0;
        section.setAttribute('stroke-dasharray', `${fill * 100} 100`);
    });
}

function tickReloadTrainer() {
    RELOAD_TRAINER.frame = null;
    if (!isReloadTrainerOpen() || RELOAD_TRAINER.session.state.phase !== 'playing') return;
    const result = RELOAD_TRAINER.session.advance();
    if (result === 'complete') saveReloadTrainerBest();
    if (result === 'section' || result === 'complete') renderReloadTrainer();
    else {
        updateReloadTrainerClock();
        updateReloadTrainerRing();
    }
    if (RELOAD_TRAINER.session.state.phase === 'playing') {
        RELOAD_TRAINER.frame = requestAnimationFrame(tickReloadTrainer);
    }
}

function renderReloadTrainer() {
    const session = RELOAD_TRAINER.session;
    if (!session || !$('reloadTrainerDialog')) return;
    const state = session.state;
    $('reloadTrainerDialog').dataset.phase = state.phase;
    updateReloadTrainerClock();
    $('reloadTrainerBest').textContent = state.bestTimeMs === null
        ? '—' : reloadTrainerTime(state.bestTimeMs);
    $('reloadTrainerStreak').textContent = String(state.streak);
    $('reloadTrainerProgress').textContent = `${state.sections} / ${RELOAD_TRAINER_SECTIONS}`;
    $('reloadTrainerProgress').setAttribute('aria-valuenow', String(state.sections));
    updateReloadTrainerRing();

    const arrow = '<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true"><path d="M16 62V38H2L32 2l30 36H48v24Z"/></svg>';
    const sequence = $('reloadTrainerSequence');
    sequence.replaceChildren();
    state.sequence.forEach((key, index) => {
        const failed = state.phase === 'failed';
        const correct = !failed && index < state.inputIndex;
        const item = document.createElement('li');
        item.className = `reload-trainer-arrow${failed ? ' is-failed' : correct ? ' is-correct' : ''}`;
        item.dataset.direction = key;
        if (state.phase === 'playing' && index === state.inputIndex) item.setAttribute('aria-current', 'step');
        const result = failed ? tr('reloadTrainerWrong') : correct ? tr('reloadTrainerCorrect') : '';
        item.setAttribute('aria-label', `${index + 1}. ${key.toUpperCase()}${result ? ` · ${result}` : ''}`);
        item.innerHTML = arrow;
        sequence.append(item);
    });

    const statusKeys = {
        idle: 'reloadTrainerReady', playing: 'reloadTrainerPlaying',
        failed: 'reloadTrainerFailed', complete: 'reloadTrainerComplete',
        interrupted: 'reloadTrainerInterrupted'
    };
    const status = $('reloadTrainerStatus');
    status.textContent = tr(statusKeys[state.phase]);
    status.dataset.phase = state.phase;
    $('reloadTrainerStart').textContent = `R · ${tr(state.phase === 'playing'
        ? 'reloadTrainerRestart' : 'reloadTrainerStart')}`;
    document.querySelectorAll('[data-reload-key]').forEach(button => {
        button.disabled = state.phase !== 'playing';
    });
}

function startReloadTrainerCircle() {
    if (!isReloadTrainerOpen()) return;
    if (RELOAD_TRAINER.session.advance() === 'complete') saveReloadTrainerBest();
    stopReloadTrainerTimers();
    RELOAD_TRAINER.session.start();
    renderReloadTrainer();
    RELOAD_TRAINER.frame = requestAnimationFrame(tickReloadTrainer);
}

function inputReloadTrainerKey(key) {
    if (!isReloadTrainerOpen()) return;
    const result = RELOAD_TRAINER.session.press(key);
    if (result === 'ignored') return;
    if (result === 'failed' || result === 'complete') stopReloadTrainerTimers();
    if (result === 'complete') saveReloadTrainerBest();
    renderReloadTrainer();
    if (result === 'failed') {
        RELOAD_TRAINER.retryTimer = window.setTimeout(() => {
            RELOAD_TRAINER.retryTimer = null;
            if (isReloadTrainerOpen() && RELOAD_TRAINER.session.state.phase === 'failed') {
                startReloadTrainerCircle();
            }
        }, RELOAD_TRAINER_FAILURE_DELAY);
    }
}

function handleReloadTrainerKeyDown(event) {
    if (!isReloadTrainerOpen() || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
    const key = getKeyboardShortcutKey(event);
    if (key === 'escape') {
        closeReloadTrainer();
        return true;
    }
    if (key !== 'r' && !RELOAD_TRAINER_KEYS.includes(key)) return false;
    // Every arrow needs a fresh key press; holding a key never completes a sequence.
    if (!event.repeat) {
        if (key === 'r') startReloadTrainerCircle();
        else inputReloadTrainerKey(key);
    }
    return true;
}

function interruptReloadTrainer() {
    if (!isReloadTrainerOpen()) return;
    stopReloadTrainerTimers();
    RELOAD_TRAINER.session.interrupt();
    renderReloadTrainer();
}

function finishReloadTrainerClose() {
    if (isReloadTrainerOpen()) return;
    stopReloadTrainerTimers();
    RELOAD_TRAINER.session?.interrupt();
    const button = $('mapToolReloadTrainer');
    button?.classList.remove('active');
    button?.setAttribute('aria-expanded', 'false');
    RELOAD_TRAINER.returnFocus?.focus({ preventScroll: true });
    RELOAD_TRAINER.returnFocus = null;
}

function closeReloadTrainer() {
    if (isReloadTrainerOpen()) $('reloadTrainerDialog').close();
    finishReloadTrainerClose();
}

function openReloadTrainer() {
    const dialog = $('reloadTrainerDialog');
    if (!dialog || dialog.open) return;
    closeMapToolMenus();
    setMapTool(null);
    if (typeof stopCameraPan === 'function') stopCameraPan();
    if (typeof stopMapPanInertia === 'function') stopMapPanInertia();
    RELOAD_TRAINER.returnFocus = document.activeElement;
    RELOAD_TRAINER.session = createReloadTrainerSession({ bestTimeMs: readReloadTrainerBest() });
    renderReloadTrainer();
    dialog.showModal();
    $('mapToolReloadTrainer').classList.add('active');
    $('mapToolReloadTrainer').setAttribute('aria-expanded', 'true');
    $('reloadTrainerStart').focus({ preventScroll: true });
}

function updateReloadTrainerLocalization() {
    const button = $('mapToolReloadTrainer');
    if (button) {
        button.title = tr('reloadTrainerTitle');
        button.setAttribute('aria-label', tr('reloadTrainerTitle'));
    }
    $('reloadTrainerDialog')?.querySelectorAll('[data-reload-text]').forEach(element => {
        element.textContent = tr(element.dataset.reloadText);
    });
    $('reloadTrainerClose')?.setAttribute('aria-label', tr('reloadTrainerClose'));
    $('reloadTrainerSequence')?.setAttribute('aria-label', tr('reloadTrainerSequence'));
    $('reloadTrainerProgress')?.setAttribute('aria-label', tr('reloadTrainerSections'));
    renderReloadTrainer();
}

function initReloadTrainer() {
    if (document.body.classList.contains('mobile-app')) return;
    const bar = document.querySelector('.map-tools-bar');
    if (!bar || RELOAD_TRAINER.initialized) return;
    RELOAD_TRAINER.initialized = true;
    const button = document.createElement('button');
    button.id = 'mapToolReloadTrainer';
    button.type = 'button';
    button.className = 'map-tool-button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'reloadTrainerDialog');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 6.7M20 4v7h-7"/></svg>';
    bar.insertBefore(button, $('mapToolLayers'));
    button.addEventListener('click', event => {
        event.stopPropagation();
        openReloadTrainer();
    });

    const segments = Array.from({ length: RELOAD_TRAINER_SECTIONS }, (_, index) => {
        const angle = (index * 90 - 88) * Math.PI / 180;
        const end = angle + 86 * Math.PI / 180;
        const point = value => `${100 + 82 * Math.cos(value)},${100 + 82 * Math.sin(value)}`;
        const path = `M${point(angle)} A82 82 0 0 1 ${point(end)}`;
        return `<path class="reload-trainer-ring-track" d="${path}"/>
            <path class="reload-trainer-ring-fill" data-reload-section="${index}" pathLength="100" stroke-dasharray="0 100" d="${path}"/>`;
    }).join('');
    const dialog = document.createElement('dialog');
    dialog.id = 'reloadTrainerDialog';
    dialog.className = 'reload-trainer-dialog';
    dialog.setAttribute('aria-labelledby', 'reloadTrainerTitle');
    dialog.setAttribute('aria-describedby', 'reloadTrainerHint');
    dialog.innerHTML = `<div class="reload-trainer-heading">
        <h2 id="reloadTrainerTitle" data-reload-text="reloadTrainerTitle"></h2>
        <button id="reloadTrainerClose" type="button" class="reload-trainer-close"><span aria-hidden="true">×</span></button>
        </div><div class="reload-trainer-body">
        <div class="reload-trainer-hud">
        <div class="reload-trainer-ring"><svg viewBox="0 0 200 200" width="160" height="160" aria-hidden="true">${segments}</svg></div>
        <span id="reloadTrainerProgress" class="sr-only" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0">0 / 4</span>
        <ol id="reloadTrainerSequence" class="reload-trainer-sequence"></ol></div>
        <p id="reloadTrainerStatus" class="reload-trainer-status" role="status" aria-live="polite" aria-atomic="true"></p>
        <div class="reload-trainer-stats"><div><span data-reload-text="reloadTrainerTime"></span><output id="reloadTrainerTime" aria-live="off">0.00</output></div>
        <div><span data-reload-text="reloadTrainerBest"></span><strong id="reloadTrainerBest">—</strong></div>
        <div><span data-reload-text="reloadTrainerStreak"></span><strong id="reloadTrainerStreak">0</strong></div></div>
        <button id="reloadTrainerStart" class="reload-trainer-start" type="button"></button>
        <details class="reload-trainer-controls"><summary><kbd>W A S D</kbd> · <kbd>R</kbd> · <kbd>Esc</kbd></summary>
        <p id="reloadTrainerHint" class="reload-trainer-hint" data-reload-text="reloadTrainerHint"></p>
        <div class="reload-trainer-pad" role="group" aria-label="WASD">
        <button type="button" data-reload-key="w" aria-label="W">↑ <kbd>W</kbd></button>
        <button type="button" data-reload-key="a" aria-label="A">← <kbd>A</kbd></button>
        <button type="button" data-reload-key="s" aria-label="S">↓ <kbd>S</kbd></button>
        <button type="button" data-reload-key="d" aria-label="D">→ <kbd>D</kbd></button></div>
        <p class="reload-trainer-footer" data-reload-text="reloadTrainerKeyboardHint"></p></details></div>`;
    document.body.append(dialog);
    $('reloadTrainerClose').addEventListener('click', closeReloadTrainer);
    $('reloadTrainerStart').addEventListener('click', startReloadTrainerCircle);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeReloadTrainer(); });
    dialog.addEventListener('close', finishReloadTrainerClose);
    dialog.addEventListener('keydown', event => {
        event.stopPropagation();
        if (handleReloadTrainerKeyDown(event)) event.preventDefault();
    });
    dialog.addEventListener('keyup', event => event.stopPropagation());
    dialog.querySelectorAll('[data-reload-key]').forEach(control => {
        control.addEventListener('click', () => inputReloadTrainerKey(control.dataset.reloadKey));
    });
    window.addEventListener('blur', interruptReloadTrainer);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) interruptReloadTrainer();
    });
    updateReloadTrainerLocalization();
}

;

/* js/features/results.js */
/* =========================
   RESULT
   ========================= */

const ELEVATION_SOLUTION_TRANSFORMS = [];
const RESULT_RENDER_HOOKS = [];

function registerElevationSolutionTransform(transform) {
    if (typeof transform !== 'function') {
        throw new TypeError('Elevation solution transform must be a function');
    }

    ELEVATION_SOLUTION_TRANSFORMS.push(transform);

    return () => {
        const index = ELEVATION_SOLUTION_TRANSFORMS.indexOf(transform);
        if (index >= 0) ELEVATION_SOLUTION_TRANSFORMS.splice(index, 1);
    };
}

function registerResultRenderHook(hook) {
    if (typeof hook !== 'function') {
        throw new TypeError('Result render hook must be a function');
    }

    RESULT_RENDER_HOOKS.push(hook);

    return () => {
        const index = RESULT_RENDER_HOOKS.indexOf(hook);
        if (index >= 0) RESULT_RENDER_HOOKS.splice(index, 1);
    };
}

function applyElevationSolutionTransforms(context, resolved) {
    return ELEVATION_SOLUTION_TRANSFORMS.reduce(
        (current, transform) => {
            try {
                const transformed = transform({
                    ...context,
                    solutions: current.solutions,
                    terrainMeta: current.terrainMeta
                });

                if (!transformed) return current;

                if (transformed.solutions) {
                    return {
                        ...current,
                        ...transformed,
                        solutions: transformed.solutions
                    };
                }

                return {
                    ...current,
                    solutions: transformed
                };
            } catch (error) {
                console.warn(
                    '[results] Elevation solution transform failed; keeping the previous solution.',
                    error
                );
                return current;
            }
        },
        resolved
    );
}

function runResultRenderHooks() {
    RESULT_RENDER_HOOKS.forEach(hook => {
        try {
            hook();
        } catch (error) {
            console.warn('[results] Result render hook failed.', error);
        }
    });
}

function formatMilSolution(solution) {
    if (!solution) {
        return null;
    }

    const minMil = Math.round(solution.minMil);
    const maxMil = Math.round(solution.maxMil);

    if (minMil !== maxMil) {
        return `${minMil}–${maxMil}`;
    }

    return `${Math.round(solution.mil ?? minMil)}`;
}

function resolveElevationSolutions(
    weapon,
    distanceMeters,
    solutions,
    {
        mapId = S.map,
        origin = S.origin,
        target = S.target,
        display = true
    } = {}
) {
    const context = {
        weapon,
        distanceMeters,
        mapId,
        origin,
        target,
        display
    };

    let resolved = {
        solutions,
        terrainMeta: null
    };

    if (
        typeof getTerrainBallisticSolutions !==
        'function'
    ) {
        const transformed =
            applyElevationSolutionTransforms(
                context,
                resolved
            );

        return {
            ...transformed,
            solutions:
                validateElevationSolutions(
                    weapon,
                    transformed.solutions
                )
        };
    }

    try {
        const terrainResolved =
            getTerrainBallisticSolutions({
                ...context,
                solutions,
            });

        resolved = {
            solutions:
                terrainResolved?.solutions ??
                solutions,
            terrainMeta:
                terrainResolved?.meta ??
                null
        };
    } catch (error) {
        console.warn(
            '[terrain-ballistics] Failed to resolve terrain firing solution; using flat-table fallback.',
            error
        );

    }

    const transformed =
        applyElevationSolutionTransforms(
            context,
            resolved
        );

    return {
        ...transformed,
        solutions:
            validateElevationSolutions(
                weapon,
                transformed.solutions
            )
    };
}

function isElevationSolutionWithinWeaponLimits(
    weapon,
    solution
) {
    if (!solution) {
        return false;
    }

    const values = [
        solution.mil,
        solution.minMil,
        solution.maxMil
    ]
        .filter(value => value !== null && value !== undefined)
        .map(Number);

    if (!values.length || !values.every(Number.isFinite)) {
        return false;
    }

    const minMil =
        weapon?.minElevationMil == null ? NaN : Number(weapon.minElevationMil);

    const maxMil =
        weapon?.maxElevationMil == null ? NaN : Number(weapon.maxElevationMil);

    return values.every(value => (
        (!Number.isFinite(minMil) || value >= minMil - 1e-6) &&
        (!Number.isFinite(maxMil) || value <= maxMil + 1e-6)
    ));
}

function validateElevationSolutions(
    weapon,
    solutions
) {
    if (!solutions) {
        return solutions;
    }

    return {
        ...solutions,
        single:
            isElevationSolutionWithinWeaponLimits(
                weapon,
                solutions.single
            )
                ? solutions.single
                : null,
        low:
            isElevationSolutionWithinWeaponLimits(
                weapon,
                solutions.low
            )
                ? solutions.low
                : null,
        high:
            isElevationSolutionWithinWeaponLimits(
                weapon,
                solutions.high
            )
                ? solutions.high
                : null
    };
}

function getResolvedWeaponElevationSolutions(
    weapon,
    distanceMeters,
    options = {}
) {
    return resolveElevationSolutions(
        weapon,
        distanceMeters,
        getWeaponElevationSolutions(
            weapon,
            distanceMeters
        ),
        options
    );
}

function formatTerrainBallisticDetail(meta) {
    if (
        typeof formatTerrainBallisticsStatus !==
        'function'
    ) {
        return '';
    }

    return formatTerrainBallisticsStatus(meta);
}

function renderElevationResult(weapon, distanceMeters) {
    const value = $('mil');
    const detail = $('milAlt');

    if (!value) {
        return;
    }

    const resolved =
        getResolvedWeaponElevationSolutions(
            weapon,
            distanceMeters
        );

    const solutions =
        resolved.solutions;

    const terrainDetail =
        formatTerrainBallisticDetail(
            resolved.terrainMeta
        );

    let primary = '—';
    let secondary = '';

    if (solutions.single) {
        primary = formatMilSolution(solutions.single);
    } else if (solutions.low && solutions.high) {
        primary =
            `${formatMilSolution(solutions.low)} / ` +
            `${formatMilSolution(solutions.high)}`;
        secondary = `${tr('lowArc')} / ${tr('highArc')}`;
    } else if (solutions.low) {
        primary = formatMilSolution(solutions.low);
        secondary = tr('lowArc');
    } else if (solutions.high) {
        primary = formatMilSolution(solutions.high);
        secondary = tr('highArc');
    } else if (solutions.inRange) {
        secondary = tr('noFiringSolution');
    }

    if (terrainDetail) {
        secondary = secondary
            ? `${secondary} · ${terrainDetail}`
            : terrainDetail;
    }

    setText(
        value,
        primary
    );

    if (detail) {
        setText(
            detail,
            secondary
        );
        if (detail.hidden !== !secondary) {
            detail.hidden = !secondary;
        }
    }

    return resolved;
}

function result() {

    const weapon = WEAPONS[S.weapon];

    if (!weapon) {
        return;
    }

    const dx =
        S.target.x -
        S.origin.x;

    const dy =
        S.target.y -
        S.origin.y;

    const dWorld =
        Math.hypot(
            dx,
            dy
        );

    const dMeters =
        worldDistanceToMeters(dWorld);

    const d =
        dMeters / 1000;

    let a =
        Math.atan2(
            dx,
            dy
        ) *
        180 /
        Math.PI;

    if (
        a <
        0
    ) {
        a +=
            360;
    }

    setText(
        $('angle'),
        a.toFixed(
            1
        ) +
        '°'
    );

    setText(
        $('dist'),
        d.toFixed(
            2
        ) +
        ' km'
    );

    setText(
        $('distm'),
        Math.round(
            d *
            1000
        ) +
        ' m'
    );

    setText(
        $('dx'),
        (
            dx >=
            0
                ? '+'
                : '-'
        ) +
        Math.round(
            Math.abs(
                worldDistanceToMeters(dx)
            )
        ) +
        ' m'
    );

    setText(
        $('dy'),
        (
            dy >=
            0
                ? '+'
                : '-'
        ) +
        Math.round(
            Math.abs(
                worldDistanceToMeters(dy)
            )
        ) +
        ' m'
    );

    const elevationResult =
        renderElevationResult(
            weapon,
            dMeters
        );

    setText(
        $('solutionSummary'),
        `${Math.round(dMeters)} m · ` +
        `${$('mil')?.textContent || '—'} MIL · ` +
        `${a.toFixed(1)}°`
    );

    if (
        typeof syncSphLevelWarning ===
        'function'
    ) {
        syncSphLevelWarning();
    }

    const minRange =
        weapon.minRange ??
        0;

    const maxRange =
        weapon.maxRange ??
        weapon.range;

    const hasElevationSolution =
        Boolean(
            elevationResult?.solutions?.single ||
            elevationResult?.solutions?.low ||
            elevationResult?.solutions?.high
        );

    const inRange =
        d + 1e-9 >= minRange &&
        d <= maxRange + 1e-9 &&
        hasElevationSolution;

    setText(
        $('range'),
        minRange > 0
            ? `${Math.round(minRange * 1000)}–${Math.round(maxRange * 1000)} m`
            : `${Math.round(maxRange * 1000)} m`
    );

    setText(
        $('rangeStatus'),
        inRange
            ? tr('inRange')
            : tr('outRange')
    );

    setStyle(
        $('rangeStatus'),
        'color',
        inRange
            ? '#82c596'
            : '#d86666'
    );

    $('rangeStatus')
        ?.classList.toggle(
            'is-out-of-range',
            !inRange
        );

    const mapName =
        MAPS[S.map]?.name ||
        S.map;

    setText(
        $('status'),
        `${getWeaponName(weapon)} · ` +
        `${mapName} · ` +
        `${tr('artillery')}: ` +
        `${formatGameCoordinate(S.origin.x)}, ` +
        `${formatGameCoordinate(S.origin.y)} · ` +
        `${tr('target')}: ` +
        `${formatGameCoordinate(S.target.x)}, ` +
        `${formatGameCoordinate(S.target.y)}`
    );

    if (
        typeof scheduleAccessibilityResultAnnouncement ===
            'function'
    ) {
        scheduleAccessibilityResultAnnouncement({
            distanceMeters: dMeters,
            azimuth: a,
            inRange
        });
    }

    if (
        typeof trackCalculationState ===
        'function'
    ) {
        trackCalculationState(
            inRange
        );
    }

    runResultRenderHooks();
}


/* =========================
   SAVED TARGET FIRING INFO
   ========================= */

let savedTargetSummaryRefreshTimer = null;
let savedTargetSummaryState = '';

function getSavedTargetEffectiveOrigin(target) {
    const hasSavedOrigin =
        Boolean(
            target?.saveArtillery &&
            target?.origin &&
            Number.isFinite(
                Number(target.origin.x)
            ) &&
            Number.isFinite(
                Number(target.origin.y)
            )
        );

    if (hasSavedOrigin) {
        return {
            x: Number(target.origin.x),
            y: Number(target.origin.y)
        };
    }

    return {
        x: Number(S.origin.x),
        y: Number(S.origin.y)
    };
}

function getSavedTargetElevationSummary(
    weapon,
    distanceMeters,
    origin,
    targetPoint
) {
    const resolved =
        getResolvedWeaponElevationSolutions(
            weapon,
            distanceMeters,
            {
                mapId: S.map,
                origin,
                target: targetPoint,
                display: false
            }
        );

    const solutions =
        resolved.solutions;

    let primary =
        '—';

    let secondary =
        '';

    if (solutions.single) {
        primary =
            formatMilSolution(
                solutions.single
            );

    } else if (
        solutions.low &&
        solutions.high
    ) {
        primary =
            `${formatMilSolution(solutions.low)} / ` +
            `${formatMilSolution(solutions.high)}`;

        secondary =
            `${tr('lowArc')} / ${tr('highArc')}`;

    } else if (solutions.low) {
        primary =
            formatMilSolution(
                solutions.low
            );

        secondary =
            tr('lowArc');

    } else if (solutions.high) {
        primary =
            formatMilSolution(
                solutions.high
            );

        secondary =
            tr('highArc');

    } else if (solutions.inRange) {
        secondary =
            tr('noFiringSolution');

    } else {
        secondary =
            tr('outRange');
    }

    const terrainArcs = resolved.terrainMeta?.experimentalTerrainCorrection?.arcs;
    if (typeof formatTerrainBallisticsStatus === 'function' &&
        Object.values(terrainArcs || {}).some(arc => arc?.extendedHeight)) {
        const status = formatTerrainBallisticsStatus(resolved.terrainMeta, { display: false });
        if (status) secondary = secondary ? `${secondary} \u00b7 ${status}` : status;
    }

    return {
        primary,
        secondary,
        inRange:
            Boolean(
                solutions.inRange &&
                Boolean(
                    solutions.single ||
                    solutions.low ||
                    solutions.high
                )
            )
    };
}

function getSavedTargetFiringInfo(target) {
    const weapon =
        WEAPONS[S.weapon];

    if (
        !weapon ||
        !target ||
        !Number.isFinite(
            Number(target.x)
        ) ||
        !Number.isFinite(
            Number(target.y)
        )
    ) {
        return null;
    }

    const origin =
        getSavedTargetEffectiveOrigin(
            target
        );

    const targetPoint = {
        x: Number(target.x),
        y: Number(target.y)
    };

    const dx =
        targetPoint.x -
        origin.x;

    const dy =
        targetPoint.y -
        origin.y;

    const distanceMeters =
        worldDistanceToMeters(
            Math.hypot(
                dx,
                dy
            )
        );

    let azimuth =
        Math.atan2(
            dx,
            dy
        ) *
        180 /
        Math.PI;

    if (azimuth < 0) {
        azimuth += 360;
    }

    const elevation =
        getSavedTargetElevationSummary(
            weapon,
            distanceMeters,
            origin,
            targetPoint
        );

    return {
        origin,
        target:
            targetPoint,
        distanceMeters,
        distanceKm:
            distanceMeters /
            1000,
        azimuth,
        dxMeters:
            worldDistanceToMeters(
                dx
            ),
        dyMeters:
            worldDistanceToMeters(
                dy
            ),
        mil:
            elevation.primary,
        milDetail:
            elevation.secondary,
        inRange:
            elevation.inRange
    };
}

function formatSavedTargetSignedMeters(value) {
    return (
        (
            value >= 0
                ? '+'
                : '-'
        ) +
        Math.round(
            Math.abs(value)
        ) +
        ' m'
    );
}

function createSavedTargetMetric(
    label,
    value,
    detail = '',
    extraClass = ''
) {
    const metric =
        document.createElement(
            'div'
        );

    metric.className =
        `saved-target-metric ${extraClass}`
            .trim();

    const labelElement =
        document.createElement(
            'span'
        );

    labelElement.className =
        'saved-target-metric-label';

    labelElement.textContent =
        label;

    const valueElement =
        document.createElement(
            'strong'
        );

    valueElement.className =
        'saved-target-metric-value';

    valueElement.textContent =
        value;

    metric.append(
        labelElement,
        valueElement
    );

    if (detail) {
        const detailElement =
            document.createElement(
                'span'
            );

        detailElement.className =
            'saved-target-metric-detail';

        detailElement.textContent =
            detail;

        metric.appendChild(
            detailElement
        );
    }

    return metric;
}

function renderSavedTargetFiringInfo(
    item,
    target
) {
    const info =
        item.querySelector(
            '.saved-target-info'
        );

    if (!info) {
        return;
    }

    info
        .querySelector(
            '.saved-target-origin'
        )
        ?.remove();

    info
        .querySelector(
            '.saved-target-solution'
        )
        ?.remove();

    const targetCoords =
        info.querySelector(
            '.saved-target-coords'
        );

    if (targetCoords) {
        targetCoords.textContent =
            `${tr('target')}: ` +
            `X ${formatGameCoordinate(target.x)} · ` +
            `Y ${formatGameCoordinate(target.y)}`;
    }

    const firingInfo =
        getSavedTargetFiringInfo(
            target
        );

    if (!firingInfo) {
        return;
    }

    const originCoords =
        document.createElement(
            'span'
        );

    originCoords.className =
        'saved-target-origin';

    originCoords.textContent =
        `${tr('artillery')}: ` +
        `X ${formatGameCoordinate(firingInfo.origin.x)} · ` +
        `Y ${formatGameCoordinate(firingInfo.origin.y)}`;

    const solution =
        document.createElement(
            'div'
        );

    solution.className =
        'saved-target-solution';

    const distanceMetric =
        createSavedTargetMetric(
            tr('distance'),
            `${Math.round(firingInfo.distanceMeters)} m`,
            `${firingInfo.distanceKm.toFixed(2)} km`
        );

    const azimuthMetric =
        createSavedTargetMetric(
            tr('azimuth'),
            `${firingInfo.azimuth.toFixed(1)}°`
        );

    const milMetric =
        createSavedTargetMetric(
            tr('mil'),
            firingInfo.mil,
            firingInfo.milDetail,
            'saved-target-metric-mil'
        );

    const delta =
        document.createElement(
            'div'
        );

    delta.className =
        'saved-target-delta';

    delta.textContent =
        `ΔX ${formatSavedTargetSignedMeters(firingInfo.dxMeters)} · ` +
        `ΔY ${formatSavedTargetSignedMeters(firingInfo.dyMeters)}`;

    solution.append(
        distanceMetric,
        azimuthMetric,
        milMetric,
        delta
    );

    info.append(
        originCoords,
        solution
    );

    item.classList.toggle(
        'out-of-range',
        !firingInfo.inRange
    );
}

function refreshSavedTargetFiringInfo() {
    const container =
        $('savedTargetsList');

    if (
        !container ||
        !Array.isArray(savedTargets)
    ) {
        return;
    }

    const rows =
        new Map();

    container
        .querySelectorAll(
            '.saved-target'
        )
        .forEach(
            item => {
                rows.set(
                    item.dataset.targetId,
                    item
                );
            }
        );

    savedTargets.forEach(
        target => {
            const item =
                rows.get(
                    String(target.id)
                );

            if (item) {
                renderSavedTargetFiringInfo(
                    item,
                    target
                );
            }
        }
    );
}

function getSavedTargetSummaryState() {
    return [
        S.map,
        S.weapon,
        S.origin?.x,
        S.origin?.y,
        LANG,
        Boolean(
            WEAPONS[S.weapon]
        )
    ].join('|');
}

function scheduleSavedTargetFiringInfoRefresh() {
    const nextState =
        getSavedTargetSummaryState();

    if (
        nextState ===
        savedTargetSummaryState
    ) {
        return;
    }

    if (
        savedTargetSummaryRefreshTimer
    ) {
        clearTimeout(
            savedTargetSummaryRefreshTimer
        );
    }

    savedTargetSummaryRefreshTimer =
        setTimeout(
            () => {
                savedTargetSummaryRefreshTimer =
                    null;

                savedTargetSummaryState =
                    getSavedTargetSummaryState();

                refreshSavedTargetFiringInfo();
            },
            80
        );
}

/*
 * saved-targets.js is loaded before results.js.
 * Wrap its two public render/update functions here
 * so the existing target-list behavior stays intact
 * while every row gains a live firing solution.
 */
if (
    typeof renderSavedTargets ===
    'function'
) {
    const renderSavedTargetsBase =
        renderSavedTargets;

    renderSavedTargets =
        function (...args) {
            const result =
                renderSavedTargetsBase.apply(
                    this,
                    args
                );

            savedTargetSummaryState =
                getSavedTargetSummaryState();

            refreshSavedTargetFiringInfo();

            return result;
        };
}

if (
    typeof refreshSavedTargetHighlight ===
    'function'
) {
    const refreshSavedTargetHighlightBase =
        refreshSavedTargetHighlight;

    refreshSavedTargetHighlight =
        function (...args) {
            const result =
                refreshSavedTargetHighlightBase.apply(
                    this,
                    args
                );

            scheduleSavedTargetFiringInfoRefresh();

            return result;
        };
}

;

/* js/ui/inputs.js */
/* =========================
   INPUTS
   ========================= */

function inputs() {

    $('mapSelect').value =
        S.map;

    $('weapon').value =
        S.weapon;

    $('ox').value = formatGameCoordinate(S.origin.x);

    $('oy').value = formatGameCoordinate(S.origin.y);

    $('tx').value = formatGameCoordinate(S.target.x);

    $('ty').value = formatGameCoordinate(S.target.y);

    const coordinateSummary = $('coordinateSectionSummary');

    if (coordinateSummary) {
        coordinateSummary.textContent =
            `${formatGameCoordinate(S.origin.x)}, ${formatGameCoordinate(S.origin.y)} → ` +
            `${formatGameCoordinate(S.target.x)}, ${formatGameCoordinate(S.target.y)}`;
    }

    /*
     * Origin and target are written from six different places (map drags,
     * the coordinate inputs, saved-target restore, undo, coordinate
     * search). They all land here, so one throttled write covers them all
     * instead of a hook at each site.
     */
    if (
        typeof persistMapPoints ===
        'function'
    ) {
        persistMapPoints();
    }

    /*
     * The saved-target highlight is derived from where the target sits,
     * so every writer of S.target refreshes it by arriving here.
     */
    if (
        typeof refreshSavedTargetHighlight ===
        'function'
    ) {
        refreshSavedTargetHighlight();
    }

    /*
     * The last-correction line and ghost overlay only describe the target
     * while it still sits where the correction put it.
     */
    if (
        typeof updateFireAdjustmentUI ===
        'function'
    ) {
        updateFireAdjustmentUI();
    }

    result();
    draw();
}

function inputPoint(type) {

    if (
        typeof requestTerrainBallisticsForCurrentState ===
            'function'
    ) {
        requestTerrainBallisticsForCurrentState();
    }

    const p =
        S[type];

    const xInput =
        type === 'origin'
            ? $('ox')
            : $('tx');

    const yInput =
        type === 'origin'
            ? $('oy')
            : $('ty');

    const coordinateScale =
        getCoordinateMetersPerUnit();

    const nextX =
        coordinateScale === 100
            ? (Number(xInput.value) || 0)
            : (Number(xInput.value) || 0) / 1000;

    const nextY =
        coordinateScale === 100
            ? (Number(yInput.value) || 0)
            : (Number(yInput.value) || 0) / 1000;

    if (
        nextX !== p.x ||
        nextY !== p.y
    ) {
        pushMapToolHistory();
    }

    p.x = nextX;
    p.y = nextY;

    clamp(
        p
    );

    inputs();
}

;

/* js/ui/cursor.js */
/* =========================
   CURSOR
   ========================= */

function updateCursor(e, canvasRect) {

    const cursor =
        $('cursorCoords');

    if (
        typeof isMapLayerVisible === 'function' &&
        !isMapLayerVisible('cursorCoords')
    ) {
        if (cursor) {
            setStyle(cursor, 'display', 'none');
        }

        return;
    }

    const rect =
        canvasRect ||
        c.getBoundingClientRect();

    const x =
        e.clientX -
        rect.left;

    const y =
        e.clientY -
        rect.top;

    const world =
        toWorld(
            x,
            y
        );

    const bounds =
        getViewBounds();

    if (
        world.x <
        bounds.minX ||
        world.x >
        bounds.maxX ||
        world.y <
        bounds.minY ||
        world.y >
        bounds.maxY
    ) {

        setStyle(
            $('cursorCoords'),
            'display',
            'none'
        );

        return;
    }

    if (!cursor) {
        return;
    }

    setStyle(
        cursor,
        'display',
        'block'
    );

    setStyle(
        cursor,
        'left',
        `${x + 14}px`
    );

    setStyle(
        cursor,
        'top',
        `${y + 14}px`
    );

    setText(
        cursor.querySelector(
            '.cursor-x'
        ),
        `x${formatGameCoordinate(world.x)}`
    );

    setText(
        cursor.querySelector(
            '.cursor-y'
        ),
        `y${formatGameCoordinate(world.y)}`
    );
}

;

/* js/events.js */
/* =========================
   EVENTS
   ========================= */

const MAP_PAN_INERTIA_MIN_SPEED =
    0.32;

const MAP_PAN_INERTIA_MAX_SPEED =
    2.4;

const MAP_PAN_INERTIA_DECAY =
    0.90;

let mapPanInertiaFrame =
    null;

function normalizeMapPanInertiaVelocity(
    velocityX,
    velocityY
) {
    const x = Number(velocityX);
    const y = Number(velocityY);

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {
        return null;
    }

    const speed =
        Math.hypot(x, y);

    if (speed < MAP_PAN_INERTIA_MIN_SPEED) {
        return null;
    }

    const scale =
        speed > MAP_PAN_INERTIA_MAX_SPEED
            ? MAP_PAN_INERTIA_MAX_SPEED / speed
            : 1;

    return {
        x: x * scale,
        y: y * scale
    };
}

function stopMapPanInertia() {
    if (mapPanInertiaFrame !== null) {
        cancelAnimationFrame(
            mapPanInertiaFrame
        );

        mapPanInertiaFrame = null;
    }
}

function startMapPanInertia(
    velocityX,
    velocityY
) {
    stopMapPanInertia();

    if (
        typeof window.matchMedia === 'function' &&
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches
    ) {
        return false;
    }

    const velocity =
        normalizeMapPanInertiaVelocity(
            velocityX,
            velocityY
        );

    if (!velocity) {
        return false;
    }

    let lastFrame =
        performance.now();

    const tick = now => {
        const elapsed =
            Math.min(
                32,
                Math.max(
                    0,
                    now - lastFrame
                )
            );

        lastFrame = now;

        S.panX +=
            velocity.x * elapsed;

        S.panY +=
            velocity.y * elapsed;

        const decay =
            Math.pow(
                MAP_PAN_INERTIA_DECAY,
                elapsed / (1000 / 60)
            );

        velocity.x *= decay;
        velocity.y *= decay;

        draw();

        if (
            Math.hypot(
                velocity.x,
                velocity.y
            ) >= 0.02
        ) {
            mapPanInertiaFrame =
                requestAnimationFrame(tick);
        } else {
            mapPanInertiaFrame = null;
        }
    };

    mapPanInertiaFrame =
        requestAnimationFrame(tick);

    return true;
}

function bindThemeToggle() {

    const toggle =
        $('themeToggle');

    if (!toggle) {
        return;
    }

    toggle.addEventListener(
        'click',
        toggleTheme
    );
}

function setPointPlacementMode(mode) {
    if (mode !== 'origin' && mode !== 'target') {
        return false;
    }

    S.mode = mode;

    $('originMode')
        ?.classList.toggle(
            'active',
            mode === 'origin'
        );

    $('originMode')
        ?.setAttribute(
            'aria-pressed',
            mode === 'origin' ? 'true' : 'false'
        );

    $('targetMode')
        ?.classList.toggle(
            'active',
            mode === 'target'
        );

    $('targetMode')
        ?.setAttribute(
            'aria-pressed',
            mode === 'target' ? 'true' : 'false'
        );

    document.querySelector('[data-point="origin"]')
        ?.classList.toggle('is-active', mode === 'origin');

    document.querySelector('[data-point="target"]')
        ?.classList.toggle('is-active', mode === 'target');

    return true;
}

function swapArtilleryAndTargetPoints() {
    pushMapToolHistory();

    const oldOrigin =
        S.origin;

    S.origin =
        S.target;

    S.target =
        oldOrigin;

    inputs();
}

function isAppShortcutInputTarget(target) {
    if (!target || target === document.body) {
        return false;
    }

    if (target.isContentEditable) {
        return true;
    }

    return [
        'INPUT',
        'TEXTAREA',
        'SELECT'
    ].includes(
        String(target.tagName || '')
            .toUpperCase()
    );
}

function handleAppShortcut(event) {
    if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
    ) {
        return false;
    }

    const key =
        typeof getKeyboardShortcutKey === 'function'
            ? getKeyboardShortcutKey(event)
            : String(event.key || '').toLowerCase();

    /* Never steal shortcuts from editable controls. */
    if (
        isAppShortcutInputTarget(
            event.target
        )
    ) {
        return false;
    }

    if (key === '1') {
        setPointPlacementMode('origin');
        return true;
    }

    if (key === '2') {
        setPointPlacementMode('target');
        return true;
    }

    if (key === 'q') {
        setPointPlacementMode(
            S.mode === 'origin'
                ? 'target'
                : 'origin'
        );
        return true;
    }

    if (key === 'y') {
        swapArtilleryAndTargetPoints();
        return true;
    }

    if (
        key === 't' &&
        !document.body.classList.contains('mobile-app') &&
        typeof toggleDesktopSavedTargetsCollapsed === 'function'
    ) {
        toggleDesktopSavedTargetsCollapsed();
        return true;
    }

    return false;
}

function bindEvents() {

    /*
     * Persisted SPH-2 sessions do not need Terrain3D before the user actually
     * interacts with the calculator. Pointer interaction is a cheap universal
     * trigger; requestTerrainBallisticsRuntime() is idempotent.
     */
    document.addEventListener(
        'pointerdown',
        () => {
            if (
                typeof requestTerrainBallisticsForCurrentState ===
                    'function'
            ) {
                requestTerrainBallisticsForCurrentState();
            }
        },
        { passive: true }
    );

    $('mapSelect').addEventListener(
        'change',
        () => {
            stopMapPanInertia();

            if (lobby?.active) { $('mapSelect').value = S.map; return; }

            const key =
                $('mapSelect').value;

            if (!hasRegistryEntry(MAPS, key)) {
                $('mapSelect').value = S.map;
                return;
            }

            S.map =
                key;

            S.w =
                MAPS[key].w;

            S.h =
                MAPS[key].h;

            if (
                typeof loadMapPoints ===
                'function'
            ) {
                loadMapPoints();
            }

            persistAppSelections();

            clamp(
                S.origin
            );

            clamp(
                S.target
            );

            S.zoom =
                1;

            S.panX =
                0;

            S.panY =
                0;

            resetMapToolHistory();
            syncMapStyleSelect();

            if (
                typeof requestTerrainBallisticsForCurrentState ===
                    'function'
            ) {
                requestTerrainBallisticsForCurrentState();
            }

            inputs();
        }
    );
    $('mapStyleSelect')
        ?.addEventListener(
            'change',
            () => {
                const map =
                    MAPS[S.map];

                const style =
                    $('mapStyleSelect')
                        .value;

                if (
                    !map ||
                    !getAvailableMapTileStyleIds(
                        map
                    ).includes(style)
                ) {
                    syncMapStyleSelect();
                    return;
                }

                S.mapStyle =
                    style;

                persistMapStylePreference();

                if (
                    typeof trackAnalytics ===
                        'function'
                ) {
                    trackAnalytics(
                        'map-style-changed',
                        {
                            map: S.map,
                            style: S.mapStyle
                        }
                    );
                }

                draw();
            }
        );

    $('language').addEventListener(
        'change',
        () => {

            const language =
                $('language').value;

            switchLanguage(
                language
            );
        }
    );

    $('weapon').addEventListener(
        'change',
        () => {

            S.weapon =
                $('weapon').value;

            persistAppSelections();

            if (
                typeof requestTerrainBallisticsForCurrentState ===
                    'function'
            ) {
                requestTerrainBallisticsForCurrentState();
            }

            draw();
        }
    );

    $('originMode').addEventListener(
        'click',
        () => setPointPlacementMode('origin')
    );

    $('targetMode').addEventListener(
        'click',
        () => setPointPlacementMode('target')
    );

    ['ox', 'oy'].forEach(
        id => {

            $(id).addEventListener(
                'change',
                () =>
                    inputPoint(
                        'origin'
                    )
            );
        }
    );

    ['tx', 'ty'].forEach(
        id => {

            $(id).addEventListener(
                'change',
                () =>
                    inputPoint(
                        'target'
                    )
            );
        }
    );

    $('coordinateOriginCopy')
        ?.addEventListener(
            'click',
            () => copyPointCoordinates('origin')
        );

    /* The mobile sheet still exposes per-point paste actions. */
    $('coordinateOriginPaste')
        ?.addEventListener(
            'click',
            () => pastePointCoordinates('origin')
        );

    $('coordinateTargetCopy')
        ?.addEventListener(
            'click',
            () => copyPointCoordinates('target')
        );

    $('coordinateTargetPaste')
        ?.addEventListener(
            'click',
            () => pastePointCoordinates('target')
        );

    $('coordinateOriginLock')
        ?.addEventListener(
            'click',
            () => togglePointMapLock('origin')
        );

    $('coordinateTargetLock')
        ?.addEventListener(
            'click',
            () => togglePointMapLock('target')
        );

    if (
        typeof bindFireAdjustment ===
        'function'
    ) {
        bindFireAdjustment();
    }

    $('zoomIn')?.addEventListener(
        'click',
        () => {
            stopMapPanInertia();

            S.zoom =
                Math.min(
                    getMaxCameraZoom(),
                    S.zoom *
                    ZOOM_BUTTON_FACTOR
                );

            draw();
        }
    );

    $('zoomOut')?.addEventListener(
        'click',
        () => {
            stopMapPanInertia();

            S.zoom =
                Math.max(
                    MIN_ZOOM,
                    S.zoom /
                    ZOOM_BUTTON_FACTOR
                );

            draw();
        }
    );

    $('fit')?.addEventListener(
        'click',
        () => {
            stopMapPanInertia();

            S.zoom =
                1;

            S.panX =
                0;

            S.panY =
                0;

            draw();
        }
    );

    $('swap').addEventListener(
        'click',
        swapArtilleryAndTargetPoints
    );

    $('clear').addEventListener(
        'click',
        () => {

            pushMapToolHistory();

            const bounds =
                getViewBounds();

            S.origin = {
                x:
                bounds.minX,

                y:
                bounds.minY
            };

            S.target = {
                x:
                bounds.minX,

                y:
                bounds.minY
            };

            inputs();

            renderSavedTargets();
        }
    );


    /* =========================
       SAVED TARGETS
       ========================= */

    $('saveTarget').addEventListener(
        'click',
        saveCurrentTarget
    );

    $('saveArtilleryPosition')
        .addEventListener(
            'change',
            saveArtilleryPreference
        );

    $('exportSavedTargets')
        ?.addEventListener(
            'click',
            exportAllSavedTargets
        );

    $('importSavedTargets')
        ?.addEventListener(
            'click',
            importSavedTargets
        );


    /* =========================
       CANVAS
       ========================= */

    c.addEventListener(
        'mousedown',
        e => {

            e.preventDefault();

            stopMapPanInertia();

            const rect =
                c.getBoundingClientRect();

            const p =
                toWorld(
                    e.clientX -
                    rect.left,

                    e.clientY -
                    rect.top
                );

            if (
                e.button === 2 ||
                (
                    e.button === 0 &&
                    e.ctrlKey
                )
            ) {

                pan = {
                    startX:
                    e.clientX,

                    startY:
                    e.clientY,

                    originX:
                    S.panX,

                    originY:
                    S.panY,

                    lastX:
                    e.clientX,

                    lastY:
                    e.clientY,

                    lastTime:
                    performance.now(),

                    velocityX: 0,
                    velocityY: 0,
                    moved: false
                };

                $('cursorCoords')
                    .style.display =
                    'none';

                setPresetMarkerHover(
                    null
                );

                return;
            }

            /*
             * An armed impact pick consumes the next left click before any
             * map tool or point placement can react to it.
             */
            if (
                typeof handleFireAdjustmentMapPick ===
                    'function' &&
                handleFireAdjustmentMapPick(p)
            ) {
                drag = null;
                return;
            }

            if (
                handleMapToolMouseDown(
                    e,
                    p
                )
            ) {
                drag = null;
                return;
            }

            if (
                handlePresetMarkerTargetMouseDown(
                    e
                )
            ) {
                drag = null;

                updateCursor(
                    e
                );

                return;
            }

            /*
             * Point placement always follows the explicitly selected mode.
             * The old 300 m nearest-point hit test could move the other
             * marker when the user was trying to place a new point nearby.
             * Existing points can still be repositioned by selecting their
             * mode first and dragging/placing normally.
             */
            if (
                isPointMapLocked(
                    S.mode
                )
            ) {
                drag = null;
                updateCursor(e);
                return;
            }

            drag = S.mode;

            pushMapToolHistory();

            S[drag] = {
                x:
                p.x,

                y:
                p.y
            };

            clamp(
                S[drag]
            );

            inputs();

            updateCursor(
                e
            );
        }
    );

    window.addEventListener(
        'mousemove',
        e => {

            if (pan) {

                const now =
                    performance.now();

                const elapsed =
                    Math.max(
                        1,
                        now - pan.lastTime
                    );

                const deltaX =
                    e.clientX - pan.lastX;

                const deltaY =
                    e.clientY - pan.lastY;

                pan.velocityX =
                    pan.velocityX * 0.35 +
                    deltaX / elapsed * 0.65;

                pan.velocityY =
                    pan.velocityY * 0.35 +
                    deltaY / elapsed * 0.65;

                pan.lastX =
                    e.clientX;

                pan.lastY =
                    e.clientY;

                pan.lastTime =
                    now;

                pan.moved =
                    pan.moved ||
                    Math.hypot(
                        e.clientX - pan.startX,
                        e.clientY - pan.startY
                    ) >= 3;

                S.panX =
                    pan.originX +
                    (
                        e.clientX -
                        pan.startX
                    );

                S.panY =
                    pan.originY +
                    (
                        e.clientY -
                        pan.startY
                    );

                draw();

                return;
            }

            /*
             * One rect for the whole event. Reading it back after the
             * cursor readout has been written forces a layout, and this
             * handler used to read it twice.
             */
            const rect =
                c.getBoundingClientRect();

            updateCursor(
                e,
                rect
            );

            const toolWorld =
                toWorld(
                    e.clientX -
                    rect.left,
                    e.clientY -
                    rect.top
                );

            if (
                handleMapToolMouseMove(
                    e,
                    toolWorld
                )
            ) {
                drag = null;
                return;
            }

            updatePresetMarkerHover(
                e
            );

            if (!drag) {
                return;
            }

            const world =
                toWorld(
                    e.clientX -
                    rect.left,

                    e.clientY -
                    rect.top
                );

            S[drag] =
                world;

            clamp(
                S[drag]
            );

            inputs();

            updateCursor(
                e,
                rect
            );
        }
    );

    c.addEventListener(
        'contextmenu',
        e => {

            e.preventDefault();
        }
    );

    c.addEventListener(
        'mouseleave',
        () => {

            setPresetMarkerHover(
                null
            );

            if (!pan) {

                $('cursorCoords')
                    .style.display =
                    'none';
            }
        }
    );

    window.addEventListener(
        'mouseup',
        () => {

            handleMapToolMouseUp();

            drag =
                null;

            const releasedPan =
                pan;

            pan =
                null;

            if (releasedPan?.moved) {
                startMapPanInertia(
                    releasedPan.velocityX,
                    releasedPan.velocityY
                );
            }
        }
    );

    c.addEventListener(
        'wheel',
        e => {

            e.preventDefault();

            stopMapPanInertia();

            const rect =
                c.getBoundingClientRect();

            const mouseX =
                e.clientX -
                rect.left;

            const mouseY =
                e.clientY -
                rect.top;

            const before =
                toWorld(
                    mouseX,
                    mouseY
                );

            S.zoom =
                Math.max(
                    MIN_ZOOM,
                    Math.min(
                        getMaxCameraZoom(),
                        S.zoom *
                        (
                            e.deltaY <
                            0
                                ? ZOOM_WHEEL_IN
                                : ZOOM_WHEEL_OUT
                        )
                    )
                );

            const after =
                toWorld(
                    mouseX,
                    mouseY
                );

            S.panX +=
                (
                    after.x -
                    before.x
                ) *
                view().scale;

            S.panY -=
                (
                    after.y -
                    before.y
                ) *
                view().scale;

            draw();
        },
        {
            passive:
                false
        }
    );

    const cameraKeysLoaded =
        typeof handleCameraKeyDown ===
        'function';

    window.addEventListener(
        'keydown',
        e => {
            // The trainer owns keyboard input until its dialog is closed.
            if (typeof isReloadTrainerOpen === 'function' && isReloadTrainerOpen()) {
                if (handleReloadTrainerKeyDown(e)) e.preventDefault();
                return;
            }

            if (
                e.key === 'Escape' &&
                typeof cancelFireAdjustmentPick ===
                    'function' &&
                cancelFireAdjustmentPick()
            ) {
                e.preventDefault();
                return;
            }

            if (handleAppShortcut(e)) {
                e.preventDefault();
                return;
            }

            if (handleMapToolShortcut(e)) {
                e.preventDefault();
                return;
            }

            if (
                cameraKeysLoaded &&
                handleCameraKeyDown(e)
            ) {
                e.preventDefault();
            }
        }
    );

    if (cameraKeysLoaded) {

        window.addEventListener(
            'keyup',
            handleCameraKeyUp
        );

        /*
         * Held keys would otherwise stick when the window
         * loses focus mid-pan.
         */
        window.addEventListener(
            'blur',
            stopCameraPan
        );
    }

    window.addEventListener(
        'resize',
        resize
    );

    window.addEventListener(
        'blur',
        stopMapPanInertia
    );
}

;

/* js/ui/developer-access.js */
/* Public bootstrap; the menu is delivered by the owner-authenticated Worker. */
const DEVELOPER_MODE_STORAGE_KEY = 'wardogs-developer-mode-v1';
const DEVELOPER_ACCESS = { active: false, expiresAt: 0, timer: null, script: null, pending: null, generation: 0, controllers: new Set() };
const DEVELOPER_ACCESS_TEXT = {
    developerMode: 'Developer mode', developerClose: 'Close',
    developerLogin: 'Owner sign-in', developerSecret: 'Access key',
    developerLoginHint: 'Use your private developer key. It is sent to the gateway once and is not stored in the browser.',
    developerSignIn: 'Sign in', developerSigningIn: 'Signing in…',
    developerAccessDenied: 'Access denied. Check your key and allowed IP addresses.',
    developerAccessUnavailable: 'Developer access is unavailable. Check the gateway and security rules.'
};

function developerAccessText(key) {
    const value = typeof tr === 'function' ? tr(key) : key;
    return value === key ? DEVELOPER_ACCESS_TEXT[key] || key : value;
}

function developerModePreference(search, saved) {
    const option = new URLSearchParams(search).get('dev');
    return option === '1' || (option !== '0' && saved === '1');
}

function syncDeveloperLocalization() {
    const dialog = document.getElementById('developerAuthDialog');
    for (const element of dialog?.querySelectorAll('[data-developer-auth-text]') || []) {
        element.textContent = developerAccessText(element.dataset.developerAuthText);
    }
    window.WardogsDeveloperMenu?.localize();
}

function developerAccessEndpoint(path = '/__developer') {
    return new URL(path, getAssetGatewayOrigin()).href;
}

async function developerAccessRequest(options = {}) {
    const controller = new AbortController();
    DEVELOPER_ACCESS.controllers.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
        return await fetch(developerAccessEndpoint(), {
            ...options, credentials: 'include', cache: 'no-store',
            redirect: 'error', signal: controller.signal
        });
    } finally {
        window.clearTimeout(timeout);
        DEVELOPER_ACCESS.controllers.delete(controller);
    }
}

function clearDeveloperAccess() {
    DEVELOPER_ACCESS.active = false;
    DEVELOPER_ACCESS.expiresAt = 0;
    DEVELOPER_ACCESS.generation++;
    for (const controller of DEVELOPER_ACCESS.controllers) controller.abort();
    DEVELOPER_ACCESS.controllers.clear();
    window.clearTimeout(DEVELOPER_ACCESS.timer);
    DEVELOPER_ACCESS.timer = null;
    window.WardogsDeveloperMenu?.disable();
    DEVELOPER_ACCESS.script?.remove();
    DEVELOPER_ACCESS.script = null;
}

function disableDeveloperMode() {
    clearDeveloperAccess();
    const dialog = document.getElementById('developerAuthDialog');
    if (dialog?.open) dialog.close();
    dialog?.remove();
    try { localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, '0'); } catch (_) {}
    const url = new URL(window.location.href);
    url.searchParams.delete('dev');
    window.history.replaceState(window.history.state, '', url);
    // Clear only the developer cookie; asset sessions are independent.
    void developerAccessRequest({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"logout":true}' }).catch(() => {});
}

async function loadDeveloperMenu(grant, generation) {
    if (generation !== DEVELOPER_ACCESS.generation) return;
    const expiresAt = Number(grant.expiresAt);
    if (grant.ok !== true || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('invalid-grant');
    DEVELOPER_ACCESS.active = true;
    DEVELOPER_ACCESS.expiresAt = expiresAt;
    window.clearTimeout(DEVELOPER_ACCESS.timer);
    DEVELOPER_ACCESS.timer = window.setTimeout(clearDeveloperAccess, Math.min(expiresAt - Date.now(), 2147483647));
    const script = document.createElement('script');
    script.src = developerAccessEndpoint('/__developer/module');
    script.crossOrigin = 'use-credentials';
    script.referrerPolicy = 'no-referrer';
    DEVELOPER_ACCESS.script = script;
    await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('module-timeout')), 15000);
        script.onload = () => { window.clearTimeout(timeout); resolve(); };
        script.onerror = () => { window.clearTimeout(timeout); reject(new Error('module-unavailable')); };
        document.head.append(script);
    });
    if (generation !== DEVELOPER_ACCESS.generation) return;
    if (!window.WardogsDeveloperMenu) throw new Error('module-not-installed');
    try { localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, '1'); } catch (_) {}
}

function showDeveloperSignIn(message = '') {
    let dialog = document.getElementById('developerAuthDialog');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'developerAuthDialog';
        dialog.className = 'developer-dialog developer-auth-dialog';
        dialog.setAttribute('aria-labelledby', 'developerAuthTitle');
        dialog.innerHTML = `<div class="developer-heading"><h2 id="developerAuthTitle" data-developer-auth-text="developerLogin"></h2>
            <button id="developerAuthClose" type="button" data-developer-auth-text="developerClose"></button></div>
            <form id="developerAuthForm" class="developer-body">
                <p class="developer-hint" data-developer-auth-text="developerLoginHint"></p>
                <label class="developer-auth-field"><span data-developer-auth-text="developerSecret"></span>
                    <input id="developerAuthSecret" type="password" maxlength="256" autocomplete="off" spellcheck="false" required/></label>
                <p id="developerAuthStatus" role="status" aria-live="polite"></p>
                <button id="developerAuthSubmit" type="submit" data-developer-auth-text="developerSignIn"></button>
            </form>`;
        document.body.append(dialog);
        document.getElementById('developerAuthClose').addEventListener('click', disableDeveloperMode);
        dialog.addEventListener('cancel', disableDeveloperMode);
        dialog.addEventListener('keydown', event => event.stopPropagation());
        dialog.addEventListener('keyup', event => event.stopPropagation());
        document.getElementById('developerAuthForm').addEventListener('submit', async event => {
            event.preventDefault();
            const field = document.getElementById('developerAuthSecret');
            const button = document.getElementById('developerAuthSubmit');
            const status = document.getElementById('developerAuthStatus');
            if (button.disabled) return;
            const generation = DEVELOPER_ACCESS.generation;
            let body = JSON.stringify({ secret: field.value });
            field.value = '';
            button.disabled = true;
            status.textContent = developerAccessText('developerSigningIn');
            try {
                const response = await developerAccessRequest({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
                body = null;
                if (generation !== DEVELOPER_ACCESS.generation) return;
                if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
                await loadDeveloperMenu(await response.json(), generation);
                if (generation !== DEVELOPER_ACCESS.generation) return;
                dialog.close();
                dialog.remove();
            } catch (error) {
                if (generation !== DEVELOPER_ACCESS.generation) return;
                clearDeveloperAccess();
                status.textContent = developerAccessText(error.message === 'denied' ? 'developerAccessDenied' : 'developerAccessUnavailable');
                field.focus();
            } finally { body = null; button.disabled = false; }
        });
    }
    syncDeveloperLocalization();
    document.getElementById('developerAuthStatus').textContent = message;
    if (!dialog.open) dialog.showModal();
    document.getElementById('developerAuthSecret').focus();
}

async function verifyDeveloperAccess() {
    if (!DEVELOPER_ACCESS.active || Date.now() >= DEVELOPER_ACCESS.expiresAt) {
        clearDeveloperAccess();
        showDeveloperSignIn();
        return false;
    }
    if (DEVELOPER_ACCESS.pending) return DEVELOPER_ACCESS.pending;
    const generation = DEVELOPER_ACCESS.generation;
    DEVELOPER_ACCESS.pending = (async () => {
        try {
            const response = await developerAccessRequest();
            if (generation !== DEVELOPER_ACCESS.generation) return false;
            if (response.ok) return true;
            clearDeveloperAccess();
            if (response.status === 401) showDeveloperSignIn();
        } catch (_) {
            if (generation !== DEVELOPER_ACCESS.generation) return false;
            clearDeveloperAccess();
            showDeveloperSignIn(developerAccessText('developerAccessUnavailable'));
        }
        return false;
    })();
    try { return await DEVELOPER_ACCESS.pending; } finally { DEVELOPER_ACCESS.pending = null; }
}

window.WardogsDeveloperAccess = Object.freeze({
    verify: verifyDeveloperAccess,
    disable: disableDeveloperMode,
    isAuthorized: () => DEVELOPER_ACCESS.active && Date.now() < DEVELOPER_ACCESS.expiresAt
});

async function initDeveloperMode() {
    let saved = null;
    try { saved = localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY); } catch (_) {}
    if (new URLSearchParams(window.location.search).get('dev') === '0') {
        disableDeveloperMode();
        return;
    }
    if (!developerModePreference(window.location.search, saved)) return;
    const generation = DEVELOPER_ACCESS.generation;
    try {
        const response = await developerAccessRequest();
        if (generation !== DEVELOPER_ACCESS.generation) return;
        if (response.status === 401) return showDeveloperSignIn();
        if (response.status === 403) { clearDeveloperAccess(); return; }
        if (!response.ok) throw new Error('unavailable');
        await loadDeveloperMenu(await response.json(), generation);
    } catch (_) {
        if (generation !== DEVELOPER_ACCESS.generation) return;
        clearDeveloperAccess();
        showDeveloperSignIn(developerAccessText('developerAccessUnavailable'));
    }
}

;

/* js/main.js */
/* =========================
   INIT
   ========================= */

const APP_ASSET_VERSION = (() => {
    const source =
        document.currentScript?.src;

    if (!source) {
        return '';
    }

    try {
        return (
            new URL(source)
                .searchParams
                .get('v') ||
            ''
        );
    } catch {
        return '';
    }
})();

function versionRuntimeAsset(url) {
    if (!APP_ASSET_VERSION) {
        return url;
    }

    try {
        const resolved =
            new URL(
                url,
                document.baseURI
            );

        resolved.searchParams.set(
            'v',
            APP_ASSET_VERSION
        );

        return resolved.href;
    } catch {
        return url;
    }
}

async function loadRuntimeScript({
    selector,
    dataAttribute,
    url,
    ready,
    attempts = 1,
    retryDelay = 500
}) {
    const loadOnce = () =>
        new Promise((resolve, reject) => {
            const existing =
                document.querySelector(
                    selector
                );

            if (existing) {
                if (
                    typeof ready ===
                        'function' &&
                    ready()
                ) {
                    resolve();
                    return;
                }

                existing.addEventListener(
                    'load',
                    resolve,
                    {
                        once: true
                    }
                );

                existing.addEventListener(
                    'error',
                    () => {
                        existing.remove();
                        reject(
                            new Error(
                                `Failed to load runtime ${url}`
                            )
                        );
                    },
                    {
                        once: true
                    }
                );

                return;
            }

            const script =
                document.createElement(
                    'script'
                );

            script.src =
                versionRuntimeAsset(
                    url
                );

            script.async = false;

            script.dataset[
                dataAttribute
            ] = '1';

            script.onload =
                resolve;

            script.onerror =
                () => {
                    script.remove();
                    reject(
                        new Error(
                            `Failed to load runtime ${url}`
                        )
                    );
                };

            document.head.appendChild(
                script
            );
        });

    let lastError = null;

    for (
        let attempt = 1;
        attempt <= attempts;
        attempt++
    ) {
        try {
            await loadOnce();
            return;
        } catch (error) {
            lastError = error;

            if (attempt >= attempts) {
                throw error;
            }

            await new Promise(
                resolve =>
                    window.setTimeout(
                        resolve,
                        retryDelay
                    )
            );
        }
    }

    throw lastError;
}

let terrainRuntimePromise = null;

async function loadExperimentalTerrainCorrectionRuntime() {
    try {
        await loadRuntimeScript({
            selector:
                'script[data-experimental-terrain-correction]',
            dataAttribute:
                'experimentalTerrainCorrection',
            url:
                'js/features/experimental-terrain-correction.js',
            ready:
                () =>
                    typeof initExperimentalTerrainCorrection ===
                    'function',
            attempts: 2,
            retryDelay: 500
        });

        if (
            typeof initExperimentalTerrainCorrection ===
            'function'
        ) {
            await initExperimentalTerrainCorrection();
        }

        return true;
    } catch (error) {
        console.warn(
            '[experimental-terrain-correction] Runtime unavailable; flat-table fallback remains active.',
            error
        );

        return false;
    }
}

async function loadTerrainBallisticsRuntime() {
    try {
        await loadRuntimeScript({
            selector:
                'script[data-terrain-ballistics]',
            dataAttribute:
                'terrainBallistics',
            url:
                'js/features/terrain-ballistics.js',
            ready:
                () =>
                    typeof initTerrainBallistics ===
                    'function',
            attempts: 2,
            retryDelay: 500
        });

        if (
            typeof initTerrainBallistics ===
            'function'
        ) {
            await initTerrainBallistics();
        }

        await loadExperimentalTerrainCorrectionRuntime();

    } catch (error) {
        if (
            typeof trackOperationalFailure ===
                'function'
        ) {
            trackOperationalFailure(
                'terrain-load-failed',
                {
                    area: 'runtime',
                    type: 'script',
                    code: 'load'
                }
            );
        }

        console.warn(
            '[terrain-ballistics] Runtime unavailable; flat-table fallback remains active.',
            error
        );
    }
}

function requestTerrainBallisticsRuntime() {
    if (!terrainRuntimePromise) {
        terrainRuntimePromise =
            loadTerrainBallisticsRuntime();
    }

    return terrainRuntimePromise;
}

function requestTerrainBallisticsForCurrentState() {
    if (
        typeof S !== 'object' ||
        !S ||
        S.weapon !== 'spg'
    ) {
        return null;
    }

    return requestTerrainBallisticsRuntime();
}

async function loadSphPlatformCorrectionRuntime() {
    if (
        typeof isSphPlatformCorrectionEnabled !== 'function' ||
        !isSphPlatformCorrectionEnabled()
    ) {
        return false;
    }

    try {
        await loadRuntimeScript({
            selector: 'script[data-sph-platform-correction]',
            dataAttribute: 'sphPlatformCorrection',
            url: 'js/features/experimental-sph-platform-correction.js',
            ready: () =>
                typeof initSphPlatformCorrection ===
                'function'
        });

        return true;
    } catch (error) {
        console.warn(
            '[sph-platform] Experimental hull correction runtime unavailable; base calculator remains active.',
            error
        );

        return false;
    }
}


/*
 * Optional network runtimes must not delay the first useful calculator paint.
 * The flat firing tables are immediately usable; Terrain3D, MOTD and lobby UI
 * can arrive just after the first render. Staggering them also avoids opening
 * every optional request at once on high-RTT routes.
 */
function scheduleAfterFirstPaint(
    task,
    {
        delay = 0,
        timeout = 1500,
        label = 'deferred startup task'
    } = {}
) {
    const run = () => {
        Promise.resolve()
            .then(task)
            .catch(error => {
                console.warn(
                    `[startup] ${label} failed.`,
                    error
                );
            });
    };

    requestAnimationFrame(() => {
        window.setTimeout(() => {
            if (
                typeof window.requestIdleCallback ===
                    'function'
            ) {
                window.requestIdleCallback(
                    run,
                    { timeout }
                );
                return;
            }

            run();
        }, delay);
    });
}

async function loadLobbyRuntime() {
    if (
        APP_CONFIG.collab?.enabled !== true ||
        !APP_CONFIG.collab.serverUrl
    ) {
        return;
    }

    try {
        await loadRuntimeScript({
            selector: 'script[data-lobby-runtime]',
            dataAttribute: 'lobbyRuntime',
            url: new URL(
                'js/collab/lobby.js',
                BASE_PATH
            ).href,
            ready: () =>
                typeof initLobby === 'function'
        });

        await initLobby();
    } catch (error) {
        if (
            typeof trackOperationalFailure ===
                'function'
        ) {
            const diagnostics =
                typeof createClientErrorDiagnosticData ===
                    'function'
                    ? createClientErrorDiagnosticData(
                        error,
                        {
                            phase: 'lobby-runtime'
                        }
                    )
                    : {};

            trackOperationalFailure(
                'client-error',
                {
                    area: 'lobby',
                    type: 'runtime',
                    code: 'load',
                    ...diagnostics
                }
            );
        }

        console.warn(
            'Optional lobby interface could not load:',
            error
        );
    }
}

async function init() {

    try {

        document.documentElement.dataset.appInitState = 'loading';

        if (
            typeof initializeAccessibilityPreferences ===
                'function'
        ) {
            initializeAccessibilityPreferences();
        }

        applyTheme(
            getTheme()
        );

        bindThemeToggle();

        loadSavedTargets();

        /*
         * App config is independent from locale discovery, so start it in
         * parallel instead of making the visible shell wait for both requests.
         */
        const appConfigPromise =
            loadAppConfig();

        await loadLanguages();

        /*
         * Localize the static shell before slower registry and Terrain3D
         * startup work. The later applyLanguage() call still performs the full
         * component sync once those registries are ready.
         */
        applyStaticLanguage();

        await appConfigPromise;
        initDeveloperMode();

        renderFooter();

        /*
         * Load the last selected ids before their registries are populated.
         * loadWeapons() and loadMaps() validate them and fall back safely if
         * an old selection no longer exists.
         */
        loadAppSelections();

        // Map admission can take time on a slow route or require interaction.
        // Keep menus and the base calculator usable while protected tiles wait.
        const assetAccessPromise = initializeAssetAccess().catch(error => {
            console.warn('[startup] Map access could not initialize.', error);
            return false;
        });

        /*
         * These registries are independent. Loading them in parallel removes
         * two avoidable request waterfalls on high-latency connections.
         */
        await Promise.all([
            loadWeapons(),
            loadMapAssets(),
            loadMaps()
        ]);

        const sphPlatformRuntimeLoaded =
            await loadSphPlatformCorrectionRuntime();

        applyMapQuerySelection();


        initMapTools();
        initControlZones();

        initLayout();

        /*
         * Before the clamp below, so points restored from a previous
         * visit are pulled inside the map's bounds like any other.
         */
        loadMapPoints();

        /*
         * Sync initial state with the
         * selected preset map after the
         * map JSON files are available.
         */
        if (
            hasRegistryEntry(MAPS, S.map)
        ) {

            S.w =
                MAPS[S.map].w;

            S.h =
                MAPS[S.map].h;

            clamp(S.origin);
            clamp(S.target);
        }

        /* Persist validated fallbacks as well as valid restored selections. */
        persistAppSelections();

        bindEvents();

        if (
            sphPlatformRuntimeLoaded &&
            typeof initSphPlatformCorrection ===
                'function'
        ) {
            initSphPlatformCorrection();
        }

        if (
            typeof initMobileUI ===
            'function'
        ) {
            initMobileUI();
        }

        loadSaveArtilleryPreference();

        syncMapStyleSelect();
        updatePointLocksUI();

        applyLanguage();

        inputs();

        resize();

        renderSavedTargets();

        document.documentElement.dataset.appInitState = 'ready';

        /*
         * The useful calculator is now interactive. Optional network work is
         * intentionally outside the critical startup path and slightly
         * staggered so slow routes do not compete with the first render.
         */
        /*
         * Terrain3D is intentionally not scheduled here. It is loaded on the
         * first SPH-2 interaction instead, so mortar-only and browse-only
         * sessions never pay for the runtime, config or terrain manifests.
         */
        scheduleAfterFirstPaint(
            async () => {
                // A modal must not cover an interactive map verification.
                await assetAccessPromise;
                initMotd();
            },
            {
                delay: 150,
                timeout: 1500,
                label: 'MOTD'
            }
        );

        scheduleAfterFirstPaint(
            loadLobbyRuntime,
            {
                delay: 750,
                timeout: 2500,
                label: 'lobby runtime'
            }
        );

    } catch (error) {

        if (
            typeof trackOperationalFailure ===
                'function'
        ) {
            const diagnostics =
                typeof createClientErrorDiagnosticData ===
                    'function'
                    ? createClientErrorDiagnosticData(
                        error,
                        {
                            phase: 'app-init'
                        }
                    )
                    : {};

            trackOperationalFailure(
                'client-error',
                {
                    area: 'app',
                    type: 'init',
                    code: 'failed',
                    ...diagnostics
                }
            );
        }

        console.error(
            'Failed to initialize application:',
            error
        );

        document.documentElement.dataset.appInitState =
            'failed';

        const status =
            document.getElementById('status');

        if (status) {
            status.textContent =
                'Interactive tools failed to load. Please reload the page.';
        }
    }
}

init();

;
