const SUCCESS_RESET_MS = 2000;
const FAILURE_RESET_MS = 2500;
const COPY_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
</svg>
`;

const setCopyState = (button, state) => {
    button.dataset.copyState = state;
};

const resetCopyStateLater = (button, delayMs) => {
    if (button._resetTimer) {
        window.clearTimeout(button._resetTimer);
    }

    button._resetTimer = window.setTimeout(() => {
        setCopyState(button, "idle");
        button._resetTimer = null;
    }, delayMs);
};

const copyText = async (text) => {
    if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable");
    }

    await navigator.clipboard.writeText(text);
};

const handleCopyClick = async (button, codeBlock) => {
    setCopyState(button, "working");

    try {
        await copyText(codeBlock.textContent ?? "");
        setCopyState(button, "success");
        resetCopyStateLater(button, SUCCESS_RESET_MS);
    } catch (error) {
        console.error("Unable to copy code block contents", error);
        setCopyState(button, "error");
        resetCopyStateLater(button, FAILURE_RESET_MS);
    }
};

const createCopyButton = (codeBlock) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy-button";
    button.dataset.copyState = "idle";
    button.setAttribute("aria-label", "Copy code to clipboard");
    button.innerHTML = `
        <span class="code-copy-button__icon" aria-hidden="true">${COPY_ICON}</span>
        <span class="code-copy-button__status code-copy-button__status--success" aria-hidden="true">✓</span>
        <span class="code-copy-button__status code-copy-button__status--error" aria-hidden="true">✕</span>
    `;

    button.addEventListener("click", () => {
        void handleCopyClick(button, codeBlock);
    });

    return button;
};

const wrapCodeBlock = (pre) => {
    const wrapper = document.createElement("div");
    wrapper.className = "code-copy-wrapper";
    pre.insertAdjacentElement("beforebegin", wrapper);
    wrapper.appendChild(pre);
    return wrapper;
};

const installCopyButtons = () => {
    const codeBlocks = document.querySelectorAll("pre.giallo.z-code > code");

    for (const codeBlock of codeBlocks) {
        const pre = codeBlock.parentElement;
        if (!pre) {
            continue;
        }

        if (!pre.hasAttribute("tabindex")) {
            pre.tabIndex = 0;
        }

        const wrapper = pre.parentElement?.classList.contains("code-copy-wrapper")
            ? pre.parentElement
            : wrapCodeBlock(pre);

        if (wrapper.querySelector(":scope > .code-copy-button")) {
            continue;
        }

        wrapper.appendChild(createCopyButton(codeBlock));
    }
};

document.addEventListener("DOMContentLoaded", installCopyButtons);
