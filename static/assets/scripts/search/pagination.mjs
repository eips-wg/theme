import { createElement, clearElement } from "./dom.mjs";

export const createPaginationControls = (container, onPageChange) => {
    const render = ({ page, pageCount, total, start, end }) => {
        clearElement(container);
        if (total === 0) {
            container.hidden = true;
            return;
        }

        container.hidden = false;
        const nav = createElement("nav", {
            class: "search-pagination",
            "aria-label": "Search results pages",
        });
        nav.appendChild(
            createElement(
                "div",
                { class: "search-pagination-status", "data-search-pagination-status": true },
                `Page ${page} of ${Math.max(pageCount, 1)}`,
            ),
        );

        if (pageCount > 1) {
            const pageControls = createElement("div", { class: "search-pagination-controls" });
            const previous = createElement(
                "button",
                {
                    type: "button",
                    class: "search-page-previous",
                    disabled: page <= 1,
                },
                "Previous page",
            );
            previous.addEventListener("click", () => {
                if (page > 1) {
                    onPageChange(page - 1);
                }
            });

            const stripScrollLeft = createElement(
                "button",
                {
                    type: "button",
                    class: "search-page-strip-scroll search-page-strip-scroll-left",
                    "aria-label": "Scroll page numbers left",
                },
                "<",
            );
            const strip = createElement("div", {
                class: "search-page-number-strip",
                tabindex: "0",
            });
            const stripScrollRight = createElement(
                "button",
                {
                    type: "button",
                    class: "search-page-strip-scroll search-page-strip-scroll-right",
                    "aria-label": "Scroll page numbers right",
                },
                ">",
            );
            for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
                const button = createElement(
                    "button",
                    {
                        type: "button",
                        class: "search-page-number",
                        "aria-current": pageNumber === page ? "page" : null,
                    },
                    String(pageNumber),
                );
                button.addEventListener("click", () => {
                    if (pageNumber !== page) {
                        onPageChange(pageNumber);
                    }
                });
                strip.appendChild(button);
            }
            const next = createElement(
                "button",
                {
                    type: "button",
                    class: "search-page-next",
                    disabled: page >= pageCount,
                },
                "Next page",
            );
            next.addEventListener("click", () => {
                if (page < pageCount) {
                    onPageChange(page + 1);
                }
            });

            const stripControls = createElement("div", { class: "search-page-number-controls" });
            const stripScrollAmount = () => {
                const pageButton = strip.querySelector(".search-page-number");
                if (!pageButton) {
                    return strip.clientWidth;
                }
                const stripStyle = window.getComputedStyle(strip);
                const gap = Number.parseFloat(stripStyle.columnGap || stripStyle.gap) || 0;
                return Math.round((pageButton.getBoundingClientRect().width + gap) * 3);
            };
            const updateStripScrollButtons = () => {
                const hasOverflow = strip.scrollWidth > strip.clientWidth + 1;
                stripScrollLeft.hidden = !hasOverflow;
                stripScrollRight.hidden = !hasOverflow;
                if (!hasOverflow) {
                    return;
                }
                stripScrollLeft.disabled = strip.scrollLeft <= 1;
                stripScrollRight.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
            };
            const scrollStripByUnits = (direction, behavior = "smooth") => {
                strip.scrollBy({ left: direction * stripScrollAmount(), behavior });
            };
            let stripHoldTimer = null;
            let stripHoldFrame = null;
            let suppressStripClick = false;
            const stopStripHold = () => {
                if (stripHoldTimer !== null) {
                    window.clearTimeout(stripHoldTimer);
                    stripHoldTimer = null;
                }
                if (stripHoldFrame !== null) {
                    window.cancelAnimationFrame(stripHoldFrame);
                    stripHoldFrame = null;
                }
                window.setTimeout(() => {
                    suppressStripClick = false;
                }, 0);
            };
            const startStripHold = (direction) => {
                suppressStripClick = true;
                scrollStripByUnits(direction);
                stripHoldTimer = window.setTimeout(() => {
                    const step = () => {
                        strip.scrollBy({ left: direction * 10, behavior: "auto" });
                        stripHoldFrame = window.requestAnimationFrame(step);
                    };
                    step();
                }, 220);
            };
            const bindStripScrollButton = (button, direction) => {
                button.addEventListener("click", () => {
                    if (suppressStripClick) {
                        return;
                    }
                    scrollStripByUnits(direction);
                });
                button.addEventListener("pointerdown", (event) => {
                    if (button.disabled) {
                        return;
                    }
                    event.preventDefault();
                    button.setPointerCapture?.(event.pointerId);
                    startStripHold(direction);
                });
                button.addEventListener("pointerup", stopStripHold);
                button.addEventListener("pointercancel", stopStripHold);
                button.addEventListener("lostpointercapture", stopStripHold);
            };
            bindStripScrollButton(stripScrollLeft, -1);
            bindStripScrollButton(stripScrollRight, 1);
            strip.addEventListener("scroll", updateStripScrollButtons);

            stripControls.append(stripScrollLeft, strip, stripScrollRight);
            pageControls.append(previous, stripControls, next);
            nav.appendChild(pageControls);
            window.requestAnimationFrame(() => {
                strip.querySelector('[aria-current="page"]')?.scrollIntoView({
                    block: "nearest",
                    inline: "center",
                });
                updateStripScrollButtons();
            });
        }

        container.appendChild(nav);
    };

    const clear = () => {
        clearElement(container);
        container.hidden = true;
    };

    return { render, clear };
};
