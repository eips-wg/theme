import { initQuickSearch } from "./search/modal.mjs";
import { initFullSearchPage } from "./search/page.mjs";

const onContentLoaded = () => {
    initQuickSearch();
    initFullSearchPage();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onContentLoaded);
} else {
    onContentLoaded();
}
