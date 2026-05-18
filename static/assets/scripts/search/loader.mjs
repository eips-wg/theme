import { QUICK_SEARCH_DEBOUNCE_MS } from "./constants.mjs";
import { searchConfig, searchOptionsForSort } from "./config.mjs";

let pagefindInitPromise = null;

export const loadPagefind = async () => {
    if (!searchConfig.enabled) {
        throw new Error("Search is disabled for this build.");
    }
    if (!searchConfig.bundle_path) {
        throw new Error("Search is enabled but no Pagefind bundle path is configured.");
    }

    if (!pagefindInitPromise) {
        pagefindInitPromise = (async () => {
            const bundlePath = searchConfig.bundle_path;
            const pagefind = await import(`${bundlePath}pagefind.js`);
            await pagefind.options({
                basePath: bundlePath,
                baseUrl: searchConfig.base_path,
                excerptLength: 45,
            });
            await pagefind.init();
            return pagefind;
        })().catch((error) => {
            pagefindInitPromise = null;
            throw error;
        });
    }

    return pagefindInitPromise;
};

export const searchPagefind = async (query, sort = "relevance") => {
    const pagefind = await loadPagefind();
    return pagefind.search(query, searchOptionsForSort(sort));
};

export const debouncedPagefindSearch = async (query) => {
    const pagefind = await loadPagefind();
    if (typeof pagefind.debouncedSearch === "function") {
        return pagefind.debouncedSearch(query, {}, QUICK_SEARCH_DEBOUNCE_MS);
    }

    await new Promise((resolve) => setTimeout(resolve, QUICK_SEARCH_DEBOUNCE_MS));
    return pagefind.search(query);
};
