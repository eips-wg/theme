import { QUICK_RESULT_LIMIT } from "./constants.mjs";
import { searchConfig, searchPath } from "./config.mjs";
import { createElement, clearElement, setStatus } from "./dom.mjs";
import { debouncedPagefindSearch } from "./loader.mjs";
import { renderResultList } from "./render.mjs";

let quickSearchRequestId = 0;

const quickSearch = {
    modal: null,
    input: null,
    results: null,
    status: null,
    fullSearchLink: null,
};

const updateQuickSearchLink = (query = "") => {
    if (quickSearch.fullSearchLink) {
        quickSearch.fullSearchLink.href = searchPath(query);
    }
};

const renderQuickEmptyState = () => {
    clearElement(quickSearch.results);
    setStatus(quickSearch.status, "Type to search proposals.");
    updateQuickSearchLink("");
};

const runQuickSearch = async (query) => {
    const trimmedQuery = query.trim();
    const requestId = ++quickSearchRequestId;
    updateQuickSearchLink(trimmedQuery);

    if (!trimmedQuery) {
        renderQuickEmptyState();
        return;
    }

    setStatus(quickSearch.status, "Searching...");
    clearElement(quickSearch.results);

    try {
        const response = await debouncedPagefindSearch(trimmedQuery);
        if (requestId !== quickSearchRequestId || response === null) {
            return;
        }

        if (response.results.length === 0) {
            setStatus(quickSearch.status, `No results for "${trimmedQuery}".`);
            return;
        }

        const rendered = await renderResultList(
            response.results,
            quickSearch.results,
            QUICK_RESULT_LIMIT,
            true,
        );
        if (requestId !== quickSearchRequestId) {
            return;
        }
        setStatus(
            quickSearch.status,
            response.results.length > rendered
                ? `Showing ${rendered} of ${response.results.length} results.`
                : `${response.results.length} result${response.results.length === 1 ? "" : "s"}.`,
        );
    } catch (error) {
        if (requestId !== quickSearchRequestId) {
            return;
        }
        console.error("Quick search failed", error);
        clearElement(quickSearch.results);
        setStatus(quickSearch.status, "Search failed to load. Please try again later.");
    }
};

const closeQuickSearch = () => {
    if (!quickSearch.modal) {
        return;
    }
    quickSearch.modal.hidden = true;
    document.body.classList.remove("search-modal-open");
};

const ensureQuickSearchModal = () => {
    if (quickSearch.modal) {
        return;
    }

    const modal = createElement("div", {
        class: "search-modal",
        id: "search-modal",
        hidden: true,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "search-modal-title",
    });
    const panel = createElement("div", { class: "search-modal-panel" });
    const header = createElement("div", { class: "search-modal-header" });
    header.appendChild(createElement("h2", { id: "search-modal-title" }, "Quick Search Proposals"));
    const closeButton = createElement("button", { type: "button", class: "search-modal-close" }, "Close");
    header.appendChild(closeButton);

    const input = createElement("input", {
        type: "search",
        class: "search-modal-input",
        placeholder: "Enter keyword or phrase",
        autocomplete: "off",
        "aria-label": "Search proposals by keyword or phrase",
    });
    const status = createElement("div", {
        class: "search-modal-status",
        role: "status",
        "aria-live": "polite",
    });
    const results = createElement("div", { class: "search-modal-results" });
    const fullSearchLink = createElement(
        "a",
        { class: "search-modal-full-link", href: searchPath() },
        "Open full search",
    );

    panel.appendChild(header);
    panel.appendChild(input);
    panel.appendChild(status);
    panel.appendChild(results);
    panel.appendChild(fullSearchLink);
    modal.appendChild(panel);
    document.body.appendChild(modal);

    closeButton.addEventListener("click", closeQuickSearch);
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeQuickSearch();
        }
    });
    input.addEventListener("input", () => runQuickSearch(input.value));
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && input.value.trim()) {
            window.location.href = searchPath(input.value);
        }
    });

    quickSearch.modal = modal;
    quickSearch.input = input;
    quickSearch.results = results;
    quickSearch.status = status;
    quickSearch.fullSearchLink = fullSearchLink;
};

const openQuickSearch = () => {
    if (!searchConfig.enabled) {
        return;
    }

    ensureQuickSearchModal();
    quickSearch.modal.hidden = false;
    document.body.classList.add("search-modal-open");
    quickSearch.input.value = "";
    renderQuickEmptyState();
    window.setTimeout(() => quickSearch.input.focus(), 0);
};

export const initQuickSearch = () => {
    const trigger = document.querySelector("[data-search-trigger]");
    if (trigger) {
        trigger.href = searchPath();
        if (searchConfig.enabled) {
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                openQuickSearch();
            });
        }
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeQuickSearch();
            return;
        }
        if (!searchConfig.enabled) {
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            openQuickSearch();
        }
    });
};
