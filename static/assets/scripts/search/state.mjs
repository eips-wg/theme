import {
    AUTHOR_MODE_PARAM,
    FILTER_FIELD_CONFIGS,
    FILTER_FIELD_KEYS,
    FILTER_FIELDS,
    FILTER_MODE_ALL,
    FILTER_MODE_ANY,
    filterPagefindField,
    filterUrlParam,
} from "./constants.mjs";
import { searchPath, validatedSort } from "./config.mjs";

const recognizedParams = new Set([
    "q",
    "sort",
    AUTHOR_MODE_PARAM,
    ...FILTER_FIELDS.map((field) => filterUrlParam(field)),
]);

export const emptyFilterSelections = () =>
    Object.fromEntries(FILTER_FIELD_KEYS.map((field) => [field, []]));

export const defaultFilterModes = () => ({ author: FILTER_MODE_ANY });

export const cloneSearchState = (state) => ({
    query: state.query || "",
    sort: validatedSort(state.sort || "relevance"),
    page: Number.isInteger(state.page) && state.page > 0 ? state.page : 1,
    filters: Object.fromEntries(
        FILTER_FIELD_KEYS.map((field) => [field, [...(state.filters?.[field] || [])]]),
    ),
    modes: {
        ...defaultFilterModes(),
        ...(state.modes || {}),
    },
});

const valuesForField = (availableFilters, field) => {
    const rawValues = availableFilters[filterPagefindField(field)] || {};
    const values = Object.keys(rawValues);
    if (field.values) {
        return new Set(values.filter((value) => field.values.includes(value)));
    }
    return new Set(values);
};

const uniqueValues = (values) => {
    const seen = new Set();
    const unique = [];
    for (const value of values) {
        if (!seen.has(value)) {
            seen.add(value);
            unique.push(value);
        }
    }
    return unique;
};

export const hasSelectedFilters = (state) =>
    FILTER_FIELD_KEYS.some((field) => (state.filters?.[field] || []).length > 0);

export const hasActiveSearchState = (state) => state.query.trim() !== "" || hasSelectedFilters(state);

export const normalizeSearchState = (state, availableFilters) => {
    let normalized = false;
    const filters = emptyFilterSelections();

    for (const field of FILTER_FIELDS) {
        const allowedValues = valuesForField(availableFilters, field);
        const selectedValues = uniqueValues(state.filters?.[field.key] || []);
        const validValues = selectedValues.filter((value) => allowedValues.has(value));
        if (validValues.length !== selectedValues.length) {
            normalized = true;
        }
        filters[field.key] = validValues;
    }

    const modes = defaultFilterModes();
    const requestedAuthorMode = state.modes?.author || FILTER_MODE_ANY;
    if (filters.author.length === 0) {
        modes.author = FILTER_MODE_ANY;
        if (requestedAuthorMode !== FILTER_MODE_ANY) {
            normalized = true;
        }
    } else if (requestedAuthorMode === FILTER_MODE_ALL) {
        modes.author = FILTER_MODE_ALL;
    } else {
        modes.author = FILTER_MODE_ANY;
        if (requestedAuthorMode !== FILTER_MODE_ANY) {
            normalized = true;
        }
    }

    let sort = validatedSort(state.sort || "relevance");
    if (sort !== (state.sort || "relevance")) {
        normalized = true;
    }
    if (
        sort !== "relevance" &&
        !hasActiveSearchState({
            query: state.query || "",
            filters,
        })
    ) {
        sort = "relevance";
        normalized = true;
    }

    return {
        state: {
            query: state.query || "",
            sort,
            page: 1,
            filters,
            modes,
        },
        normalized,
    };
};

