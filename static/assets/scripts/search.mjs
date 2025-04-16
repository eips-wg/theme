console.log("Search script initializing");

const FUSE_URL =
    "https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.js";
const FUSE_HASH = "sha384-P/y/5cwqUn6MDvJ9lCHJSaAi2EoH3JSeEdyaORsQMPgbpvA+NvvUqik7XH2YGBjb";


// Variables to store the search components
let fuse = null;
let data = null;
let fusePromise = null;

const parseFuseFromXML = (xml) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const entries = doc.getElementsByTagName("entry");
    const data = [];
    for (const entry of entries) {
        const title = entry.getElementsByTagName("title")[0].textContent;
        const published =
            entry.getElementsByTagName("published")[0].textContent;
        const updated = entry.getElementsByTagName("updated")[0].textContent;
        const authors = [];
        for (const author of entry.getElementsByTagName("author")) {
            const name = author.getElementsByTagName("name")[0]?.textContent;
            const uri = author.getElementsByTagName("uri")[0]?.textContent;
            authors.push({ name, uri });
        }
        const link = entry
            .getElementsByTagName("link")[0]
            ?.getAttribute("href");
        // TODO: Add summary
        const summary = entry.getElementsByTagName("summary")[0]?.textContent;
        const content = entry.getElementsByTagName("content")[0]?.textContent;

        const tags = Array.from(entry.getElementsByTagName("category"));
        const category = tags
            .find((tag) => tag.getAttribute("ref") === "category")
            ?.getAttribute("term");
        const type = tags
            .find((tag) => tag.getAttribute("ref") === "type")
            ?.getAttribute("term");
        const status = tags
            .find((tag) => tag.getAttribute("ref") === "status")
            ?.getAttribute("term");

        const slug_number = entry.querySelector("token[key='slug_number']")
            ?.textContent;

        data.push({
            slug_number,
            title,
            published,
            updated,
            link,
            summary,
            content,
            authors,
            category,
            type,
            status,
        });
    }
    return data;
};

// Function to lazy load Fuse.js and search data
const initializeSearch = () => {
    // If already initialized or initializing, return the promise
    if (fusePromise) return fusePromise;

    console.log("Loading search components...");

    // Create a promise that will resolve when search is ready
    fusePromise = (async () => {
        // Load Fuse using a <script> tag so we can use SRI.
        const loadScript = new Promise((resolve, reject) => {
            const scriptElem = document.createElement("script");
            scriptElem.onload = () => {
                if (window.Fuse) {
                    resolve(window.Fuse);
                } else {
                    reject(new Error("`window.Fuse` is falsy"));
                }
            };
            scriptElem.onerror = (e) => reject(e);
            scriptElem.integrity = FUSE_HASH;
            scriptElem.src = FUSE_URL;
            scriptElem.crossOrigin = "anonymous";
            document.body.appendChild(scriptElem);
        });

        try {
            // Fetch search data
            const dataPromise = fetch("/atom.xml").then((res) => res.text());

            // Dynamically import Fuse.js
            const Fuse = await loadScript;
            let tempdata = await dataPromise;

            data = parseFuseFromXML(tempdata);

            // Initialize Fuse
            fuse = new Fuse(data, {
                includeScore: true,
                keys: [
                    "title",
                    "link",
                    "slug_number",
                    "summary",
                    "authors",
                    "status",
                    "category",
                    "type",
                    "published",
                    "updated",
                    "content",
                ],
            });

            console.log("Search initialized successfully");
            return { fuse, data };
        } catch (error) {
            console.error("Failed to initialize search:", error);
            alert("Failed to initialize search");
            fusePromise = null; // Reset so we can try again
            throw error;
        }
    })();

    return fusePromise;
};

// Create search modal HTML
const createSearchModal = () => {
    const modal = document.createElement("div");
    modal.id = "search-modal";
    modal.innerHTML = `
    <div class="search-container">
      <div class="search-header">
        <input type="text" id="search-input" placeholder="Search..." autofocus />
        <button id="close-search">×</button>
      </div>
      <div id="search-results"></div>
    </div>
  `;

    document.body.appendChild(modal);

    // Add event listeners to the modal elements
    document
        .getElementById("search-input")
        .addEventListener("input", performSearch);
    document
        .getElementById("close-search")
        .addEventListener("click", closeSearchModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeSearchModal();
    });

    // Focus the input
    setTimeout(() => document.getElementById("search-input").focus(), 10);

    return modal;
};

const slugify = (str) => {
    return str.toLowerCase().replace(/ /g, "-");
};

