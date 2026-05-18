import {
    AUTHOR_MODE_PARAM,
    CREATED_FROM_PARAM,
    CREATED_TO_PARAM,
    CREATED_YEAR_FIELD,
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
    "page",
    AUTHOR_MODE_PARAM,
    CREATED_FROM_PARAM,
    CREATED_TO_PARAM,
    ...FILTER_FIELDS.map((field) => filterUrlParam(field)),
]);

export const emptyFilterSelections = () =>
    Object.fromEntries(FILTER_FIELD_KEYS.map((field) => [field, []]));

export const emptyCreatedDateSelection = () => ({ from: null, to: null });

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
    createdDate: {
        from: state.createdDate?.from || null,
        to: state.createdDate?.to || null,
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

const isYearValue = (value) => {
    if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
        return false;
    }
    const year = Number(value);
    return Number.isSafeInteger(year) && year > 0;
};

export const createdYearOptions = (availableFilters) =>
    Object.keys(availableFilters[CREATED_YEAR_FIELD] || {})
        .filter(isYearValue)
        .sort((left, right) => Number(left) - Number(right));

export const createdDateSelectionsEqual = (left, right) =>
    (left?.from || null) === (right?.from || null) && (left?.to || null) === (right?.to || null);

const normalizeCreatedDateSelection = (selection, availableFilters) => {
    const requestedFrom = selection?.from || null;
    const requestedTo = selection?.to || null;
    const allowedYears = new Set(createdYearOptions(availableFilters));
    let normalized = false;

    if (!requestedFrom) {
        return {
            createdDate: emptyCreatedDateSelection(),
            normalized: requestedTo !== null,
        };
    }

    if (!isYearValue(requestedFrom) || !allowedYears.has(requestedFrom)) {
        return {
            createdDate: emptyCreatedDateSelection(),
            normalized: requestedFrom !== null || requestedTo !== null,
        };
    }

    let from = requestedFrom;
    let to = requestedTo;
    if (to !== null && (!isYearValue(to) || !allowedYears.has(to))) {
        to = null;
        normalized = true;
    }

    if (to !== null && Number(to) < Number(from)) {
        [from, to] = [to, from];
        normalized = true;
    }

    if (to === from) {
        to = null;
        normalized = true;
    }

    return {
        createdDate: { from, to },
        normalized: normalized || from !== requestedFrom || to !== requestedTo,
    };
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

const parsePage = (value) => {
    if (value === null || value === "") {
        return { page: 1, normalized: false };
    }
    if (!/^[1-9][0-9]*$/.test(value)) {
        return { page: 1, normalized: true };
    }
    const page = Number(value);
    return { page: Number.isSafeInteger(page) ? page : 1, normalized: !Number.isSafeInteger(page) };
};

export const hasSelectedFilters = (state) =>
    FILTER_FIELD_KEYS.some((field) => (state.filters?.[field] || []).length > 0) ||
    Boolean(state.createdDate?.from);

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

    const createdDateSelection = normalizeCreatedDateSelection(state.createdDate, availableFilters);
    if (
        createdDateSelection.normalized ||
        !createdDateSelectionsEqual(createdDateSelection.createdDate, state.createdDate)
    ) {
        normalized = true;
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
            createdDate: createdDateSelection.createdDate,
        })
    ) {
        sort = "relevance";
        normalized = true;
    }

    let page = Number.isInteger(state.page) && state.page > 0 ? state.page : 1;
    if (page !== state.page) {
        normalized = true;
    }
    if (
        page !== 1 &&
        !hasActiveSearchState({
            query: state.query || "",
            filters,
            createdDate: createdDateSelection.createdDate,
        })
    ) {
        page = 1;
        normalized = true;
    }

    return {
        state: {
            query: state.query || "",
            sort,
            page,
            filters,
            modes,
            createdDate: createdDateSelection.createdDate,
        },
        normalized,
    };
};

export const parseUrlSearchState = (availableFilters) => {
    const params = new URLSearchParams(window.location.search);
    let normalized = false;
    const rawFilters = emptyFilterSelections();
    const rawCreatedFromValues = params.getAll(CREATED_FROM_PARAM);
    const rawCreatedToValues = params.getAll(CREATED_TO_PARAM);

    for (const key of params.keys()) {
        if (!recognizedParams.has(key)) {
            normalized = true;
        }
    }

    if (rawCreatedFromValues.length > 1 || rawCreatedToValues.length > 1) {
        normalized = true;
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

    let { page, normalized: pageNormalized } = parsePage(params.get("page"));
    if (
        pageNormalized ||
        (page !== 1 &&
            !hasActiveSearchState({
                query: params.get("q") || "",
                filters: rawFilters,
                createdDate: {
                    from: rawCreatedFromValues[0] || null,
                    to: rawCreatedToValues[0] || null,
                },
            }))
    ) {
        page = 1;
        normalized = true;
    }

    const normalizedState = normalizeSearchState(
        {
            query: params.get("q") || "",
            sort,
            page,
            filters: rawFilters,
            modes,
            createdDate: {
                from: rawCreatedFromValues[0] || null,
                to: rawCreatedToValues[0] || null,
            },
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
    if (normalizedState.createdDate.from) {
        params.set(CREATED_FROM_PARAM, normalizedState.createdDate.from);
        if (normalizedState.createdDate.to) {
            params.set(CREATED_TO_PARAM, normalizedState.createdDate.to);
        }
    }
    if ((normalizedState.filters.author || []).length > 0 && normalizedState.modes.author === FILTER_MODE_ALL) {
        params.set(AUTHOR_MODE_PARAM, FILTER_MODE_ALL);
    }
    if (hasActiveSearchState(normalizedState) && normalizedState.page > 1) {
        params.set("page", String(normalizedState.page));
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

const createdYearsForPagefind = (createdDate) => {
    if (!createdDate?.from) {
        return [];
    }

    const from = Number(createdDate.from);
    const to = Number(createdDate.to || createdDate.from);
    const years = [];
    for (let year = from; year <= to; year += 1) {
        years.push(String(year));
    }
    return years;
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
    const createdYears = createdYearsForPagefind(state.createdDate);
    if (createdYears.length > 0) {
        pagefindFilters[CREATED_YEAR_FIELD] = { any: createdYears };
    }
    return pagefindFilters;
};

export const searchOptionsForState = (state) => ({
    sort: state.sort,
    filters: filtersForPagefind(state),
});

export const queryForPagefind = (state) => (state.query.trim() ? state.query.trim() : null);

export const normalizePageForResultCount = (state, totalResults, pageSize) => {
    if (totalResults === 0) {
        return { state: { ...state, page: 1 }, normalized: state.page !== 1, pageCount: 0 };
    }
    const pageCount = Math.max(1, Math.ceil(totalResults / pageSize));
    if (state.page > pageCount) {
        return { state: { ...state, page: 1 }, normalized: true, pageCount };
    }
    return { state, normalized: false, pageCount };
};

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
