import { SORT_OPTIONS } from "./constants.mjs";

const DEFAULT_SEARCH_CONFIG = {
    enabled: false,
    base_path: "/",
};

export const normalizeDirectoryPath = (value, fallback = "/") => {
    if (typeof value !== "string" || value.length === 0) {
        return fallback;
    }

    let path = value;
    if (!path.startsWith("/")) {
        path = `/${path}`;
    }
    if (!path.endsWith("/")) {
        path = `${path}/`;
    }
    return path;
};

const readSearchConfigFromScript = (id) => {
    const element = document.getElementById(id);
    if (!element?.textContent?.trim()) {
        return null;
    }

    try {
        return JSON.parse(element.textContent);
    } catch (error) {
        console.error(`Failed to parse search config from #${id}`, error);
        return null;
    }
};

const readSearchConfig = () => {
    const rawConfig =
        readSearchConfigFromScript("build-eips-search-config") ||
        readSearchConfigFromScript("build-eips-global-search-config") ||
        DEFAULT_SEARCH_CONFIG;

    return {
        enabled: rawConfig.enabled === true,
        base_path: normalizeDirectoryPath(rawConfig.base_path, "/"),
        bundle_path:
            rawConfig.bundle_path === undefined || rawConfig.bundle_path === null
                ? null
                : normalizeDirectoryPath(rawConfig.bundle_path, null),
    };
};

export const searchConfig = readSearchConfig();

export const pathFromBase = (basePath, suffix) =>
    `${normalizeDirectoryPath(basePath)}${String(suffix).replace(/^\/+/, "")}`;

export const searchPath = (query = "", sort = "relevance") => {
    const params = new URLSearchParams();
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
        params.set("q", trimmedQuery);
    }
    if (sort !== "relevance") {
        params.set("sort", sort);
    }

    const queryString = params.toString();
    const path = pathFromBase(searchConfig.base_path, "search/");
    return queryString ? `${path}?${queryString}` : path;
};

export const validatedSort = (sort) =>
    Object.prototype.hasOwnProperty.call(SORT_OPTIONS, sort) ? sort : "relevance";

export const searchOptionsForSort = (sort) => {
    const pagefindSort = SORT_OPTIONS[validatedSort(sort)];
    return pagefindSort ? { sort: pagefindSort } : {};
};

export const parseUrlSearchState = () => {
    const params = new URLSearchParams(window.location.search);
    return {
        query: params.get("q") || "",
        sort: validatedSort(params.get("sort") || "relevance"),
    };
};
