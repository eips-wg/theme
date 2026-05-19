import {
    CREATED_DATE_LABEL,
    CREATED_YEAR_FIELD,
    FILTER_FIELDS,
    FILTER_MODE_ALL,
    FILTER_MODE_ANY,
    filterPagefindField,
} from "./constants.mjs";
import { createElement, clearElement } from "./dom.mjs";
import {
    cloneSearchState,
    createdDateSelectionsEqual,
    createdYearOptions,
    filterLabel,
} from "./state.mjs";

const optionLabel = (value, count) => `${value} (${count})`;

const selectedSummary = (count) => `${count} selected`;

const arrayEqual = (left, right) =>
    left.length === right.length && left.every((value, index) => value === right[index]);

const fieldSelectionsEqual = (left, right) =>
    FILTER_FIELDS.every((field) => arrayEqual(left[field.key] || [], right[field.key] || []));

const searchFilterStateEqual = (left, right) =>
    fieldSelectionsEqual(left.filters || {}, right.filters || {}) &&
    left.modes?.author === right.modes?.author &&
    createdDateSelectionsEqual(left.createdDate, right.createdDate);

const fieldOptions = (availableFilters, field) => {
    const entries = Object.entries(availableFilters[filterPagefindField(field)] || {});
    if (field.values) {
        const unknownValues = entries
            .map(([value]) => value)
            .filter((value) => !field.values.includes(value));
        if (unknownValues.length > 0) {
            throw new Error(
                `Unexpected ${filterPagefindField(field)} filter values: ${unknownValues.join(", ")}`,
            );
        }
        const counts = new Map(entries);
        return field.values
            .filter((value) => counts.has(value))
            .map((value) => ({ value, count: counts.get(value) }));
    }
    return entries
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => left.value.localeCompare(right.value));
};

const createdDateChipLabel = (createdDate) =>
    createdDate?.to ? `${createdDate.from}-${createdDate.to}` : createdDate?.from;

