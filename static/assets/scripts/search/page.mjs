import { RESULT_LIMIT } from "./constants.mjs";
import { parseUrlSearchState, searchConfig, searchPath, validatedSort } from "./config.mjs";
import { clearElement, setStatus } from "./dom.mjs";
import { searchPagefind } from "./loader.mjs";
import { renderResultList } from "./render.mjs";

const SHARE_SUCCESS_RESET_MS = 2000;
const SHARE_FAILURE_RESET_MS = 2500;

let fullSearchRequestId = 0;

export const initFullSearchPage = () => {
    const mount = document.getElementById("search-page-mount");
    if (!mount) {
        return;
    }

    const form = mount.querySelector("[role='search']");
    const input = mount.querySelector("[data-search-page-query]");
    const sortControl = mount.querySelector("[data-search-page-sort]");
    const status = mount.querySelector("[data-search-page-status]");
    const results = mount.querySelector("[data-search-page-results]");
    const shareButton = mount.querySelector("[data-search-share]");
    let committedQuery = "";

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

    const disableControls = () => {
        input.disabled = true;
        sortControl.disabled = true;
        form.querySelector("[data-search-page-submit]").disabled = true;
        shareButton.hidden = true;
    };

    const renderFreshState = () => {
        clearElement(results);
        setStatus(status, "Enter a query to search proposals.");
        shareButton.hidden = true;
    };

    const renderDisabledState = () => {
        disableControls();
        clearElement(results);
        setStatus(status, "Search is not available for this build.");
    };

    const runCommittedSearch = async (query, sort) => {
        const trimmedQuery = query.trim();
        committedQuery = trimmedQuery;
        if (!trimmedQuery) {
            renderFreshState();
            return;
        }

        const requestId = ++fullSearchRequestId;
        setStatus(status, "Loading results...");
        clearElement(results);
        shareButton.hidden = true;

        try {
            const response = await searchPagefind(trimmedQuery, sort);
            if (requestId !== fullSearchRequestId) {
                return;
            }

            const total = response.results.length;
            if (total === 0) {
                setStatus(status, `No results for "${trimmedQuery}".`);
                return;
            }

            const rendered = await renderResultList(response.results, results, RESULT_LIMIT);
            if (requestId !== fullSearchRequestId) {
                return;
            }

            setStatus(
                status,
                total > rendered
                    ? `Showing ${rendered} of ${total} results.`
                    : `${total} result${total === 1 ? "" : "s"}.`,
            );
            shareButton.hidden = false;
        } catch (error) {
            if (requestId !== fullSearchRequestId) {
                return;
            }
            console.error("Search failed", error);
            clearElement(results);
            setStatus(status, "Search failed to load. Please try again later.");
        }
    };

    const commitSearchState = (query, sort) => {
        history.pushState({ buildEipsSearch: true }, "", searchPath(query, sort));
    };

    const restoreFromUrl = () => {
        const state = parseUrlSearchState();
        input.value = state.query;
        sortControl.value = state.sort;
        if (state.query.trim()) {
            runCommittedSearch(state.query, state.sort);
        } else {
            committedQuery = "";
            renderFreshState();
        }
    };

    if (!searchConfig.enabled) {
        renderDisabledState();
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = input.value.trim();
        const sort = validatedSort(sortControl.value);
        sortControl.value = sort;
        commitSearchState(query, sort);
        runCommittedSearch(query, sort);
    });

    sortControl.addEventListener("change", () => {
        const sort = validatedSort(sortControl.value);
        sortControl.value = sort;
        commitSearchState(committedQuery, sort);
        if (committedQuery) {
            runCommittedSearch(committedQuery, sort);
        }
    });

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

    window.addEventListener("popstate", restoreFromUrl);
    restoreFromUrl();
};
