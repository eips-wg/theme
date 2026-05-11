let overlay;
let modalTitle;
let modalBody;
let closeButton;
let lastFocusedElement;
let pressedTimer;

const setActiveTool = (target) => {
    document.querySelectorAll('[data-nav-ui-open="menu"]').forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-nav-ui-open") === target);
    });
};

const ensureModal = () => {
    overlay = overlay || document.querySelector(".nav-ui-overlay");
    modalTitle = modalTitle || document.querySelector(".nav-ui-modal-title");
    modalBody = modalBody || document.querySelector(".nav-ui-modal-body");
    closeButton = closeButton || document.querySelector(".nav-ui-modal-close");

    return Boolean(overlay && modalTitle && modalBody && closeButton);
};

const closeModal = () => {
    if (!ensureModal()) {
        return;
    }

    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("nav-ui-lock");
    setActiveTool(null);

    if (lastFocusedElement instanceof HTMLElement) {
        lastFocusedElement.focus();
    }
};

const openModal = (title, content) => {
    if (!ensureModal()) {
        return;
    }

    lastFocusedElement = document.activeElement;
    modalTitle.textContent = title;
    modalBody.textContent = "";
    modalBody.appendChild(content);
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("nav-ui-lock");
    closeButton.focus();
};

const buildMenuContent = () => {
    const list = document.createElement("ul");
    list.className = "nav-ui-menu-list";
    const links = document.querySelectorAll(".site-nav .trigger .page-link");

    for (const link of links) {
        if (link.id === "search") {
            continue;
        }

        const item = document.createElement("li");
        const clone = link.cloneNode(true);
        clone.removeAttribute("class");
        item.appendChild(clone);
        list.appendChild(item);
    }

    return list;
};

const triggerSearch = () => {
    const searchLink = document.getElementById("search");

    if (searchLink) {
        searchLink.click();
    }
};

const openMenuModal = () => {
    setActiveTool("menu");
    openModal("Menu", buildMenuContent());
};

const bindModal = () => {
    if (!ensureModal()) {
        return;
    }

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    closeButton.addEventListener("click", closeModal);
};

const bindActions = () => {
    document.querySelectorAll("[data-nav-ui-open]").forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.getAttribute("data-nav-ui-open");

            if (target === "menu") {
                openMenuModal();
            } else if (target === "search") {
                triggerSearch();
            }
        });
    });

    document.querySelectorAll("[data-nav-ui-scroll-top]").forEach((button) => {
        button.addEventListener("click", () => {
            button.classList.add("is-pressed");
            window.clearTimeout(pressedTimer);
            pressedTimer = window.setTimeout(() => {
                button.classList.remove("is-pressed");
            }, 450);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
};

const bindTopButton = () => {
    const topButton = document.querySelector(".nav-ui-top-button");

    if (!topButton) {
        return;
    }

    const updateTopButton = () => {
        const shouldEnable = window.scrollY > 180;
        topButton.disabled = !shouldEnable;

        if (!shouldEnable && document.activeElement === topButton) {
            topButton.blur();
        }
    };

    updateTopButton();
    window.addEventListener("scroll", updateTopButton, { passive: true });
};

const bindFooterVisibility = () => {
    const bar = document.querySelector(".nav-ui-bottom-bar");
    const footer = document.querySelector(".site-footer");
    const mobileQuery = window.matchMedia("(max-width: 999.98px)");
    let observer;

    if (!bar || !footer || !("IntersectionObserver" in window)) {
        return;
    }

    const isShortPage = () => {
        return document.documentElement.scrollHeight < window.innerHeight * 1.5;
    };

    const disconnectObserver = () => {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    };

    const updateFooterObserver = () => {
        disconnectObserver();
        bar.classList.remove("is-hidden");

        if (!mobileQuery.matches || isShortPage()) {
            return;
        }

        observer = new IntersectionObserver((entries) => {
            const isVisible = entries.some((entry) => entry.isIntersecting);
            bar.classList.toggle("is-hidden", isVisible);
        }, {
            threshold: 0.01,
            rootMargin: "0px 0px -8% 0px",
        });

        observer.observe(footer);
    };

    updateFooterObserver();
    window.addEventListener("resize", updateFooterObserver);

    if (typeof mobileQuery.addEventListener === "function") {
        mobileQuery.addEventListener("change", updateFooterObserver);
    }
};

const bindEscape = () => {
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModal();
        }
    });
};

const init = () => {
    bindModal();
    bindActions();
    bindTopButton();
    bindFooterVisibility();
    bindEscape();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