export const createFilterControls = (container, availableFilters, onDraftChange, options = {}) => {
    let currentState = null;
    let controls = new Map();
    let openControl = null;

    const commitOpenControl = () => {
        if (!openControl) {
            return;
        }
        openControl.commit();
    };

    const cancelOpenControl = () => {
        if (!openControl) {
            return;
        }
        openControl.cancel();
    };

    document.addEventListener("pointerdown", (event) => {
        if (!openControl || openControl.root.contains(event.target)) {
            return;
        }
        if (options.isOutsideClickExempt?.(event.target)) {
            return;
        }
        commitOpenControl();
    });

    const applyDraftState = (nextState) => {
        const normalizedState = cloneSearchState(nextState);
        const changed = !searchFilterStateEqual(currentState, normalizedState);
        if (!changed) {
            render(currentState);
            return;
        }
        onDraftChange(normalizedState);
    };

    const buildCreatedDateControl = () => {
        const years = createdYearOptions(availableFilters);
        if (years.length === 0) {
            return null;
        }

        const root = createElement("section", {
            class: "search-filter-field search-created-date-field",
            "data-search-filter-field": CREATED_YEAR_FIELD,
        });
        const yearId = "search-filter-created-from";
        const toId = "search-filter-created-to";

        const heading = createElement("div", { class: "search-filter-label" }, CREATED_DATE_LABEL);
        const controls = createElement("div", { class: "search-created-date-controls" });
        const yearControl = createElement("div", { class: "search-created-date-control" });
        const yearLabel = createElement(
            "label",
            { class: "search-created-date-control-label", for: yearId },
            "Year",
        );
        const yearSelect = createElement("select", {
            id: yearId,
            class: "search-created-date-select",
        });
        const toControl = createElement("div", { class: "search-created-date-control" });
        const toLabel = createElement("label", { class: "search-created-date-control-label", for: toId }, "To");
        const toSelect = createElement("select", {
            id: toId,
            class: "search-created-date-select",
            disabled: true,
        });
        const summary = createElement("div", {
            class: "search-filter-summary",
            "aria-live": "polite",
        });
        const chips = createElement("div", { class: "search-filter-chips" });
        const clearButton = createElement(
            "button",
            {
                class: "search-filter-clear",
                type: "button",
            },
            "Clear created date",
        );

        const appendYearOptions = (select, includeAny = true) => {
            if (includeAny) {
                select.appendChild(createElement("option", { value: "" }, "Any"));
            } else {
                select.appendChild(createElement("option", { value: "", disabled: true, hidden: true }, ""));
            }
            for (const year of years) {
                select.appendChild(createElement("option", { value: year }, year));
            }
        };

        appendYearOptions(yearSelect);
        appendYearOptions(toSelect, false);
        yearControl.append(yearLabel, yearSelect);
        toControl.append(toLabel, toSelect);
        controls.append(yearControl, toControl);
        root.append(heading, controls, summary, chips, clearButton);

        const updateCreatedDate = (createdDate) => {
            const nextState = cloneSearchState(currentState);
            nextState.createdDate = createdDate;
            nextState.page = 1;
            applyDraftState(nextState);
        };

        const clearCreatedDate = () => updateCreatedDate({ from: null, to: null });

        const renderSelections = () => {
            const createdDate = currentState.createdDate || {};
            const selectedLabel = createdDateChipLabel(createdDate);
            yearSelect.value = createdDate.from || "";
            toSelect.disabled = !createdDate.from;
            toSelect.setAttribute("aria-disabled", createdDate.from ? "false" : "true");
            toSelect.value = createdDate.from ? createdDate.to || createdDate.from : "";
            summary.textContent = selectedLabel ? selectedSummary(1) : "No filters selected";
            clearButton.hidden = !selectedLabel;
            clearElement(chips);
            if (!selectedLabel) {
                return;
            }

            const chip = createElement("span", { class: "search-filter-chip" });
            chip.appendChild(createElement("span", { class: "search-filter-chip-label" }, selectedLabel));
            const remove = createElement(
                "button",
                {
                    class: "search-filter-chip-remove",
                    type: "button",
                    "aria-label": `Remove created date ${selectedLabel}`,
                },
                "x",
            );
            remove.addEventListener("click", clearCreatedDate);
            chip.appendChild(remove);
            chips.appendChild(chip);
        };

        yearSelect.addEventListener("change", () => {
            if (!yearSelect.value) {
                clearCreatedDate();
                return;
            }
            updateCreatedDate({ from: yearSelect.value, to: toSelect.value || yearSelect.value });
        });
        toSelect.addEventListener("change", () => {
            if (!yearSelect.value) {
                clearCreatedDate();
                return;
            }
            updateCreatedDate({ from: yearSelect.value, to: toSelect.value || null });
        });
        clearButton.addEventListener("click", clearCreatedDate);

        return {
            root,
            render: renderSelections,
        };
    };

    const buildControl = (field) => {
        const options = fieldOptions(availableFilters, field);
        if (options.length === 0) {
            return null;
        }

        let stagedValues = [...(currentState.filters[field.key] || [])];
        let stagedMode = currentState.modes.author || FILTER_MODE_ANY;
        let filterText = "";
        let isOpen = false;

        const root = createElement("section", {
            class: "search-filter-field",
            "data-search-filter-field": field.key,
        });
        const inputId = `search-filter-${field.key}`;
        const panelId = `search-filter-${field.key}-panel`;
        const listId = `search-filter-${field.key}-list`;

        const label = createElement("label", { for: inputId, class: "search-filter-label" }, field.label);
        const inputRow = createElement("div", { class: "search-filter-input-row" });
        const input = createElement("input", {
            id: inputId,
            class: "search-filter-input",
            type: "text",
            autocomplete: "off",
            role: "combobox",
            "aria-controls": listId,
            "aria-expanded": "false",
            "aria-autocomplete": "list",
            placeholder: field.placeholder,
        });
        const toggleButton = createElement("button", {
            class: "search-filter-toggle",
            type: "button",
            "aria-label": `Show ${field.label.toLowerCase()} options`,
            "aria-controls": panelId,
            "aria-expanded": "false",
        });
        toggleButton.appendChild(
            createElement("span", {
                class: "search-filter-toggle-icon",
                "aria-hidden": "true",
            }),
        );
        inputRow.append(input, toggleButton);

        const summary = createElement("div", {
            class: "search-filter-summary",
            "aria-live": "polite",
        });
        const chips = createElement("div", { class: "search-filter-chips" });
        const clearButton = createElement(
            "button",
            {
                class: "search-filter-clear",
                type: "button",
            },
            `Clear ${field.label.toLowerCase()}`,
        );

        const panel = createElement("div", {
            class: "search-filter-panel",
            id: panelId,
            hidden: true,
        });
        const modeGroup = createElement("div", {
            class: "search-filter-mode",
            role: "group",
            "aria-label": "Author operator",
        });
        const list = createElement("div", {
            class: "search-filter-options",
            id: listId,
            role: "listbox",
            "aria-multiselectable": "true",
        });
        const actions = createElement("div", { class: "search-filter-actions" });
        const panelClear = createElement(
            "button",
            { class: "search-filter-panel-clear", type: "button" },
            "Clear",
        );
        const done = createElement("button", { class: "search-filter-apply", type: "button" }, "Apply");
        actions.append(panelClear, done);
        panel.append(list, actions);
        root.append(label, inputRow, summary, chips, clearButton, panel);

        const commitValues = () => {
            const nextState = cloneSearchState(currentState);
            nextState.filters[field.key] = [...stagedValues];
            if (field.key === "author") {
                nextState.modes.author = stagedValues.length > 0 ? stagedMode : FILTER_MODE_ANY;
            }
            nextState.page = 1;
            close();
            applyDraftState(nextState);
        };

        const close = () => {
            isOpen = false;
            input.value = "";
            input.setAttribute("aria-expanded", "false");
            toggleButton.setAttribute("aria-expanded", "false");
            panel.hidden = true;
            openControl = null;
            renderSelections();
        };

        const cancel = () => {
            stagedValues = [...(currentState.filters[field.key] || [])];
            stagedMode = currentState.modes.author || FILTER_MODE_ANY;
            close();
        };

        const renderMode = () => {
            clearElement(modeGroup);
            if (field.key !== "author") {
                return;
            }
            modeGroup.appendChild(
                createElement("div", { class: "search-filter-mode-heading" }, "Choose operator"),
            );
            const modeOptions = createElement("div", { class: "search-filter-mode-options" });
            for (const [mode, labelText] of [
                [FILTER_MODE_ALL, "And"],
                [FILTER_MODE_ANY, "Or"],
            ]) {
                const button = createElement(
                    "button",
                    {
                        type: "button",
                        class: "search-filter-mode-button",
                        "aria-pressed": stagedMode === mode ? "true" : "false",
                    },
                    labelText,
                );
                button.addEventListener("click", () => {
                    stagedMode = mode;
                    renderMode();
                });
                modeOptions.appendChild(button);
            }
            modeGroup.appendChild(modeOptions);
            if (!panel.contains(modeGroup)) {
                panel.prepend(modeGroup);
            }
        };

        const toggleValue = (value, checked) => {
            if (checked && !stagedValues.includes(value)) {
                stagedValues.push(value);
            } else if (!checked) {
                stagedValues = stagedValues.filter((selected) => selected !== value);
            }
            renderSelections();
            renderOptions();
        };

        const removeValue = (value) => {
            if (isOpen) {
                stagedValues = stagedValues.filter((selected) => selected !== value);
                renderSelections();
                renderOptions();
                return;
            }
            const nextState = cloneSearchState(currentState);
            nextState.filters[field.key] = (nextState.filters[field.key] || []).filter(
                (selected) => selected !== value,
            );
            if (field.key === "author" && nextState.filters.author.length === 0) {
                nextState.modes.author = FILTER_MODE_ANY;
            }
            nextState.page = 1;
            applyDraftState(nextState);
        };

        const clearValues = () => {
            if (isOpen) {
                stagedValues = [];
                if (field.key === "author") {
                    stagedMode = FILTER_MODE_ANY;
                }
                renderSelections();
                renderOptions();
                renderMode();
                return;
            }
            const nextState = cloneSearchState(currentState);
            nextState.filters[field.key] = [];
            if (field.key === "author") {
                nextState.modes.author = FILTER_MODE_ANY;
            }
            nextState.page = 1;
            applyDraftState(nextState);
        };

        const renderSelections = () => {
            const committedValues = currentState.filters[field.key] || [];
            const visibleValues = isOpen ? stagedValues : committedValues;
            const count = visibleValues.length;
            summary.textContent = count === 0 ? "No filters selected" : selectedSummary(count);
            input.placeholder = count === 0 ? field.placeholder : selectedSummary(count);
            clearButton.hidden = count === 0;
            clearElement(chips);
            for (const value of visibleValues) {
                const chip = createElement("span", { class: "search-filter-chip" });
                chip.appendChild(createElement("span", { class: "search-filter-chip-label" }, value));
                const remove = createElement(
                    "button",
                    {
                        class: "search-filter-chip-remove",
                        type: "button",
                        "aria-label": `Remove ${filterLabel(field.key).toLowerCase()} ${value}`,
                    },
                    "x",
                );
                remove.addEventListener("click", () => removeValue(value));
                chip.appendChild(remove);
                chips.appendChild(chip);
            }
        };

        const renderOptions = () => {
            clearElement(list);
            const query = filterText.trim().toLowerCase();
            const matchingOptions = query
                ? options.filter((option) => option.value.toLowerCase().includes(query))
                : options;
            if (matchingOptions.length === 0) {
                list.appendChild(createElement("div", { class: "search-filter-empty" }, "No matching values"));
                return;
            }
            for (const option of matchingOptions) {
                const optionId = `${listId}-${option.value.replace(/[^a-z0-9_-]+/gi, "-")}`;
                const row = createElement("label", {
                    class: "search-filter-option",
                    role: "option",
                    "aria-selected": stagedValues.includes(option.value) ? "true" : "false",
                    for: optionId,
                });
                const checkbox = createElement("input", {
                    id: optionId,
                    type: "checkbox",
                    value: option.value,
                    checked: stagedValues.includes(option.value),
                });
                checkbox.addEventListener("change", () => toggleValue(option.value, checkbox.checked));
                row.append(
                    checkbox,
                    createElement("span", { class: "search-filter-option-label" }, option.value),
                    createElement("span", { class: "search-filter-option-count" }, String(option.count)),
                );
                row.setAttribute("aria-label", optionLabel(option.value, option.count));
                list.appendChild(row);
            }
        };

        const open = (keepFilterText = false) => {
            if (openControl && openControl !== control) {
                openControl.commit();
            }
            isOpen = true;
            openControl = control;
            stagedValues = [...(currentState.filters[field.key] || [])];
            stagedMode = currentState.modes.author || FILTER_MODE_ANY;
            if (!keepFilterText) {
                filterText = "";
                input.value = "";
            }
            input.setAttribute("aria-expanded", "true");
            toggleButton.setAttribute("aria-expanded", "true");
            panel.hidden = false;
            renderMode();
            renderSelections();
            renderOptions();
        };

        input.addEventListener("input", () => {
            filterText = input.value;
            if (!isOpen) {
                open(true);
            } else {
                renderOptions();
            }
        });
        input.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && isOpen) {
                event.preventDefault();
                cancel();
            } else if (event.key === "ArrowDown") {
                event.preventDefault();
                if (!isOpen) {
                    open();
                }
                list.querySelector("input")?.focus();
            } else if (event.key === "Enter" && isOpen) {
                event.preventDefault();
                commitValues();
            }
        });
        toggleButton.addEventListener("click", () => {
            if (isOpen) {
                commitValues();
            } else {
                open();
                input.focus();
            }
        });
        panel.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                cancel();
                input.focus();
            }
        });
        clearButton.addEventListener("click", clearValues);
        panelClear.addEventListener("click", clearValues);
        done.addEventListener("click", commitValues);

        const control = {
            root,
            commit: commitValues,
            cancel,
        };
        renderSelections();
        renderOptions();
        return control;
    };

    function render(nextState) {
        currentState = cloneSearchState(nextState);
        controls = new Map();
        openControl = null;
        clearElement(container);

        const visibleFields = FILTER_FIELDS.filter(
            (field) => fieldOptions(availableFilters, field).length > 0,
        );
        const createdDateControl = buildCreatedDateControl();
        if (visibleFields.length === 0 && !createdDateControl) {
            container.hidden = true;
            return;
        }
        container.hidden = false;

        const grid = createElement("div", { class: "search-filter-grid" });
        for (const field of visibleFields) {
            const control = buildControl(field);
            if (!control) {
                continue;
            }
            controls.set(field.key, control);
            grid.appendChild(control.root);
        }
        if (createdDateControl) {
            createdDateControl.render();
            grid.appendChild(createdDateControl.root);
        }
        container.appendChild(grid);
    }

    return {
        render,
        cancelOpen: cancelOpenControl,
        commitOpen: commitOpenControl,
    };
};