export const parseUrlSearchState = (availableFilters) => {
    const params = new URLSearchParams(window.location.search);
    let normalized = false;
    const rawFilters = emptyFilterSelections();

    for (const key of params.keys()) {
        if (!recognizedParams.has(key)) {
            normalized = true;
        }
    }

    for (const field of FILTER_FIELDS) {
        const rawValues = params.getAll(filterUrlParam(field));
        const unique = uniqueValues(rawValues);
        if (unique.length !== rawValues.length) {
            normalized = true;
        }
        const allowedValues = valuesForField(availableFilters, field);
        const validValues = unique.filter((value) => allowedValues.has(value));
        if (validValues.length !== unique.length) {
            normalized = true;
        }
        rawFilters[field.key] = validValues;
    }

    const rawAuthorMode = params.get(AUTHOR_MODE_PARAM);
    const modes = defaultFilterModes();
    if (rawFilters.author.length > 0 && rawAuthorMode === FILTER_MODE_ALL) {
        modes.author = FILTER_MODE_ALL;
    } else if (rawAuthorMode !== null) {
        normalized = true;
    }

    const requestedSort = params.get("sort");
    const sort = validatedSort(requestedSort || "relevance");
    if (requestedSort !== null && (sort !== requestedSort || sort === "relevance")) {
        normalized = true;
    }

    const normalizedState = normalizeSearchState(
        {
            query: params.get("q") || "",
            sort,
            page: 1,
            filters: rawFilters,
            modes,
        },
        availableFilters,
    );

    return {
        state: normalizedState.state,
        normalized: normalized || normalizedState.normalized,
    };
};

export const searchStatePath = (state) => {
    const normalizedState = cloneSearchState(state);
    if (!hasActiveSearchState(normalizedState)) {
        return searchPath();
    }

    const params = new URLSearchParams();
    const query = normalizedState.query.trim();
    if (query) {
        params.set("q", query);
    }
    if (normalizedState.sort !== "relevance") {
        params.set("sort", normalizedState.sort);
    }
    for (const field of FILTER_FIELDS) {
        for (const value of normalizedState.filters[field.key] || []) {
            params.append(filterUrlParam(field), value);
        }
    }
    if ((normalizedState.filters.author || []).length > 0 && normalizedState.modes.author === FILTER_MODE_ALL) {
        params.set(AUTHOR_MODE_PARAM, FILTER_MODE_ALL);
    }
    const queryString = params.toString();
    const path = searchPath();
    return queryString ? `${path}?${queryString}` : path;
};

export const currentPathAndSearch = () => `${window.location.pathname}${window.location.search}`;

export const replaceUrlIfNeeded = (state) => {
    const path = searchStatePath(state);
    if (currentPathAndSearch() !== path) {
        history.replaceState({ buildEipsSearch: true }, "", path);
    }
};

export const pushSearchState = (state) => {
    history.pushState({ buildEipsSearch: true }, "", searchStatePath(state));
};

export const pushSearchStateIfNeeded = (state) => {
    const path = searchStatePath(state);
    if (currentPathAndSearch() === path) {
        return false;
    }
    history.pushState({ buildEipsSearch: true }, "", path);
    return true;
};

export const filtersForPagefind = (state) => {
    const pagefindFilters = {};
    for (const field of FILTER_FIELDS) {
        const values = state.filters[field.key] || [];
        if (values.length === 0) {
            continue;
        }
        if (field.key === "author" && state.modes.author === FILTER_MODE_ALL) {
            pagefindFilters.author = values;
        } else {
            pagefindFilters[filterPagefindField(field)] = { any: values };
        }
    }
    return pagefindFilters;
};

export const searchOptionsForState = (state) => ({
    sort: state.sort,
    filters: filtersForPagefind(state),
});

export const queryForPagefind = (state) => (state.query.trim() ? state.query.trim() : null);

export const filterLabel = (fieldKey) => FILTER_FIELD_CONFIGS[fieldKey]?.label || fieldKey;

export const usableAvailableFilters = (availableFilters) =>
    Object.fromEntries(
        FILTER_FIELDS.map((field) => [
            field.key,
            Object.fromEntries(
                Object.entries(availableFilters[filterPagefindField(field)] || {}).filter(
                    ([value]) => !field.values || field.values.includes(value),
                ),
            ),
        ]).filter(
            ([, values]) => Object.keys(values).length > 0,
        ),
    );
