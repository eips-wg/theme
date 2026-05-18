export const createElement = (localName, attrs = {}, textContent) => {
    const element = document.createElement(localName);
    for (const [name, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) {
            continue;
        }
        if (value === true) {
            element.setAttribute(name, "");
        } else {
            element.setAttribute(name, String(value));
        }
    }
    if (textContent !== undefined && textContent !== null) {
        element.textContent = String(textContent);
    }
    return element;
};

export const setStatus = (element, message) => {
    if (element) {
        element.textContent = message;
    }
};

export const clearElement = (element) => {
    if (element) {
        element.textContent = "";
    }
};
