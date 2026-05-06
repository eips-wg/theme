(function () {
  "use strict";

  const scriptElement = document.currentScript;
  const metadataPathSuffix = "/assets/data/proposals.json";
  const contentAnchorSelector = ".page-content a[href]";
  const popoverClass = "proposal-popover";
  const hideDelayMs = 150;
  const activeAnchors = new WeakMap();
  const anchorHideTimers = new WeakMap();
  const anchorTargets = new WeakMap();
  const anchorPopovers = new WeakMap();
  const popoverInputEnabled =
    !window.matchMedia ||
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  let disabled = false;
  let metadataPromise = null;
  let proposalMetadata = null;

  const metadataUrl = resolveMetadataUrl(scriptElement);
  const localBasePath = metadataUrl ? deriveLocalBasePath(metadataUrl) : "/";
  const currentPageIdentity = pageIdentityFromUrl(
    new URL(window.location.href, document.baseURI),
  );

  function resolveMetadataUrl(script) {
    const metadataUrlValue = script?.getAttribute("data-proposals-url");
    if (!metadataUrlValue) {
      return null;
    }

    try {
      return new URL(metadataUrlValue, document.baseURI);
    } catch (_error) {
      return null;
    }
  }

  function deriveLocalBasePath(url) {
    if (!url.pathname.endsWith(metadataPathSuffix)) {
      return "/";
    }

    const basePath = url.pathname.slice(
      0,
      url.pathname.length - metadataPathSuffix.length,
    );

    if (!basePath || basePath === "/") {
      return "/";
    }

    return basePath.endsWith("/") ? basePath : `${basePath}/`;
  }

  function disablePopovers() {
    disabled = true;
    metadataPromise = Promise.resolve(null);
    proposalMetadata = null;
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function scanProposalLinks() {
    if (!metadataUrl || !window.bootstrap?.Popover || !popoverInputEnabled) {
      disablePopovers();
      return;
    }

    for (const anchor of document.querySelectorAll(contentAnchorSelector)) {
      if (isSamePageAnchor(anchor)) {
        continue;
      }

      const target = targetFromAnchor(anchor);
      if (!target) {
        continue;
      }

      anchorTargets.set(anchor, target);
      anchor.addEventListener("pointerenter", handlePointerEnter);
      anchor.addEventListener("pointerleave", handlePointerLeave);
      anchor.addEventListener("focusin", handleFocusIn);
      anchor.addEventListener("focusout", handleFocusOut);
    }
  }

  function isSamePageAnchor(anchor) {
    let url;
    try {
      url = new URL(anchor.href, document.baseURI);
    } catch (_error) {
      return false;
    }

    const anchorIdentity = pageIdentityFromUrl(url);
    return (
      anchorIdentity.origin === currentPageIdentity.origin &&
      anchorIdentity.pathname === currentPageIdentity.pathname
    );
  }

  function pageIdentityFromUrl(url) {
    return {
      origin: url.origin,
      pathname: normalizedPagePath(
        stripLocalBasePath(url.pathname, url.origin),
      ),
    };
  }

  function normalizedPagePath(pathname) {
    let path = pathname || "/";
    path = path.replace(/\/index\.html$/i, "/");
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    return path;
  }

  function targetFromAnchor(anchor) {
    const href = anchor.getAttribute("href")?.trim();
    if (!href || href.startsWith("#") || anchor.classList.contains("anchor-link")) {
      return null;
    }

    let url;
    try {
      url = new URL(anchor.href, document.baseURI);
    } catch (_error) {
      return null;
    }

    url.search = "";
    url.hash = "";
    return targetFromUrl(url);
  }

  function targetFromUrl(url) {
    const publicPrefix = proposalPrefixForPublicHost(url.hostname);
    const path = publicPrefix
      ? url.pathname
      : stripLocalBasePath(url.pathname, url.origin);
    const explicitRoute = explicitRouteTarget(path);
    if (explicitRoute) {
      return explicitRoute;
    }

    const number = numericRouteNumber(path);
    if (!number) {
      return null;
    }

    if (publicPrefix) {
      return { key: metadataKey(publicPrefix, number) };
    }

    return { number };
  }

  function proposalPrefixForPublicHost(hostname) {
    const normalizedHost = hostname.toLowerCase();
    if (normalizedHost === "eips.ethereum.org") {
      return "EIP";
    }
    if (normalizedHost === "ercs.ethereum.org") {
      return "ERC";
    }
    return null;
  }

  function stripLocalBasePath(pathname, origin) {
    if (!metadataUrl || origin !== metadataUrl.origin || localBasePath === "/") {
      return pathname;
    }

    if (pathname === localBasePath.slice(0, -1)) {
      return "/";
    }

    if (pathname.startsWith(localBasePath)) {
      return `/${pathname.slice(localBasePath.length)}`;
    }

    return pathname;
  }

  function explicitRouteTarget(pathname) {
    const match = pathname.match(/^\/(EIPS|ERCS)\/(eip|erc)-0*([1-9]\d*)\/?$/i);
    if (!match) {
      return null;
    }

    const routePrefix = match[1].toUpperCase() === "ERCS" ? "ERC" : "EIP";
    return { key: metadataKey(routePrefix, Number(match[3])) };
  }

  function numericRouteNumber(pathname) {
    const match = pathname.match(/^\/0*([1-9]\d*)\/?$/);
    if (!match) {
      return null;
    }

    return Number(match[1]);
  }

  function metadataKey(prefix, number) {
    return `${prefix.toLowerCase()}-${number}`;
  }

  function handlePointerEnter(event) {
    const anchor = event.currentTarget;
    clearPendingHide(anchor);
    stateFor(anchor).hovered = true;
    activatePopover(anchor);
  }

  function handlePointerLeave(event) {
    const anchor = event.currentTarget;
    if (event.relatedTarget && anchor.contains(event.relatedTarget)) {
      return;
    }

    stateFor(anchor).hovered = false;
    scheduleInactiveHide(anchor);
  }

  function handleFocusIn(event) {
    const anchor = event.currentTarget;
    clearPendingHide(anchor);
    stateFor(anchor).focused = true;
    activatePopover(anchor);
  }

  function handleFocusOut(event) {
    const anchor = event.currentTarget;
    if (event.relatedTarget && anchor.contains(event.relatedTarget)) {
      return;
    }

    stateFor(anchor).focused = false;
    scheduleInactiveHide(anchor);
  }

  function stateFor(anchor) {
    let state = activeAnchors.get(anchor);
    if (!state) {
      state = { hovered: false, focused: false };
      activeAnchors.set(anchor, state);
    }

    return state;
  }

  function isAnchorActive(anchor) {
    const state = activeAnchors.get(anchor);
    return Boolean(state?.hovered || state?.focused);
  }

  function hideInactivePopover(anchor) {
    if (!isAnchorActive(anchor)) {
      anchorPopovers.get(anchor)?.hide();
    }
  }

  function clearPendingHide(anchor) {
    const timer = anchorHideTimers.get(anchor);
    if (!timer) {
      return;
    }

    window.clearTimeout(timer);
    anchorHideTimers.delete(anchor);
  }

  function scheduleInactiveHide(anchor) {
    clearPendingHide(anchor);
    anchorHideTimers.set(
      anchor,
      window.setTimeout(() => {
        anchorHideTimers.delete(anchor);
        hideInactivePopover(anchor);
      }, hideDelayMs),
    );
  }

  function activatePopover(anchor) {
    if (disabled) {
      return;
    }

    loadProposalMetadata().then((metadata) => {
      if (!metadata || disabled) {
        return;
      }

      const target = anchorTargets.get(anchor) || targetFromAnchor(anchor);
      const record = target ? recordForTarget(metadata, target) : null;
      if (!record) {
        return;
      }

      const popover = popoverForAnchor(anchor, record);
      if (isAnchorActive(anchor)) {
        popover.show();
      }
    });
  }

  function loadProposalMetadata() {
    if (disabled) {
      return Promise.resolve(null);
    }
    if (proposalMetadata) {
      return Promise.resolve(proposalMetadata);
    }
    if (metadataPromise) {
      return metadataPromise;
    }

    metadataPromise = fetch(metadataUrl.href, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`proposal metadata request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        proposalMetadata = parseProposalMetadata(payload);
        return proposalMetadata;
      })
      .catch((_error) => {
        disablePopovers();
        return null;
      });

    return metadataPromise;
  }

  function parseProposalMetadata(payload) {
    if (
      !payload ||
      payload.schema_version !== 1 ||
      !["EIP", "ERC"].includes(payload.active_prefix) ||
      !payload.proposals ||
      typeof payload.proposals !== "object"
    ) {
      throw new Error("unsupported proposal metadata schema");
    }

    const recordsByKey = new Map();
    const recordsByNumber = new Map();

    for (const [key, record] of Object.entries(payload.proposals)) {
      const normalizedRecord = normalizeRecord(key, record);
      if (!normalizedRecord) {
        continue;
      }

      recordsByKey.set(normalizedRecord.key, normalizedRecord);
      const recordsForNumber =
        recordsByNumber.get(normalizedRecord.number) || [];
      recordsForNumber.push(normalizedRecord);
      recordsByNumber.set(normalizedRecord.number, recordsForNumber);
    }

    return {
      activePrefix: payload.active_prefix,
      recordsByKey,
      recordsByNumber,
    };
  }

  function normalizeRecord(key, record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const number = Number(record.number);
    const prefix = typeof record.prefix === "string" ? record.prefix.toUpperCase() : "";
    if (
      !Number.isInteger(number) ||
      number <= 0 ||
      !["EIP", "ERC"].includes(prefix) ||
      !nonEmptyString(record.title) ||
      !nonEmptyString(record.status) ||
      !nonEmptyString(record.type)
    ) {
      return null;
    }

    return {
      key: key.toLowerCase(),
      number,
      prefix,
      title: record.title.trim(),
      description: optionalString(record.description),
      status: record.status.trim(),
      type: record.type.trim(),
      category: optionalString(record.category),
    };
  }

  function nonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "";
  }

  function optionalString(value) {
    return typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : null;
  }

  function recordForTarget(metadata, target) {
    if (target.key) {
      return metadata.recordsByKey.get(target.key) || null;
    }

    const recordsForNumber = metadata.recordsByNumber.get(target.number) || [];
    if (recordsForNumber.length === 1) {
      return recordsForNumber[0];
    }

    return (
      metadata.recordsByKey.get(metadataKey(metadata.activePrefix, target.number)) ||
      null
    );
  }

  function popoverForAnchor(anchor, record) {
    const existing = anchorPopovers.get(anchor);
    if (existing) {
      return existing;
    }

    const popover = new window.bootstrap.Popover(anchor, {
      trigger: "manual",
      html: true,
      customClass: popoverClass,
      placement: "auto",
      container: document.body,
      boundary: "viewport",
      offset: [0, 8],
      fallbackPlacements: ["top", "bottom", "right", "left"],
      title: () => popoverTitle(record),
      content: () => popoverContent(record),
    });

    anchorPopovers.set(anchor, popover);
    return popover;
  }

  function popoverTitle(record) {
    const title = document.createElement("span");
    title.textContent = `${record.prefix}-${record.number}: ${record.title}`;
    return title;
  }

  function popoverContent(record) {
    const body = document.createElement("div");
    body.className = "proposal-popover-body";

    if (record.description) {
      const description = document.createElement("p");
      description.className = "proposal-popover-description";
      description.textContent = record.description;
      body.appendChild(description);
    }

    const meta = document.createElement("div");
    meta.className = "proposal-popover-meta";
    meta.appendChild(metaItem("Status", record.status));
    meta.appendChild(metaItem("Type", record.type));
    if (record.category) {
      meta.appendChild(metaItem("Category", record.category));
    }
    body.appendChild(meta);

    return body;
  }

  function metaItem(label, value) {
    const item = document.createElement("span");
    item.className = "proposal-popover-meta-item";

    const labelElement = document.createElement("strong");
    labelElement.textContent = label;
    item.appendChild(labelElement);
    item.appendChild(document.createTextNode(`: ${value}`));

    return item;
  }

  onReady(scanProposalLinks);
})();
