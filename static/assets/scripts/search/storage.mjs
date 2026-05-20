import { searchPath } from "./config.mjs";
import {
    hasActiveSearchState,
    parseSearchParamsState,
    searchStatePath,
} from "./state.mjs";

const STORAGE_KEY = "eips.search";
const STORAGE_VERSION = 1;
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const URI_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;

const removeStoredSearch = () => {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Storage may be unavailable or blocked; URL-backed search still works.
    }
};

const removeInvalidStoredSearch = () => {
    removeStoredSearch();
    return null;
};

const parseTimestamp = (value) => {
    if (typeof value !== "string") {
        return NaN;
    }
    return Date.parse(value);
};

const isObjectRecord = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const relativeSearchUrl = (lastUrl) => {
    if (
        typeof lastUrl !== "string" ||
        URI_SCHEME_PATTERN.test(lastUrl) ||
        !lastUrl.startsWith("/") ||
        lastUrl.startsWith("//") ||
        lastUrl.includes("#")
    ) {
        return null;
    }

    try {
        const parsedUrl = new URL(lastUrl, window.location.origin);
        if (
            parsedUrl.origin !== window.location.origin ||
            parsedUrl.hash ||
            parsedUrl.pathname !== searchPath()
        ) {
            return null;
        }
        return parsedUrl;
    } catch {
        return null;
    }
};

export const readLastSearchUrl = (availableFilters) => {
    let rawStoredSearch;
    try {
        rawStoredSearch = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }

    if (rawStoredSearch === null) {
        return null;
    }

    let storedSearch;
    try {
        storedSearch = JSON.parse(rawStoredSearch);
    } catch {
        return removeInvalidStoredSearch();
    }

    if (!isObjectRecord(storedSearch)) {
        return removeInvalidStoredSearch();
    }

    if (storedSearch.version !== STORAGE_VERSION) {
        return null;
    }

    const updatedAt = parseTimestamp(storedSearch.updatedAt);
    const expiresAt = parseTimestamp(storedSearch.expiresAt);
    if (!Number.isFinite(updatedAt) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return removeInvalidStoredSearch();
    }

    const parsedUrl = relativeSearchUrl(storedSearch.lastUrl);
    if (!parsedUrl) {
        return removeInvalidStoredSearch();
    }

    const parsedState = parseSearchParamsState(parsedUrl.searchParams, availableFilters);
    if (!hasActiveSearchState(parsedState.state)) {
        return removeInvalidStoredSearch();
    }

    return searchStatePath(parsedState.state);
};

export const writeLastSearchUrl = (canonicalUrl) => {
    const updatedAt = new Date();
    const expiresAt = new Date(updatedAt.getTime() + STORAGE_TTL_MS);
    const storedSearch = {
        version: STORAGE_VERSION,
        lastUrl: canonicalUrl,
        updatedAt: updatedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSearch));
    } catch {
        // Storage may be unavailable or blocked; URL-backed search still works.
    }
};

export const clearLastSearch = () => {
    removeStoredSearch();
};
