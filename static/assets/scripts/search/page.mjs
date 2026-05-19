import { PAGE_SIZE } from "./constants.mjs";
import { searchConfig, validatedSort } from "./config.mjs";
import { createFilterControls } from "./filters.mjs";
import { clearElement, setStatus } from "./dom.mjs";
import { loadPagefindFilters, searchPagefind } from "./loader.mjs";
import { createPaginationControls } from "./pagination.mjs";
import { loadResultData, renderResultDataList } from "./render.mjs";
import { clearLastSearch, readLastSearchUrl, writeLastSearchUrl } from "./storage.mjs";
import {
    cloneSearchState,
    hasActiveSearchState,
    normalizePageForResultCount,
    normalizeSearchState,
    parseUrlSearchState,
    pushSearchStateIfNeeded,
    queryForPagefind,
    replaceUrlIfNeeded,
    searchParamsCanRestoreLastSearch,
    searchOptionsForState,
    searchStatePath,
} from "./state.mjs";

const SHARE_SUCCESS_RESET_MS = 2000;
const SHARE_FAILURE_RESET_MS = 2500;

let fullSearchRequestId = 0;
let pageRenderRequestId = 0;

const searchSignature = (state) =>
    JSON.stringify({
        query: state.query.trim(),
        sort: state.sort,
        filters: state.filters,
        modes: state.modes,
        createdDate: state.createdDate,
    });

const noResultsMessage = (state) =>
    state.query.trim() ? `No results for "${state.query.trim()}".` : "No results for selected filters.";

