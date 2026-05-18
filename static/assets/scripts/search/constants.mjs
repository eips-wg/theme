export const RESULT_LIMIT = 25;
export const QUICK_RESULT_LIMIT = 8;
export const QUICK_SEARCH_DEBOUNCE_MS = 150;

export const SORT_OPTIONS = {
    relevance: undefined,
    "number-asc": { number: "asc" },
    "number-desc": { number: "desc" },
    "created-asc": { created: "asc" },
    "created-desc": { created: "desc" },
};

export const FILTER_MODE_ANY = "any";
export const FILTER_MODE_ALL = "all";
export const AUTHOR_MODE_PARAM = "authorMode";
export const CREATED_YEAR_FIELD = "created_year";
export const CREATED_FROM_PARAM = "createdFrom";
export const CREATED_TO_PARAM = "createdTo";
export const CREATED_DATE_LABEL = "Created Date";
export const PROPOSAL_CATEGORY_KEY = "proposalCategory";
export const PROPOSAL_CATEGORY_FIELD = "proposal_category";
export const PROPOSAL_CATEGORY_VALUES = [
    "ERC",
    "Core",
    "Networking",
    "Interface",
    "Meta",
    "Informational",
];

export const FILTER_FIELDS = [
    {
        key: PROPOSAL_CATEGORY_KEY,
        urlParam: PROPOSAL_CATEGORY_KEY,
        pagefindField: PROPOSAL_CATEGORY_FIELD,
        label: "Proposal Category",
        placeholder: "Filter proposal categories",
        mode: FILTER_MODE_ANY,
        multiValue: false,
        values: PROPOSAL_CATEGORY_VALUES,
    },
    {
        key: "status",
        label: "Status",
        placeholder: "Filter statuses",
        mode: FILTER_MODE_ANY,
        multiValue: false,
    },
    {
        key: "author",
        label: "Author",
        placeholder: "Filter authors",
        mode: FILTER_MODE_ANY,
        multiValue: true,
    },
];

export const FILTER_FIELD_KEYS = FILTER_FIELDS.map((field) => field.key);
export const FILTER_FIELD_CONFIGS = Object.fromEntries(
    FILTER_FIELDS.map((field) => [field.key, field]),
);

export const filterUrlParam = (field) => field.urlParam || field.key;
export const filterPagefindField = (field) => field.pagefindField || field.key;