// Search function
const performSearch = async (e) => {
    const query = e.target.value;
    const resultsContainer = document.getElementById("search-results");

    if (!resultsContainer) {
        console.error("Search results container not found");
        return;
    }

    if (!query) {
        resultsContainer.innerHTML = "";
        return;
    }

    // Show loading state
    resultsContainer.innerHTML = '<div class="no-results">Loading...</div>';

    try {
        // Ensure search is initialized
        if (!fuse) {
            await initializeSearch();
        }

        const results = fuse.search(query, { limit: 10 });

        if (results.length === 0) {
            resultsContainer.innerHTML =
                '<div class="no-results">No results found</div>';
            return;
        }

        resultsContainer.innerHTML = results
            .map((result) => {
                const item = result.item;
                const title = item.title || "Untitled";

                // Create a preview from either description or body
                let preview = item.summary || "";
                if (!preview && item.content) {
                    preview = item.content.substring(0, 150) + "...";
                }

                // Create URL from item.url or fallback
                const url = item.link || "#";

                const categoryDiv = item.category
                    ? `<span class="badge text-light tax-label-category tax-term-${slugify(
                          item.category,
                      )}">${item.category}</span>`
                    : "";
                const statusDiv = item.status
                    ? `<span class="badge text-light tax-label-status tax-term-${slugify(
                          item.status,
                      )}">${item.status}</span>`
                    : "";
                const typeDiv = item.type
                    ? `<span class="badge text-light tax-label-type tax-term-${slugify(
                          item.type,
                      )}">${item.type}</span>`
                    : "";

                return `
        <a href="${url}" class="search-result">
          <div class="search-result-header">
            <h3>${item.slug_number}: ${title}</h3>
            <div class="search-result-header-meta">
              ${categoryDiv}
              ${statusDiv}
              ${typeDiv}
            </div>
          </div>
          <p>${preview}</p>
        </a>
      `;
            })
            .join("");
    } catch (error) {
        resultsContainer.innerHTML =
            '<div class="no-results">Error loading search. Please try again.</div>';
        console.error("Search error:", error);
    }
};

// Open search modal
const openSearchModal = () => {
    // Check if modal already exists
    let modal = document.getElementById("search-modal");

    if (!modal) {
        modal = createSearchModal();
    } else {
        modal.style.display = "flex";
        document.getElementById("search-input").value = "";
        document.getElementById("search-results").innerHTML = "";
        setTimeout(() => document.getElementById("search-input").focus(), 10);
    }

    // Start initializing search in the background
    initializeSearch().catch((err) =>
        console.error("Failed to initialize search:", err),
    );

    // Add event listener to close on escape
    document.addEventListener("keydown", handleEscapeKey);
};

// Close search modal
const closeSearchModal = () => {
    const modal = document.getElementById("search-modal");
    if (modal) {
        modal.style.display = "none";
    }

    // Remove escape key listener
    document.removeEventListener("keydown", handleEscapeKey);
};

// Handle escape key
const handleEscapeKey = (e) => {
    if (e.key === "Escape") {
        closeSearchModal();
    }
};

// Listen for keyboard shortcut (Ctrl+K or Cmd+K)
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openSearchModal();
    }
});

// Add CSS for the search modal
const addSearchStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
    #search-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      z-index: 1000;
      padding-top: 100px;
    }

    .search-container {
      width: 600px;
      max-width: 90%;
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .search-header {
      display: flex;
      padding: 16px;
      border-bottom: 1px solid #eee;
    }

    #search-input {
      flex: 1;
      padding: 8px 12px;
      border: none;
      font-size: 16px;
      outline: none;
    }

    #close-search {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0 8px;
    }

    #search-results {
      max-height: 400px;
      overflow-y: auto;
    }

    .search-result-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .search-result-header-meta {
      margin-top: -4px;
    }

    .search-result {
      display: block;
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      text-decoration: none;
      color: #333;
      transition: background-color 0.2s;
    }

    .search-result:hover {
      background-color: #f5f5f5;
      text-decoration: none;
    }

    .search-result:hover h3, .search-result:hover p {
      text-decoration: underline;
    }

    .search-result h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      color: #2563EB;
    }

    .search-result p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }

    .no-results {
      padding: 16px;
      text-align: center;
      color: #666;
    }
  `;

    document.head.appendChild(style);
};

const onContentLoaded = () => {
    // Initialize the search UI (just styles, not the search functionality)
    addSearchStyles();

    // Add click listener to search button if it exists
    const searchButton = document.getElementById("search");
    if (searchButton) {
        searchButton.addEventListener("click", openSearchModal);
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onContentLoaded);
} else {
    onContentLoaded();
}