export const initFullSearchPage = () => {
    const mount = document.getElementById("search-page-mount");
    if (!mount) {
        return;
    }

    const form = mount.querySelector("[role='search']");
    const input = mount.querySelector("[data-search-page-query]");
    const sortControl = mount.querySelector("[data-search-page-sort]");
    const filterMount = mount.querySelector("[data-search-page-filters]");
    const status = mount.querySelector("[data-search-page-status]");
    const results = mount.querySelector("[data-search-page-results]");
    const paginationMount = mount.querySelector("[data-search-page-pagination]");
    const searchButton = form.querySelector("[data-search-page-submit]");
    const shareButton = mount.querySelector("[data-search-share]");
    let committedState = null;
    let draftState = null;
    let filterControls = null;
    let paginationControls = null;
    let availableFilters = {};
    let currentResults = [];
    let currentTotal = 0;
    let currentPageCount = 0;
    let currentSignature = null;
    let filtersReady = false;
    let loadingQueryEdited = false;
    let pendingSearchSubmit = false;

    const normalizeState = (state) => normalizeSearchState(state, availableFilters).state;

    const isOutsideFilterCommitExempt = (target) =>
        target instanceof Element &&
        Boolean(target.closest("[data-search-page-sort], [data-search-page-pagination]"));

    const disableControls = () => {
        input.disabled = true;
        sortControl.disabled = true;
        searchButton.disabled = true;
        shareButton.hidden = true;
    };

    const clearResults = () => {
        currentResults = [];
        currentTotal = 0;
        currentPageCount = 0;
        currentSignature = null;
        clearElement(results);
        paginationControls?.clear();
    };

    const syncCommittedControls = () => {
        sortControl.value = committedState?.sort || "relevance";
    };

    const syncDraftControls = () => {
        input.value = draftState?.query || "";
        filterControls?.render(draftState);
    };

    const setDraftState = (state) => {
        draftState = normalizeState(state);
        syncDraftControls();
    };

    const updateDraftState = (state) => {
        const nextState = cloneSearchState(draftState || state);
        nextState.query = input.value;
        nextState.filters = state.filters;
        nextState.modes = state.modes;
        nextState.createdDate = state.createdDate;
        nextState.page = 1;
        draftState = normalizeState(nextState);
        syncDraftControls();
    };

    const updateDraftQuery = () => {
        if (!draftState) {
            return;
        }
        draftState = cloneSearchState({
            ...draftState,
            query: input.value,
        });
    };

    const renderFreshState = () => {
        clearResults();
        setStatus(status, "Enter a query or select filters to search proposals.");
        shareButton.hidden = false;
    };

    const renderDisabledState = () => {
        disableControls();
        clearResults();
        setStatus(status, "Search is not available for this build.");
    };

    const renderCurrentPage = async (state) => {
        const renderId = ++pageRenderRequestId;
        if (currentTotal === 0) {
            clearElement(results);
            paginationControls?.clear();
            setStatus(status, noResultsMessage(state));
            shareButton.hidden = false;
            return;
        }

        const start = (state.page - 1) * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, currentTotal);
        const visibleResults = currentResults.slice(start, end);
        const data = await loadResultData(visibleResults);
        if (renderId !== pageRenderRequestId) {
            return;
        }

        renderResultDataList(data, results);
        setStatus(
            status,
            currentTotal > PAGE_SIZE
                ? `Showing ${start + 1}-${end} of ${currentTotal} results.`
                : `${currentTotal} result${currentTotal === 1 ? "" : "s"}.`,
        );
        paginationControls?.render({
            page: state.page,
            pageCount: currentPageCount,
            total: currentTotal,
            start,
            end,
        });
        shareButton.hidden = false;
    };

    const executeSearch = async (state, { storage = "write-active" } = {}) => {
        const normalized = normalizeState(state);
        committedState = normalized;
        syncCommittedControls();

        if (!hasActiveSearchState(normalized)) {
            if (storage === "clear-inactive") {
                clearLastSearch();
            }
            ++fullSearchRequestId;
            ++pageRenderRequestId;
            renderFreshState();
            return;
        }

        const requestId = ++fullSearchRequestId;
        ++pageRenderRequestId;
        setStatus(status, "Loading results...");
        clearElement(results);
        paginationControls?.clear();
        shareButton.hidden = false;

        try {
            const response = await searchPagefind(queryForPagefind(normalized), searchOptionsForState(normalized));
            if (requestId !== fullSearchRequestId) {
                return;
            }

            currentResults = response.results;
            currentTotal = response.results.length;
            currentSignature = searchSignature(normalized);
            const pageNormalized = normalizePageForResultCount(normalized, currentTotal, PAGE_SIZE);
            currentPageCount = pageNormalized.pageCount;
            committedState = pageNormalized.state;
            if (pageNormalized.normalized) {
                replaceUrlIfNeeded(committedState);
            }
            syncCommittedControls();
            await renderCurrentPage(committedState);
            if (storage !== "none") {
                writeLastSearchUrl(searchStatePath(committedState));
            }
        } catch (error) {
            if (requestId !== fullSearchRequestId) {
                return;
            }
            console.error("Search failed", error);
            clearResults();
            setStatus(status, "Search failed to load. Please try again later.");
            shareButton.hidden = false;
        }
    };

    const applyCommittedState = async (state, { replace = false, storage = "write-active" } = {}) => {
        const normalized = normalizeState(state);
        committedState = normalized;
        syncCommittedControls();
        if (replace) {
            replaceUrlIfNeeded(normalized);
        }

        if (!hasActiveSearchState(normalized)) {
            if (storage === "clear-inactive") {
                clearLastSearch();
            }
            ++fullSearchRequestId;
            ++pageRenderRequestId;
            renderFreshState();
            return;
        }

        if (currentSignature === searchSignature(normalized) && currentSignature !== null) {
            const pageNormalized = normalizePageForResultCount(normalized, currentTotal, PAGE_SIZE);
            committedState = pageNormalized.state;
            if (pageNormalized.normalized) {
                replaceUrlIfNeeded(committedState);
            }
            syncCommittedControls();
            await renderCurrentPage(committedState);
            if (storage !== "none") {
                writeLastSearchUrl(searchStatePath(committedState));
            }
            return;
        }

        await executeSearch(normalized, { storage });
    };

    const commitDraftSearch = () => {
        if (!draftState || !committedState) {
            return;
        }
        filterControls?.commitOpen();
        const nextState = cloneSearchState(draftState || committedState);
        nextState.query = input.value.trim();
        nextState.sort = committedState?.sort || "relevance";
        nextState.page = 1;
        const normalized = normalizeState(nextState);
        setDraftState(normalized);
        pushSearchStateIfNeeded(normalized);
        applyCommittedState(normalized, { storage: "clear-inactive" });
    };

    const commitSort = () => {
        if (!committedState || !hasActiveSearchState(committedState)) {
            committedState = normalizeState({
                ...(committedState || {}),
                sort: "relevance",
                page: 1,
            });
            syncCommittedControls();
            return;
        }

        const nextState = cloneSearchState(committedState);
        nextState.sort = validatedSort(sortControl.value);
        nextState.page = 1;
        const normalized = normalizeState(nextState);
        if (!hasActiveSearchState(normalized)) {
            syncCommittedControls();
            return;
        }
        pushSearchStateIfNeeded(normalized);
        applyCommittedState(normalized);
    };

    const commitPage = (page) => {
        if (!committedState || !hasActiveSearchState(committedState)) {
            return;
        }
        const nextState = cloneSearchState(committedState);
        nextState.page = page;
        pushSearchStateIfNeeded(nextState);
        committedState = nextState;
        syncCommittedControls();
        writeLastSearchUrl(searchStatePath(nextState));
        renderCurrentPage(nextState);
    };

    if (!searchConfig.enabled) {
        paginationControls = createPaginationControls(paginationMount, commitPage);
        renderDisabledState();
        return;
    }

    paginationControls = createPaginationControls(paginationMount, commitPage);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!filtersReady) {
            pendingSearchSubmit = true;
            return;
        }
        commitDraftSearch();
    });

    input.addEventListener("input", () => {
        if (!filtersReady) {
            loadingQueryEdited = true;
            return;
        }
        updateDraftQuery();
    });

    sortControl.addEventListener("change", commitSort);

    const setShareState = (state) => {
        shareButton.dataset.shareState = state;
    };

    const resetShareStateLater = (delayMs) => {
        if (shareButton._shareResetTimer) {
            window.clearTimeout(shareButton._shareResetTimer);
        }

        shareButton._shareResetTimer = window.setTimeout(() => {
            setShareState("idle");
            shareButton._shareResetTimer = null;
        }, delayMs);
    };

    shareButton.addEventListener("click", async () => {
        if (shareButton._shareResetTimer) {
            window.clearTimeout(shareButton._shareResetTimer);
            shareButton._shareResetTimer = null;
        }

        setShareState("working");

        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error("Clipboard API is unavailable");
            }
            await navigator.clipboard.writeText(window.location.href);
            setShareState("success");
            resetShareStateLater(SHARE_SUCCESS_RESET_MS);
        } catch (error) {
            console.warn("Unable to copy search URL", error);
            setShareState("error");
            resetShareStateLater(SHARE_FAILURE_RESET_MS);
        }
    });

    const restoreFromUrl = async () => {
        filterControls?.cancelOpen();
        const parsed = parseUrlSearchState(availableFilters);
        committedState = parsed.state;
        setDraftState(parsed.state);
        if (parsed.normalized || searchStatePath(parsed.state) !== `${window.location.pathname}${window.location.search}`) {
            replaceUrlIfNeeded(parsed.state);
        }
        await applyCommittedState(parsed.state, { storage: "clear-inactive" });
    };

    input.value = new URLSearchParams(window.location.search).get("q") || "";
    sortControl.disabled = true;
    setStatus(status, "Loading search filters...");
    loadPagefindFilters()
        .then(async (filters) => {
            filtersReady = true;
            sortControl.disabled = false;
            availableFilters = filters;
            let parsed = parseUrlSearchState(availableFilters);
            if (
                !pendingSearchSubmit &&
                !hasActiveSearchState(parsed.state) &&
                searchParamsCanRestoreLastSearch(new URLSearchParams(window.location.search))
            ) {
                const restoredUrl = readLastSearchUrl(availableFilters);
                if (restoredUrl) {
                    history.replaceState({ buildEipsSearch: true }, "", restoredUrl);
                    parsed = parseUrlSearchState(availableFilters);
                }
            }
            committedState = parsed.state;
            filterControls = createFilterControls(filterMount, availableFilters, updateDraftState, {
                isOutsideClickExempt: isOutsideFilterCommitExempt,
            });
            const hydratedDraftState = cloneSearchState(committedState);
            if (loadingQueryEdited || pendingSearchSubmit) {
                hydratedDraftState.query = input.value;
            }
            setDraftState(hydratedDraftState);
            if (!pendingSearchSubmit && (
                parsed.normalized ||
                searchStatePath(committedState) !== `${window.location.pathname}${window.location.search}`
            )) {
                replaceUrlIfNeeded(committedState);
            }
            window.addEventListener("popstate", restoreFromUrl);
            if (pendingSearchSubmit) {
                pendingSearchSubmit = false;
                commitDraftSearch();
                return;
            }
            await applyCommittedState(committedState, {
                storage: hasActiveSearchState(committedState) ? "write-active" : "none",
            });
        })
        .catch((error) => {
            console.error("Search failed", error);
            disableControls();
            shareButton.hidden = false;
            clearResults();
            setStatus(status, "Search failed to load. Please try again later.");
        });
};
