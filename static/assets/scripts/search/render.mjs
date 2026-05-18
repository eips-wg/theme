import { createElement, clearElement } from "./dom.mjs";

export const metadataText = (value) => {
    if (Array.isArray(value)) {
        return value.filter(Boolean).join(", ");
    }
    return value ? String(value) : "";
};

const slugify = (value) =>
    String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

export const resultTitle = (data) => {
    const meta = data.meta || {};
    const proposal = metadataText(meta.proposal);
    const title = metadataText(meta.title || data.title || data.url);
    if (proposal && title.startsWith(`${proposal}: `)) {
        return title.slice(proposal.length + 2);
    }
    return title;
};

const appendMetadataBadge = (container, label, value) => {
    const text = metadataText(value);
    if (!text) {
        return;
    }
    container.appendChild(
        createElement(
            "span",
            {
                class: `search-result-meta search-result-meta-${slugify(label)}`,
            },
            text,
        ),
    );
};

export const renderResultCard = (data, compact = false) => {
    const meta = data.meta || {};
    const proposal = metadataText(meta.proposal);
    const title = resultTitle(data) || proposal || data.url || "Untitled";
    const url = data.url || "#";

    const card = createElement("article", {
        class: compact ? "search-result-card search-result-card-compact" : "search-result-card",
    });
    const link = createElement("a", {
        class: "search-result-link",
        href: url,
    });

    const header = createElement("div", { class: "search-result-header" });
    if (proposal) {
        header.appendChild(createElement("span", { class: "search-result-proposal" }, proposal));
    }
    header.appendChild(createElement("h2", { class: "search-result-title" }, title));
    link.appendChild(header);

    if (!compact) {
        const metaRow = createElement("div", { class: "search-result-metadata" });
        appendMetadataBadge(metaRow, "status", meta.status);
        appendMetadataBadge(metaRow, "type", meta.type);
        appendMetadataBadge(metaRow, "category", meta.category);
        appendMetadataBadge(metaRow, "created", meta.created);
        appendMetadataBadge(metaRow, "authors", meta.authors);
        if (metaRow.childElementCount > 0) {
            link.appendChild(metaRow);
        }
    }

    if (data.excerpt) {
        const excerpt = createElement("p", { class: "search-result-excerpt" });
        excerpt.innerHTML = data.excerpt;
        link.appendChild(excerpt);
    }

    card.appendChild(link);
    return card;
};

export const renderResultList = async (results, container, limit, compact = false) => {
    clearElement(container);
    const visibleResults = results.slice(0, limit);
    const data = await Promise.all(visibleResults.map((result) => result.data()));
    for (const item of data) {
        container.appendChild(renderResultCard(item, compact));
    }
    return data.length;
};
