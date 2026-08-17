import * as pricing from "./pricing.js";
import priceData from "../data/model-prices.json";
import intelligenceData from "../data/model-intelligence.json";

const canvas = document.getElementById("price-canvas");
const ctx = canvas.getContext("2d");

const THEME_STORAGE_KEY = "tokens-theme";
const systemDarkMedia = window.matchMedia("(prefers-color-scheme: dark)");
const initialTheme = (() => {
  try {
    const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return systemDarkMedia.matches ? "dark" : "light";
})();
document.documentElement.setAttribute("data-theme", initialTheme);

const state = {
  data: null,
  dpr: 1,
  width: 0,
  height: 0,
  metric: "outputUsdPer1M",
  timelineZoom: pricing.DEFAULT_TIMELINE_ZOOM,
  theme: initialTheme,
  themePreference: (() => {
    try { return window.localStorage?.getItem(THEME_STORAGE_KEY) || "system"; }
    catch { return "system"; }
  })(),
  hover: null,
  pointer: { x: -1, y: -1 },
  controls: [],
  timelineZoomControls: [],
  labToggles: [],
  cohortToggles: [],
  shareButton: null,
  filterButton: null,
  filterPanel: null,
  themeButton: null,
  bubblePanel: null,
  bubbleMinimizeButton: null,
  bubbleMinimized: false,
  enabledLabs: new Set(),
  enabledCohorts: new Set(),
  images: new Map(),
  startDateValue: null,
  endDateValue: null,
  draggingCursor: null,
  urlSyncPending: false,
  shareCopiedUntil: 0,
  filterPanelOpen: false,
  sharePopOpen: false,
  sharePopUrl: null,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  animationStart: performance.now()
};

systemDarkMedia.addEventListener?.("change", (event) => {
  if (state.themePreference !== "system") return;
  state.theme = event.matches ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", state.theme);
  draw();
});

const THEMES = {
  light: {
    bg1: "#fbfcfe",
    bg2: "#f4f6fa",
    bg3: "#eef1f6",
    glow: [255, 255, 255],
    tint: [199, 213, 234],
    tintAlpha: 0.28,
    surface: "rgba(255, 255, 255, 0.55)",
    plotBorder: "rgba(17, 24, 39, 0.06)",
    panel: "#ffffff",
    panelShadow: "rgba(15, 23, 42, 0.09)",
    panelBorder: "rgba(17, 24, 39, 0.06)",
    titleInk: "#0b1220",
    subtitleInk: "rgba(31, 41, 55, 0.62)",
    asOfInk: "rgba(17, 24, 39, 0.48)",
    bodyInk: "rgba(17, 24, 39, 0.7)",
    bodyInkSoft: "rgba(17, 24, 39, 0.62)",
    bodyInkSofter: "rgba(17, 24, 39, 0.48)",
    bodyInkVeryFaint: "rgba(17, 24, 39, 0.06)",
    chartGrid: "rgba(17, 24, 39, 0.075)",
    chartGridStrong: "rgba(17, 24, 39, 0.18)",
    axisInk: "rgba(17, 24, 39, 0.55)",
    axisLabelInk: "rgba(17, 24, 39, 0.58)",
    yearInk: "rgba(17, 24, 39, 0.54)",
    extendedSeries: "rgba(107, 114, 128, 0.72)",
    extendedSeriesPath: [107, 114, 128],
    ringRim: "rgba(255, 255, 255, 0.9)",
    seriesLabelInk: "rgba(17, 24, 39, 0.76)",
    cursorLine: "rgba(17, 24, 39, 0.42)",
    handleFill: "#ffffff",
    handleBorder: "rgba(17, 24, 39, 0.12)",
    handleGrip: "rgba(17, 24, 39, 0.36)",
    handleShadow: "rgba(15, 23, 42, 0.12)",
    controlBg: "#ffffff",
    controlBorder: "rgba(17, 24, 39, 0.08)",
    controlInk: "rgba(17, 24, 39, 0.68)",
    controlDivider: "rgba(17, 24, 39, 0.07)",
    controlShadow: "rgba(15, 23, 42, 0.05)",
    controlActiveBg: "#0b1220",
    controlActiveInk: "#ffffff",
    controlActiveShadow: "rgba(15, 23, 42, 0.18)",
    softButtonShadow: "rgba(15, 23, 42, 0.05)",
    softButtonBorder: "rgba(17, 24, 39, 0.08)",
    softButtonInk: "rgba(17, 24, 39, 0.72)",
    softButtonDim: "rgba(17, 24, 39, 0.6)",
    softButtonActiveBorder: "rgba(11, 18, 32, 0.92)",
    checkBg: "#ffffff",
    checkBorder: "rgba(17, 24, 39, 0.14)",
    checkOffInk: "rgba(107, 114, 128, 0.48)",
    checkOnInk: "rgba(17, 24, 39, 0.74)",
    cohortOnInk: "rgba(17, 24, 39, 0.76)",
    sectionLabel: "rgba(17, 24, 39, 0.42)",
    hoverLine: "rgba(17, 24, 39, 0.14)",
    hoverTableBg: "rgba(247, 248, 251, 0.95)",
    hoverTableBorder: "rgba(17, 24, 39, 0.08)",
    hoverRowDivider: "rgba(17, 24, 39, 0.06)",
    hoverLabelInk: "rgba(17, 24, 39, 0.6)",
    hoverValueInk: "#111827",
    hoverMetaInk: "rgba(17, 24, 39, 0.62)",
    hoverNoteInk: "rgba(17, 24, 39, 0.54)",
    bubbleConnector: "rgba(17, 24, 39, 0.16)",
    minimizeInk: "rgba(17, 24, 39, 0.42)",
    minimizeInkActive: "rgba(17, 24, 39, 0.85)"
  },
  dark: {
    bg1: "#0a0d14",
    bg2: "#0c1019",
    bg3: "#0e1422",
    glow: [80, 110, 170],
    tint: [40, 60, 100],
    tintAlpha: 0.22,
    surface: "rgba(255, 255, 255, 0.025)",
    plotBorder: "rgba(255, 255, 255, 0.06)",
    panel: "#161b27",
    panelShadow: "rgba(0, 0, 0, 0.45)",
    panelBorder: "rgba(255, 255, 255, 0.06)",
    titleInk: "#f3f6fb",
    subtitleInk: "rgba(226, 232, 240, 0.62)",
    asOfInk: "rgba(226, 232, 240, 0.42)",
    bodyInk: "rgba(226, 232, 240, 0.72)",
    bodyInkSoft: "rgba(226, 232, 240, 0.6)",
    bodyInkSofter: "rgba(226, 232, 240, 0.45)",
    bodyInkVeryFaint: "rgba(255, 255, 255, 0.06)",
    chartGrid: "rgba(255, 255, 255, 0.06)",
    chartGridStrong: "rgba(255, 255, 255, 0.14)",
    axisInk: "rgba(226, 232, 240, 0.5)",
    axisLabelInk: "rgba(226, 232, 240, 0.52)",
    yearInk: "rgba(226, 232, 240, 0.5)",
    extendedSeries: "rgba(148, 163, 184, 0.5)",
    extendedSeriesPath: [148, 163, 184],
    ringRim: "rgba(8, 12, 22, 0.9)",
    seriesLabelInk: "rgba(226, 232, 240, 0.74)",
    cursorLine: "rgba(226, 232, 240, 0.4)",
    handleFill: "#222837",
    handleBorder: "rgba(255, 255, 255, 0.16)",
    handleGrip: "rgba(226, 232, 240, 0.55)",
    handleShadow: "rgba(0, 0, 0, 0.5)",
    controlBg: "rgba(255, 255, 255, 0.04)",
    controlBorder: "rgba(255, 255, 255, 0.08)",
    controlInk: "rgba(226, 232, 240, 0.7)",
    controlDivider: "rgba(255, 255, 255, 0.06)",
    controlShadow: "rgba(0, 0, 0, 0.4)",
    controlActiveBg: "#f1f5f9",
    controlActiveInk: "#0b1220",
    controlActiveShadow: "rgba(0, 0, 0, 0.5)",
    softButtonShadow: "rgba(0, 0, 0, 0.4)",
    softButtonBorder: "rgba(255, 255, 255, 0.1)",
    softButtonInk: "rgba(226, 232, 240, 0.78)",
    softButtonDim: "rgba(226, 232, 240, 0.58)",
    softButtonActiveBorder: "rgba(241, 245, 249, 0.92)",
    checkBg: "rgba(255, 255, 255, 0.04)",
    checkBorder: "rgba(255, 255, 255, 0.18)",
    checkOffInk: "rgba(148, 163, 184, 0.55)",
    checkOnInk: "rgba(232, 238, 248, 0.85)",
    cohortOnInk: "rgba(232, 238, 248, 0.88)",
    sectionLabel: "rgba(226, 232, 240, 0.42)",
    hoverLine: "rgba(255, 255, 255, 0.14)",
    hoverTableBg: "rgba(18, 23, 33, 0.95)",
    hoverTableBorder: "rgba(255, 255, 255, 0.08)",
    hoverRowDivider: "rgba(255, 255, 255, 0.06)",
    hoverLabelInk: "rgba(226, 232, 240, 0.6)",
    hoverValueInk: "#f3f6fb",
    hoverMetaInk: "rgba(226, 232, 240, 0.62)",
    hoverNoteInk: "rgba(226, 232, 240, 0.5)",
    bubbleConnector: "rgba(255, 255, 255, 0.18)",
    minimizeInk: "rgba(226, 232, 240, 0.45)",
    minimizeInkActive: "rgba(241, 245, 249, 0.9)"
  }
};

function T() {
  return THEMES[state.theme];
}

function getSaBarHeight() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--sa-bar-h").trim();
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 48;
}

const metricOptions = pricing.metricOptions;
const cohortOptions = pricing.cohortOptions;
const timelineZoomOptions = pricing.timelineZoomOptions;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4
});

try {
  state.data = normalizeData(priceData, intelligenceData);
  applyViewState(pricing.createViewStateFromSearchParams(state.data, new URLSearchParams(window.location.search)));
  updateUrlFromState();
  bindEarlyAccessForm();
  bindSharePop();
  loadImages(state.data).then(() => {
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("popstate", onPopState);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    requestAnimationFrame(draw);
  });
} catch (error) {
  resize();
  drawError(error);
}

function normalizeData(data, intelligenceData) {
  return pricing.normalizeData(data, intelligenceData);
}

function applyViewState(view) {
  state.metric = view.metric;
  state.timelineZoom = view.timelineZoom;
  state.enabledLabs = new Set(view.enabledLabs);
  state.enabledCohorts = new Set(view.enabledCohorts);
  state.startDateValue = view.startDateValue;
  state.endDateValue = view.endDateValue;
  clampCompareDateToVisibleRange();
}

function getViewState() {
  return {
    metric: state.metric,
    timelineZoom: state.timelineZoom,
    enabledLabs: state.enabledLabs,
    enabledCohorts: state.enabledCohorts,
    startDateValue: state.startDateValue,
    endDateValue: state.endDateValue
  };
}

function updateUrlFromState() {
  if (!state.data || state.startDateValue == null || state.endDateValue == null) return;
  const params = pricing.serializeViewState(state.data, getViewState());
  const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
  updateDocumentOgUrl(params);
  if (state.sharePopOpen && !state.draggingCursor) {
    setSharePopPreview();
    state.sharePopUrl = getCurrentShareUrl();
  }
}

function scheduleUrlSync() {
  if (state.urlSyncPending) return;
  state.urlSyncPending = true;
  requestAnimationFrame(() => {
    state.urlSyncPending = false;
    updateUrlFromState();
  });
}

function updateDocumentOgUrl(params = pricing.serializeViewState(state.data, getViewState())) {
  const imageUrl = new URL("/api/og", window.location.origin);
  imageUrl.search = params.toString();
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", imageUrl.toString());
  document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", imageUrl.toString());
}

function onPopState() {
  applyViewState(pricing.createViewStateFromSearchParams(state.data, new URLSearchParams(window.location.search)));
  state.hover = null;
  draw();
}

function initializeCompareDate() {
  const { min: dateMin, max: dateMax } = getVisibleDateExtent();
  state.startDateValue = dateMin + (dateMax - dateMin) * 0.5;
  state.endDateValue = dateMax;
}

function initializeEnabledLabs() {
  state.enabledLabs = new Set(Array.from(state.data.labs.keys()));
}

function initializeEnabledCohorts() {
  state.enabledCohorts = new Set(cohortOptions.map((cohort) => cohort.id));
}

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function getVisiblePoints() {
  return pricing.getVisiblePoints(state.data, getViewState());
}

function getVisibleDateExtent() {
  return pricing.getVisibleDateExtent(state.data, getViewState());
}

function getVisibleSeriesEntries() {
  return pricing.getVisibleSeriesEntries(state.data, getViewState());
}

function isLabEnabled(labId) {
  return state.enabledLabs.has(labId);
}

function isCohortEnabled(cohortId) {
  return state.enabledCohorts.has(cohortId);
}

async function loadImages(data) {
  const imagePaths = [
    ...Array.from(data.labs.values()).map((lab) => lab.logo)
  ];

  await Promise.all(
    imagePaths.map(
      (src) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            state.images.set(src, image);
            resolve();
          };
          image.onerror = resolve;
          image.src = src;
        })
    )
  );
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = Math.floor(window.innerWidth);
  state.height = Math.max(240, Math.floor(window.innerHeight) - getSaBarHeight());
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  if (state.sharePopOpen) positionSharePop();
  draw();
}

function onPointerMove(event) {
  if (event.pointerType === "touch") event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  state.pointer = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };

  if (state.draggingCursor) {
    updateComparisonDateFromX(state.draggingCursor, state.pointer.x);
    scheduleUrlSync();
  }

  canvas.style.cursor = getPointerCursor(state.pointer);
  draw();
}

function onPointerLeave() {
  if (state.draggingCursor) return;
  state.pointer = { x: -1, y: -1 };
  state.hover = null;
  canvas.style.cursor = "crosshair";
  draw();
}

function onPointerDown(event) {
  if (event.pointerType === "touch") event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const pointer = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };

  const onControl = getControlAt(pointer.x, pointer.y);
  const onTimelineZoom = getTimelineZoomControlAt(pointer.x, pointer.y);
  const onLabToggle = getLabToggleAt(pointer.x, pointer.y);
  const onCohortToggle = getCohortToggleAt(pointer.x, pointer.y);
  const onShareButton = getShareButtonAt(pointer.x, pointer.y);
  const onFilterButton = getFilterButtonAt(pointer.x, pointer.y);
  const onFilterPanel = getFilterPanelAt(pointer.x, pointer.y);
  const onThemeButton = getThemeButtonAt(pointer.x, pointer.y);
  const onBubbleMinimize = getBubbleMinimizeAt(pointer.x, pointer.y);
  const onBubblePanel = getBubblePanelAt(pointer.x, pointer.y);
  if (
    onControl ||
    onTimelineZoom ||
    onLabToggle ||
    onCohortToggle ||
    onShareButton ||
    onFilterButton ||
    onFilterPanel ||
    onThemeButton ||
    onBubbleMinimize ||
    onBubblePanel
  ) return;

  const cursor = getComparisonCursorAt(pointer);
  if (cursor) {
    state.draggingCursor = cursor;
    canvas.setPointerCapture?.(event.pointerId);
    updateComparisonDateFromX(cursor, pointer.x);
    draw();
  }
}

function onPointerUp() {
  const wasDragging = state.draggingCursor;
  state.draggingCursor = null;
  if (wasDragging) updateUrlFromState();
}

function onTouchStart(event) {
  const touch = event.touches[0];
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  state.pointer = {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

function onClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const shareButton = getShareButtonAt(x, y);
  const filterButton = getFilterButtonAt(x, y);

  if (shareButton) {
    toggleSharePop();
    return;
  }

  if (filterButton) {
    state.filterPanelOpen = !state.filterPanelOpen;
    state.hover = null;
    draw();
    return;
  }

  if (getThemeButtonAt(x, y)) {
    toggleTheme();
    return;
  }

  const labToggle = getLabToggleAt(x, y);

  if (labToggle) {
    toggleLab(labToggle.labId);
    updateUrlFromState();
    draw();
    return;
  }

  const cohortToggle = getCohortToggleAt(x, y);

  if (cohortToggle) {
    toggleCohort(cohortToggle.cohortId);
    updateUrlFromState();
    draw();
    return;
  }

  const control = getControlAt(x, y);

  if (control) {
    state.metric = control.id;
    updateUrlFromState();
    draw();
    return;
  }

  const timelineZoom = getTimelineZoomControlAt(x, y);

  if (timelineZoom) {
    setTimelineZoom(timelineZoom.id);
    return;
  }

  if (getBubbleMinimizeAt(x, y)) {
    state.bubbleMinimized = true;
    state.hover = null;
    draw();
    return;
  }

  if (state.bubbleMinimized && getBubblePanelAt(x, y)) {
    state.bubbleMinimized = false;
    state.hover = null;
    draw();
    return;
  }

  const layout = getLayout(state.width, state.height);
  if (layout.compact && state.filterPanelOpen && getFilterPanelAt(x, y)) return;
  if (layout.compact && state.filterPanelOpen) {
    state.filterPanelOpen = false;
    draw();
  }
}

function getCurrentShareUrl() {
  if (!state.data) return window.location.href;
  const params = pricing.serializeViewState(state.data, getViewState());
  const next = new URL(window.location.href);
  next.search = params.toString();
  return next.toString();
}

function getCurrentOgUrl() {
  if (!state.data) return new URL("/api/og", window.location.origin).toString();
  const params = pricing.serializeViewState(state.data, getViewState());
  const og = new URL("/api/og", window.location.origin);
  og.search = params.toString();
  return og.toString();
}

function toggleSharePop() {
  if (state.sharePopOpen) {
    closeSharePop();
  } else {
    openSharePop();
  }
}

function openSharePop() {
  const popup = document.getElementById("share-pop");
  if (!popup) return;
  state.sharePopOpen = true;
  updateUrlFromState();
  state.sharePopUrl = getCurrentShareUrl();
  setSharePopPreview();
  popup.hidden = false;
  requestAnimationFrame(() => {
    popup.setAttribute("data-open", "true");
    positionSharePop();
  });
  draw();
  document.addEventListener("pointerdown", onSharePopOutsidePointer, true);
  document.addEventListener("keydown", onSharePopKey);
}

function closeSharePop() {
  if (!state.sharePopOpen) return;
  state.sharePopOpen = false;
  const popup = document.getElementById("share-pop");
  if (popup) {
    popup.removeAttribute("data-open");
    window.setTimeout(() => {
      if (!state.sharePopOpen) popup.hidden = true;
    }, 180);
  }
  document.removeEventListener("pointerdown", onSharePopOutsidePointer, true);
  document.removeEventListener("keydown", onSharePopKey);
  draw();
}

function onSharePopOutsidePointer(event) {
  const popup = document.getElementById("share-pop");
  if (!popup) return;
  if (popup.contains(event.target)) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (getShareButtonAt(x, y)) return;
  closeSharePop();
}

function onSharePopKey(event) {
  if (event.key === "Escape") closeSharePop();
}

function positionSharePop() {
  const popup = document.getElementById("share-pop");
  if (!popup || !state.shareButton) return;
  const rect = canvas.getBoundingClientRect();
  const btn = state.shareButton;
  const popW = Math.min(360, window.innerWidth - 24);
  const margin = 8;
  const top = rect.top + btn.y + btn.h + 10;
  let left = rect.left + btn.x;
  if (left + popW + margin > window.innerWidth) {
    left = Math.max(margin, window.innerWidth - popW - margin);
  }
  popup.style.left = `${Math.max(margin, left)}px`;
  popup.style.top = `${Math.max(margin, top)}px`;
  popup.style.width = `${popW}px`;
}

function setSharePopPreview() {
  const img = document.getElementById("share-pop-img");
  if (!img) return;
  img.classList.remove("is-loaded");
  img.removeAttribute("src");
  const og = getCurrentOgUrl();
  img.onload = () => img.classList.add("is-loaded");
  img.src = og;
}

async function handleCopyShareLink() {
  const url = state.sharePopUrl || getCurrentShareUrl();
  const button = document.getElementById("share-pop-copy");
  const labelEl = button?.querySelector(".share-pop-copy-label");
  try {
    await navigator.clipboard.writeText(url);
  } catch {}
  if (button) {
    button.classList.add("is-copied");
    if (labelEl) labelEl.textContent = "Link copied";
    window.setTimeout(() => {
      button.classList.remove("is-copied");
      if (labelEl) labelEl.textContent = "Copy link";
    }, 1600);
  }
  state.shareCopiedUntil = performance.now() + 1800;
  draw();
}

function buildShareIntentUrl(intent, url) {
  const title = "Are tokens getting cheaper?";
  switch (intent) {
    case "x":
      return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`;
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(url)}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case "hn":
      return `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(url)}&t=${encodeURIComponent(title)}`;
    default:
      return url;
  }
}

function bindSharePop() {
  const popup = document.getElementById("share-pop");
  if (!popup) return;
  const copyBtn = document.getElementById("share-pop-copy");
  copyBtn?.addEventListener("click", handleCopyShareLink);
  popup.querySelectorAll(".share-pop-intent").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      const intent = node.dataset.intent;
      const url = state.sharePopUrl || getCurrentShareUrl();
      window.open(buildShareIntentUrl(intent, url), "_blank", "noopener");
    });
  });
}

function draw(now = performance.now()) {
  if (!state.data) return;

  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);

  drawBackdrop(width, height, now);

  const layout = getLayout(width, height);
  const scales = getScales(layout);
  const drawnPoints = [];

  drawHeader(layout);
  drawPlotSurface(layout);
  drawAxes(layout, scales);
  drawLines(layout, scales, drawnPoints, now);
  drawSeriesLabels(layout, scales);
  drawComparisonCursors(layout, scales);
  drawFootnotes(layout);
  drawHover(layout, drawnPoints);
  drawControls(layout);
}

function drawBackdrop(width, height, now) {
  const t = T();
  ctx.save();
  const pulse = state.reducedMotion ? 0 : Math.sin((now - state.animationStart) / 4200) * 0.015;

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, t.bg1);
  base.addColorStop(0.55, t.bg2);
  base.addColorStop(1, t.bg3);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.18,
    height * 0.02,
    0,
    width * 0.18,
    height * 0.02,
    Math.max(width, height) * 0.7
  );
  const [gr, gg, gb] = t.glow;
  glow.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${(state.theme === "dark" ? 0.08 : 0.7) + pulse})`);
  glow.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const tint = ctx.createRadialGradient(
    width * 0.88,
    height * 1.05,
    0,
    width * 0.88,
    height * 1.05,
    Math.max(width, height) * 0.65
  );
  const [tr, tg, tb] = t.tint;
  tint.addColorStop(0, `rgba(${tr}, ${tg}, ${tb}, ${t.tintAlpha})`);
  tint.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0)`);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

function getLayout(width, height) {
  const compact = width < 1180 || height < 560;
  const margin = compact
    ? { top: width < 720 ? 224 : 180, right: 18, bottom: 44, left: 50 }
    : { top: 152, right: 204, bottom: 84, left: 92 };

  return {
    compact,
    width,
    height,
    chart: {
      x: margin.left,
      y: margin.top,
      w: Math.max(260, width - margin.left - margin.right),
      h: Math.max(240, height - margin.top - margin.bottom)
    },
    margin
  };
}

function getScales(layout) {
  const points = pricing.getVisibleTimelinePoints(state.data, getViewState());
  const values = points
    .map((point) => metricValue(point))
    .filter((value) => Number.isFinite(value));
  const { min: dateMin, max: dateMax } = getVisibleDateExtent();
  const minValue = values.length ? Math.min(...values) : 0.1;
  const maxValue = values.length ? Math.max(...values) : 1;
  const min = Math.max(0.005, minValue * 0.72);
  const max = maxValue * 1.35;
  const yMin = Math.pow(10, Math.floor(Math.log10(min)));
  const yMax = Math.pow(10, Math.ceil(Math.log10(max)));
  const dateRange = dateMax - dateMin || 1;

  return {
    dateMin,
    dateMax,
    yMin,
    yMax,
    x: (dateValue) => {
      const t = (dateValue - dateMin) / dateRange;
      return layout.chart.x + t * layout.chart.w;
    },
    y: (value) => {
      const t = (Math.log10(value) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin));
      return layout.chart.y + layout.chart.h - t * layout.chart.h;
    }
  };
}

function drawHeader(layout) {
  const { width, compact } = layout;
  const t = T();
  const x = compact ? 20 : 36;
  const y = compact ? 24 : 32;
  const themeBtnW = 32;
  const asOfPadRight = compact ? x : x + themeBtnW + 12;

  ctx.save();
  ctx.fillStyle = t.titleInk;
  ctx.font = `600 ${compact ? 22 : 32}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText("Are tokens getting cheaper?", x, y);

  ctx.fillStyle = t.subtitleInk;
  ctx.font = `${compact ? 12 : 14}px Inter, system-ui, sans-serif`;
  const subtitle =
    pricing.isIntelligenceMetric(state.metric)
      ? compact
        ? "Price per AA intelligence point, log scale"
        : "Combined token price per Artificial Analysis intelligence point over time"
      : compact
        ? "Major lab API prices, log scale, USD / 1M tokens"
        : "Token prices over time for OpenAI, Anthropic, and Google API model lines";
  ctx.fillText(subtitle, x, y + (compact ? 32 : 44));

  if (!compact) {
    ctx.textAlign = "right";
    ctx.fillStyle = t.asOfInk;
    ctx.font = `500 12px Inter, system-ui, sans-serif`;
    ctx.fillText(`Data as of ${state.data.meta.asOf}`, width - asOfPadRight, y + 10);
  }
  ctx.restore();

  drawThemeToggle(layout);
}

function drawThemeToggle(layout) {
  const compact = layout.compact;
  const size = 32;
  const x = layout.width - (compact ? 18 : 36) - size;
  const y = compact ? 24 : 30;
  const t = T();
  const hovered = isPointerInRect(x, y, size, size);

  ctx.save();
  ctx.shadowColor = t.softButtonShadow;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = t.controlBg;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.strokeStyle = t.softButtonBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  drawThemeGlyph(x + size / 2, y + size / 2, hovered ? t.titleInk : t.softButtonDim);

  state.themeButton = { x, y, w: size, h: size };
}

const MOON_PATH = new Path2D(
  "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
);
const SUN_PATH = new Path2D(
  "M12 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11ZM12 4V2M12 22v-2M4 12H2M22 12h-2M5.64 5.64L4.22 4.22M19.78 19.78l-1.42-1.42M5.64 18.36l-1.42 1.42M19.78 4.22l-1.42 1.42"
);

function drawThemeGlyph(cx, cy, color) {
  const glyphSize = 17;
  const sourceSize = 24;
  const scale = glyphSize / sourceSize;
  ctx.save();
  ctx.translate(cx - (sourceSize * scale) / 2, cy - (sourceSize * scale) / 2);
  ctx.scale(scale, scale);
  if (state.theme === "dark") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(SUN_PATH);
  } else {
    ctx.fillStyle = color;
    ctx.fill(MOON_PATH);
  }
  ctx.restore();
}

function toggleTheme() {
  const next = state.theme === "dark" ? "light" : "dark";
  state.theme = next;
  state.themePreference = next;
  document.documentElement.setAttribute("data-theme", next);
  try { window.localStorage?.setItem(THEME_STORAGE_KEY, next); } catch {}
  draw();
}

function getSeriesColor(series) {
  if (state.theme !== "dark") return series.color;
  if (series.id === "openai-gpt-frontier") return "#f8fafc";
  if (series.id === "openai-gpt-mini") return "#cbd5e1";
  if (series.id === "openai-gpt-nano") return "#94a3b8";
  return series.color;
}

function getLabColor(lab) {
  if (state.theme === "dark" && lab.id === "openai") return "#e2e8f0";
  return lab.brandColor;
}

function getCohortColor(cohort) {
  if (state.theme === "dark" && cohort.id === "frontier") return "#e2e8f0";
  return cohort.color;
}

function getThemeButtonAt(x, y) {
  const item = state.themeButton;
  if (!item) return null;
  return x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h ? item : null;
}

function drawControls(layout) {
  const { compact, width } = layout;
  const controlY = compact ? 96 : 100;
  state.controls = [];
  state.timelineZoomControls = [];
  state.labToggles = [];
  state.cohortToggles = [];
  state.shareButton = null;
  state.filterButton = null;
  state.filterPanel = null;
  const metricLayout = getMetricControlLayout(layout);

  ctx.save();
  drawMetricControls(metricLayout);
  drawTimelineZoomControls(layout);

  if (compact) {
    const filterW = measureFilterButtonWidth(compact);
    const shareW = measureShareButtonWidth(compact);
    const inlineActions = layout.width - (metricLayout.x + metricLayout.w) - 20 >= filterW + shareW + 10;
    const actionY = inlineActions ? metricLayout.y : metricLayout.y + metricLayout.h + 12;
    const shareX = layout.width - 20 - shareW;
    const filterX = inlineActions ? shareX - 10 - filterW : layout.chart.x;
    const finalShareX = inlineActions ? shareX : filterX + filterW + 10;
    drawFilterButton(filterX, actionY, compact);
    drawShareButton(finalShareX, actionY, compact);
    if (state.filterPanelOpen) drawCompactFilterPanel(layout, actionY + 40);
  } else {
    const right = width - 36;
    const cohortWidth = measureCohortTogglesWidth(compact);
    const labWidth = measureLabTogglesWidth(compact);
    const shareWidth = measureShareButtonWidth(compact);
    const cohortX = right - cohortWidth;
    const labX = cohortX - 28 - labWidth;
    const shareX = Math.max(metricLayout.x + metricLayout.w + 32, labX - 24 - shareWidth);

    drawShareButton(shareX, controlY, compact);
    drawLabToggles(labX, controlY + 17, compact);
    drawCohortToggles(cohortX, controlY + 17, compact);
  }

  ctx.restore();
}

function drawTimelineZoomControls(layout) {
  const { chart, compact } = layout;
  const h = 28;
  const itemW = compact ? 38 : 40;
  const w = itemW * timelineZoomOptions.length;
  const x = compact ? chart.x + chart.w - w : chart.x;
  const y = compact ? chart.y - h - 10 : chart.y + chart.h + 42;
  const activeIndex = timelineZoomOptions.findIndex((option) => option.id === state.timelineZoom);
  const t = T();

  ctx.save();
  if (!compact) {
    ctx.fillStyle = t.sectionLabel;
    ctx.font = "600 9px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("TIMELINE", x + 2, y - 7);
  }

  ctx.shadowColor = t.controlShadow;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  roundedRect(x, y, w, h, h / 2);
  ctx.fillStyle = t.controlBg;
  ctx.fill();
  ctx.restore();

  roundedRect(x, y, w, h, h / 2);
  ctx.strokeStyle = t.controlBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${compact ? 10.5 : 11}px Inter, system-ui, sans-serif`;
  timelineZoomOptions.forEach((option, index) => {
    const item = { id: option.id, x: x + itemW * index, y, w: itemW, h };
    const active = index === activeIndex;
    const adjacentToActive = index === activeIndex + 1 || index === activeIndex - 1;
    if (active) {
      roundedRect(item.x + 2, y + 2, item.w - 4, h - 4, h / 2 - 2);
      ctx.fillStyle = t.controlActiveBg;
      ctx.fill();
    } else if (index > 0 && !adjacentToActive) {
      ctx.strokeStyle = t.controlDivider;
      ctx.beginPath();
      ctx.moveTo(item.x, y + 7);
      ctx.lineTo(item.x, y + h - 7);
      ctx.stroke();
    }
    ctx.fillStyle = active ? t.controlActiveInk : t.controlInk;
    ctx.fillText(option.label, item.x + item.w / 2, y + h / 2 + 0.5);
    state.timelineZoomControls.push(item);
  });
  ctx.restore();
}

function getMetricControlLayout(layout) {
  const compact = layout.compact;
  const fontSize = compact ? 11.5 : 13;
  const h = compact ? 32 : 36;
  const gap = compact ? 2 : 4;
  const padX = compact ? 12 : 18;
  const minWidth = compact ? 54 : 74;
  const y = compact ? 96 : 100;
  const x = layout.chart.x;
  const availableWidth = Math.max(220, layout.width - x - 16 - (compact ? 0 : 260));

  ctx.save();
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  const widths = fitSegmentWidths(
    metricOptions.map((option) => Math.max(minWidth, Math.ceil(ctx.measureText(option.label).width + padX * 2))),
    availableWidth - gap * (metricOptions.length - 1),
    minWidth
  );
  ctx.restore();

  const items = [];
  let itemX = x;
  for (let index = 0; index < metricOptions.length; index += 1) {
    const option = metricOptions[index];
    const w = widths[index];
    items.push({ id: option.id, x: itemX, y, w, h });
    itemX += w + gap;
  }

  return {
    compact,
    fontSize,
    h,
    x,
    y,
    w: itemX - x - gap,
    items
  };
}

function fitSegmentWidths(widths, availableWidth, minWidth) {
  const next = [...widths];
  let overflow = next.reduce((sum, width) => sum + width, 0) - availableWidth;
  while (overflow > 0) {
    let adjusted = false;
    for (let index = next.length - 1; index >= 0 && overflow > 0; index -= 1) {
      if (next[index] <= minWidth) continue;
      next[index] -= 1;
      overflow -= 1;
      adjusted = true;
    }
    if (!adjusted) break;
  }
  return next;
}

function drawFilterButton(x, y, compact) {
  const h = compact ? 32 : 32;
  const w = measureFilterButtonWidth(compact);
  const active = state.filterPanelOpen;
  const enabled = state.enabledLabs.size + state.enabledCohorts.size;
  const total = state.data.labs.size + cohortOptions.length;
  const text = `Filters ${enabled}/${total}`;
  const t = T();

  drawSoftButton(x, y, w, h, active);

  ctx.fillStyle = active ? t.controlActiveInk : t.softButtonInk;
  ctx.font = `600 ${compact ? 12 : 13}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 14, y + h / 2 + 0.5);
  drawChevron(x + w - 22, y + h / 2, active, active ? t.controlActiveInk : t.softButtonDim);

  state.filterButton = { x, y, w, h };
}

function measureFilterButtonWidth(compact) {
  return compact ? 132 : 144;
}

function drawShareButton(x, y, compact) {
  const h = compact ? 32 : 34;
  const w = measureShareButtonWidth(compact);
  const copied = performance.now() < state.shareCopiedUntil;
  const active = state.sharePopOpen || copied;
  const label = copied ? "Copied" : "Share view";
  const t = T();

  drawSoftButton(x, y, w, h, active);

  drawShareGlyph(x + 18, y + h / 2, active ? t.controlActiveInk : t.softButtonDim);
  ctx.fillStyle = active ? t.controlActiveInk : t.softButtonInk;
  ctx.font = `600 ${compact ? 12 : 13}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 32, y + h / 2 + 0.5);

  state.shareButton = { x, y, w, h };
}

function measureShareButtonWidth(compact) {
  return compact ? 112 : 122;
}

function drawSoftButton(x, y, w, h, active) {
  const t = T();
  ctx.save();
  ctx.shadowColor = t.softButtonShadow;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  roundedRect(x, y, w, h, h / 2);
  ctx.fillStyle = active ? t.controlActiveBg : t.controlBg;
  ctx.fill();
  ctx.restore();
  roundedRect(x, y, w, h, h / 2);
  ctx.strokeStyle = active ? t.softButtonActiveBorder : t.softButtonBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawShareGlyph(x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x - 4, y + 4, 2.4, 0, Math.PI * 2);
  ctx.arc(x + 4, y, 2.4, 0, Math.PI * 2);
  ctx.arc(x - 4, y - 4, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 2, y + 3);
  ctx.lineTo(x + 2, y + 1);
  ctx.moveTo(x - 2, y - 3);
  ctx.lineTo(x + 2, y - 1);
  ctx.stroke();
  ctx.restore();
}

function drawCompactFilterPanel(layout, y) {
  const x = 18;
  const w = layout.width - 36;
  const h = 132;
  state.filterPanel = { x, y, w, h };
  shadowedPanel(x, y, w, h, 14);

  const t = T();
  ctx.save();
  ctx.fillStyle = t.sectionLabel;
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("LABS", x + 16, y + 22);
  drawLabToggles(x + 16, y + 48, true);
  ctx.fillStyle = t.sectionLabel;
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.fillText("MODELS", x + 16, y + 82);
  drawCohortToggles(x + 16, y + 106, true);
  ctx.restore();
}

function drawChevron(x, y, open, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (open) {
    ctx.moveTo(x - 4, y + 2);
    ctx.lineTo(x, y - 2);
    ctx.lineTo(x + 4, y + 2);
  } else {
    ctx.moveTo(x - 4, y - 2);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + 4, y - 2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawMetricControls(layout) {
  const { compact, fontSize, items, x, y, w, h } = layout;
  const activeIndex = items.findIndex((item) => item.id === state.metric);
  const t = T();

  ctx.save();
  ctx.shadowColor = t.controlShadow;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  roundedRect(x, y, w, h, h / 2);
  ctx.fillStyle = t.controlBg;
  ctx.fill();
  ctx.restore();

  roundedRect(x, y, w, h, h / 2);
  ctx.strokeStyle = t.controlBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;

  items.forEach((item, index) => {
    const active = index === activeIndex;
    const adjacentToActive = index === activeIndex + 1 || index === activeIndex - 1;
    if (active) {
      ctx.save();
      ctx.shadowColor = t.controlActiveShadow;
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 1;
      roundedRect(item.x + 2, item.y + 2, item.w - 4, item.h - 4, item.h / 2 - 2);
      ctx.fillStyle = t.controlActiveBg;
      ctx.fill();
      ctx.restore();
    } else if (index > 0 && !adjacentToActive) {
      ctx.strokeStyle = t.controlDivider;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(item.x - 1, item.y + 8);
      ctx.lineTo(item.x - 1, item.y + item.h - 8);
      ctx.stroke();
    }

    ctx.fillStyle = active ? t.controlActiveInk : t.controlInk;
    ctx.fillText(metricOptions[index].label, item.x + item.w / 2, item.y + item.h / 2 + 0.5);
    state.controls.push(item);
  });

  ctx.restore();
}

function drawPlotSurface(layout) {
  const { chart } = layout;
  const t = T();
  ctx.save();
  ctx.fillStyle = t.surface;
  ctx.fillRect(chart.x, chart.y, chart.w, chart.h);
  ctx.strokeStyle = t.plotBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(chart.x + 0.5, chart.y + 0.5, chart.w, chart.h);
  ctx.restore();
}

function drawAxes(layout, scales) {
  const { chart, compact } = layout;
  const t = T();
  const yTicks = pricing.getLogTicks(scales.yMin, scales.yMax);
  const timelineTicks = pricing.getTimelineTicks(scales.dateMin, scales.dateMax);

  ctx.save();
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;

  yTicks.forEach((tick) => {
    const y = scales.y(tick);
    ctx.strokeStyle = tick === 1 ? t.chartGridStrong : t.chartGrid;
    ctx.beginPath();
    ctx.moveTo(chart.x, y);
    ctx.lineTo(chart.x + chart.w, y);
    ctx.stroke();
    ctx.fillStyle = t.axisInk;
    ctx.fillText(formatAxisMoney(tick), chart.x - 10, y);
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  timelineTicks.forEach((tick) => {
    const x = scales.x(tick.value);
    if (x < chart.x || x > chart.x + chart.w) return;
    ctx.strokeStyle = t.chartGrid;
    ctx.beginPath();
    ctx.moveTo(x, chart.y);
    ctx.lineTo(x, chart.y + chart.h);
    ctx.stroke();
    ctx.fillStyle = t.yearInk;
    ctx.fillText(tick.label, x, chart.y + chart.h + 14);
  });

  if (!compact) {
    ctx.save();
    ctx.translate(28, chart.y + chart.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = t.axisLabelInk;
    ctx.textAlign = "center";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillText(pricing.metricAxisLabel(state.metric), 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function drawLines(layout, scales, drawnPoints, now) {
  const alphaProgress = state.reducedMotion
    ? 1
    : Math.min(1, Math.max(0, (now - state.animationStart) / 900));
  const seriesEntries = getVisibleSeriesEntries();
  const startX = scales.x(state.startDateValue);
  const endX = scales.x(state.endDateValue);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.rect(layout.chart.x - 5, layout.chart.y - 5, layout.chart.w + 10, layout.chart.h + 10);
  ctx.clip();

  for (const [seriesId, points] of seriesEntries) {
    const series = state.data.series.get(seriesId);
    const seriesColor = getSeriesColor(series);
    const timelinePoints = pricing.getTimelineSeriesPoints(points, scales.dateMin, scales.dateMax);
    const visiblePathPoints = pricing.getExtendedSeriesPoints(timelinePoints, scales.dateMax);
    const path = visiblePathPoints.map((point) => ({
      point,
      x: scales.x(point.dateValue),
      y: scales.y(metricValue(point))
    }));

    const t = T();
    const [er, eg, eb] = t.extendedSeriesPath;
    drawSeriesPath(path, series.dash, `rgba(${er}, ${eg}, ${eb}, ${0.24 * alphaProgress})`, layout.compact ? 1.7 : 2.1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(startX, layout.chart.y - 4, Math.max(0, endX - startX) + 4, layout.chart.h + 8);
    ctx.clip();
    drawSeriesPath(path, series.dash, withAlpha(seriesColor, 0.86 * alphaProgress), layout.compact ? 2 : 2.6);
    ctx.restore();

    for (const item of path.filter((item) => !item.point.extended && !item.point.boundary && item.x >= layout.chart.x - 1 && item.x <= layout.chart.x + layout.chart.w + 1)) {
      drawnPoints.push({ ...item, series });
      const inRange = item.x >= startX - 0.5 && item.x <= endX + 0.5;
      const color = inRange ? seriesColor : t.extendedSeries;
      drawPointRing(item.x, item.y, layout.compact ? 3.4 : 4.2, color);
    }
  }

  ctx.restore();
}

function drawSeriesPath(path, dash, color, width) {
  ctx.beginPath();
  path.forEach((item, index) => {
    if (index === 0) ctx.moveTo(item.x, item.y);
    else ctx.lineTo(item.x, item.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPointRing(x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = T().ringRim;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2.1;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawSeriesLabels(layout, scales) {
  if (layout.compact) return;

  const labels = getVisibleSeriesEntries().map(([seriesId, points]) => {
    const series = state.data.series.get(seriesId);
    const last = points[points.length - 1];
    return {
      series,
      x: scales.x(scales.dateMax),
      y: scales.y(metricValue(last)),
      value: metricValue(last)
    };
  }).sort((a, b) => a.y - b.y);

  let previousY = -Infinity;
  for (const label of labels) {
    label.y = Math.max(label.y, previousY + 18);
    previousY = label.y;
  }

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = "12px Inter, system-ui, sans-serif";
  for (const label of labels) {
    const textX = Math.min(layout.width - 166, label.x + 18);
    const sourceY = scales.y(label.value);
    const seriesColor = getSeriesColor(label.series);

    ctx.strokeStyle = withAlpha(seriesColor, 0.42);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(label.x, sourceY);
    ctx.lineTo(textX - 7, label.y);
    ctx.stroke();

    ctx.fillStyle = T().seriesLabelInk;
    ctx.fillText(label.series.name, textX, label.y);
  }
  ctx.restore();
}

function drawComparisonCursors(layout, scales) {
  const { chart, compact } = layout;
  const startX = scales.x(state.startDateValue);
  const endX = scales.x(state.endDateValue);
  const stats = getComparisonStats();
  const color = stats.verdictColor;
  const midX = (startX + endX) / 2;

  ctx.save();
  drawComparisonCursorLine(layout, startX);
  drawComparisonCursorLine(layout, endX);
  drawComparisonHandle(layout, startX);
  drawComparisonHandle(layout, endX);

  if (state.bubbleMinimized) {
    drawMinimizedBubble(layout, stats, color, midX);
  } else {
    drawFullBubble(layout, stats, color, midX);
  }
  ctx.restore();
}

function drawFullBubble(layout, stats, color, midX) {
  const { chart, compact } = layout;
  const bubbleW = compact ? Math.min(layout.width - 40, 300) : 412;
  const sentenceFont = `${compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  const sentencePad = compact ? 22 : 28;
  const sentenceLines = wrapCanvasText(stats.sentence, bubbleW - sentencePad * 2, sentenceFont, 3);
  const sentenceLineH = compact ? 15 : 16;
  const pillH = compact ? 22 : 24;
  const headerInset = compact ? 18 : 20;
  const tableYInset = headerInset + pillH + 10 + sentenceLines.length * sentenceLineH + 18;
  const tableRowH = compact ? 18 : 20;
  const bubbleH = tableYInset + tableRowH * (stats.groups.length + 1) + 18;
  const bubbleEdgePad = compact ? 20 : 14;
  const bubbleX = clamp(midX - bubbleW / 2, bubbleEdgePad, layout.width - bubbleW - bubbleEdgePad);
  const bubbleY = chart.y + 12;
  const bubbleAnchorX = clamp(midX, bubbleX + 20, bubbleX + bubbleW - 20);

  ctx.strokeStyle = T().bubbleConnector;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bubbleAnchorX, bubbleY);
  ctx.lineTo(midX, chart.y);
  ctx.stroke();

  shadowedPanel(bubbleX, bubbleY, bubbleW, bubbleH, 16);
  drawComparisonNarrative(bubbleX, bubbleY + headerInset, bubbleW, stats, compact, color, sentenceLines);
  drawComparisonTable(bubbleX, bubbleY + tableYInset, bubbleW, stats, compact);
  drawBubbleMinimizeButton(bubbleX + bubbleW - 16, bubbleY + 13);

  state.bubblePanel = { x: bubbleX, y: bubbleY, w: bubbleW, h: bubbleH };
}

function drawMinimizedBubble(layout, stats, color, midX) {
  const { chart, compact } = layout;
  const t = T();
  const fontSize = compact ? 11.5 : 12.5;
  const pillH = compact ? 28 : 32;
  const pillPad = compact ? 22 : 24;
  const verdictPillH = compact ? 20 : 22;
  const verdictW = measureVerdictPillWidth(stats.pillText, fontSize, stats.verdict === "flat", pillPad);
  const chevW = 18;
  const pillW = verdictW + chevW + 14;
  const pillX = clamp(midX - pillW / 2, 16, layout.width - pillW - 16);
  const pillY = chart.y + 12;
  const hovered = isPointerInRect(pillX, pillY, pillW, pillH);
  const alpha = hovered ? 1 : 0.28;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = t.panelShadow;
  ctx.shadowBlur = hovered ? 22 : 12;
  ctx.shadowOffsetY = hovered ? 6 : 3;
  roundedRect(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = t.panel;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  roundedRect(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.strokeStyle = t.panelBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  drawVerdictPill(
    pillX + 7,
    pillY + (pillH - verdictPillH) / 2,
    verdictW,
    verdictPillH,
    stats.pillText,
    color,
    stats.verdict === "flat" ? "#422006" : "#ffffff",
    fontSize
  );
  drawChevron(pillX + verdictW + 18, pillY + pillH / 2, false, t.bodyInkSoft);
  ctx.restore();

  state.bubblePanel = { x: pillX, y: pillY, w: pillW, h: pillH };
  state.bubbleMinimizeButton = null;
}

function drawBubbleMinimizeButton(rightX, cy) {
  const label = "minimize";
  const labelFont = "500 9.5px Inter, system-ui, sans-serif";
  const iconW = 9;
  const gap = 5;
  const t = T();

  ctx.save();
  ctx.font = labelFont;
  const labelW = ctx.measureText(label).width;
  ctx.restore();

  const contentW = labelW + gap + iconW;
  const startX = rightX - contentW;
  const hitPadX = 6;
  const hitPadY = 8;
  const hovered = isPointerInRect(startX - hitPadX, cy - hitPadY, contentW + hitPadX * 2, hitPadY * 2);
  const tint = hovered ? t.minimizeInkActive : t.minimizeInk;

  ctx.save();
  ctx.font = labelFont;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = tint;
  ctx.fillText(label, startX - 2, cy - 0.5);

  ctx.strokeStyle = tint;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  const iconStart = startX + labelW + gap;
  ctx.beginPath();
  ctx.moveTo(iconStart, cy);
  ctx.lineTo(iconStart + iconW, cy);
  ctx.stroke();
  ctx.restore();

  state.bubbleMinimizeButton = {
    x: startX - hitPadX,
    y: cy - hitPadY,
    w: contentW + hitPadX * 2,
    h: hitPadY * 2
  };
}

function isPointerInRect(x, y, w, h) {
  return state.pointer.x >= x && state.pointer.x <= x + w && state.pointer.y >= y && state.pointer.y <= y + h;
}

function drawComparisonCursorLine(layout, x) {
  const { chart } = layout;
  ctx.strokeStyle = T().cursorLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(x, chart.y);
  ctx.lineTo(x, chart.y + chart.h);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawComparisonHandle(layout, x) {
  const { chart, compact } = layout;
  const t = T();
  const handleY = chart.y + chart.h / 2;
  const handleW = compact ? 20 : 18;
  const handleH = compact ? 56 : 52;

  ctx.save();
  ctx.shadowColor = t.handleShadow;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  roundedRect(x - handleW / 2, handleY - handleH / 2, handleW, handleH, handleW / 2);
  ctx.fillStyle = t.handleFill;
  ctx.fill();
  ctx.restore();

  roundedRect(x - handleW / 2, handleY - handleH / 2, handleW, handleH, handleW / 2);
  ctx.strokeStyle = t.handleBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = t.handleGrip;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  for (const offset of [-2.5, 2.5]) {
    ctx.beginPath();
    ctx.moveTo(x + offset, handleY - 9);
    ctx.lineTo(x + offset, handleY + 9);
    ctx.stroke();
  }
}

function drawComparisonNarrative(x, y, w, stats, compact, color, sentenceLines) {
  const fontSize = compact ? 11.5 : 12.5;
  const pillH = compact ? 22 : 24;
  const pillPad = compact ? 22 : 24;
  const lineH = compact ? 15 : 16;
  const pillW = measureVerdictPillWidth(stats.pillText, fontSize, stats.verdict === "flat", pillPad);
  const pillTextColor = stats.verdict === "flat" ? "#422006" : "#ffffff";

  ctx.save();
  ctx.textBaseline = "middle";
  drawVerdictPill(x + (w - pillW) / 2, y, pillW, pillH, stats.pillText, color, pillTextColor, fontSize);

  ctx.fillStyle = T().bodyInkSoft;
  ctx.textAlign = "center";
  ctx.font = `${compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  sentenceLines.forEach((line, index) => {
    ctx.fillText(line, x + w / 2, y + pillH + 10 + index * lineH);
  });
  ctx.restore();
}

function drawVerdictPill(x, y, w, h, text, fill, textColor, fontSize) {
  roundedRect(x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
}

function measureVerdictPillWidth(text, fontSize, wide, pad) {
  ctx.save();
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  const width = Math.max(wide ? 96 : 48, ctx.measureText(text).width + pad);
  ctx.restore();
  return width;
}

function wrapCanvasText(text, maxWidth, font, maxLines) {
  ctx.save();
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }

  const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const remaining = words.slice(usedWords).join(" ");
  if (lines.length === maxLines - 1 && remaining) {
    line = remaining;
    while (ctx.measureText(`${line}...`).width > maxWidth && line.includes(" ")) {
      line = line.slice(0, line.lastIndexOf(" "));
    }
    lines.push(`${line}...`);
  } else if (line) {
    lines.push(line);
  }

  ctx.restore();
  return lines;
}

function drawComparisonTable(x, y, w, stats, compact) {
  const labelX = x + (compact ? 20 : 22);
  const afterX = x + w - (compact ? 20 : 22);
  const beforeX = afterX - (compact ? 70 : 80);
  const rowH = compact ? 18 : 20;
  const t = T();
  const upClr = state.theme === "dark" ? "#fca5a5" : "#b91c1c";
  const downClr = state.theme === "dark" ? "#4ade80" : "#15803d";

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = `600 ${compact ? 9 : 10}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = t.bodyInkSofter;
  ctx.textAlign = "right";
  ctx.fillText("BEFORE", beforeX, y);
  ctx.fillText("AFTER", afterX, y);

  ctx.strokeStyle = t.hoverRowDivider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + (compact ? 18 : 20), y + rowH / 2 + 1);
  ctx.lineTo(x + w - (compact ? 18 : 20), y + rowH / 2 + 1);
  ctx.stroke();

  stats.groups.forEach((group, index) => {
    const rowY = y + rowH * (index + 1) + 2;
    ctx.font = `600 ${compact ? 10.5 : 11.5}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = t.hoverValueInk;
    ctx.textAlign = "left";
    ctx.fillText(group.label, labelX, rowY);

    ctx.font = `${compact ? 10.5 : 11.5}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = t.bodyInkSoft;
    ctx.fillText(formatCompactMoney(group.startAverage), beforeX, rowY);

    ctx.font = `600 ${compact ? 10.5 : 11.5}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = group.changePercent < -0.5
      ? downClr
      : group.changePercent > 0.5
        ? upClr
        : t.bodyInkSoft;
    ctx.fillText(formatCompactMoney(group.endAverage), afterX, rowY);
  });

  ctx.restore();
}

function drawLabToggles(x, y, compact) {
  const labs = Array.from(state.data.labs.values());
  const logoSize = compact ? 18 : 22;
  const checkSize = compact ? 16 : 17;
  const gap = compact ? 14 : 16;

  ctx.font = `500 ${compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  labs.forEach((lab) => {
    const itemW = measureLabToggleWidth(lab, compact);
    const enabled = isLabEnabled(lab.id);
    const alpha = enabled ? 1 : 0.34;
    const checkX = x;
    const logoX = x + checkSize + (compact ? 8 : 10);
    const labColor = getLabColor(lab);
    const color = enabled ? labColor : "#9ca3af";

    drawCheckToggle(checkX, y - checkSize / 2, checkSize, enabled, labColor);
    ctx.globalAlpha = alpha;
    drawTintedImage(lab.logo, logoX, y - logoSize / 2, logoSize, logoSize, color);
    ctx.globalAlpha = 1;

    const labelX = logoX + logoSize + 8;
    state.labToggles.push({
      labId: lab.id,
      x: checkX - 6,
      y: y - 18,
      w: itemW + 12,
      h: 36
    });

    ctx.fillStyle = enabled ? T().checkOnInk : T().checkOffInk;
    ctx.fillText(lab.name, labelX, y);
    x += itemW + gap;
  });
}

function measureLabTogglesWidth(compact) {
  const gap = compact ? 14 : 16;
  const labs = Array.from(state.data.labs.values());
  ctx.save();
  ctx.font = `500 ${compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  const width = labs.reduce((sum, lab) => sum + measureLabToggleWidth(lab, compact), 0) + gap * (labs.length - 1);
  ctx.restore();
  return width;
}

function measureLabToggleWidth(lab, compact) {
  const logoSize = compact ? 18 : 22;
  const checkSize = compact ? 16 : 17;
  return checkSize + (compact ? 8 : 10) + logoSize + 8 + ctx.measureText(lab.name).width + 6;
}

function drawCohortToggles(x, y, compact) {
  const checkSize = compact ? 15 : 16;
  const gap = compact ? 14 : 16;

  ctx.font = `500 ${compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  cohortOptions.forEach((cohort) => {
    const itemX = x;
    const itemW = measureCohortToggleWidth(cohort, compact);
    const enabled = isCohortEnabled(cohort.id);
    drawCheckToggle(itemX, y - checkSize / 2, checkSize, enabled, getCohortColor(cohort));
    ctx.fillStyle = enabled ? T().cohortOnInk : T().checkOffInk;
    ctx.fillText(cohort.label, itemX + checkSize + 8, y);
    state.cohortToggles.push({
      cohortId: cohort.id,
      x: itemX - 6,
      y: y - 18,
      w: itemW + 12,
      h: 36
    });
    x += itemW + gap;
  });
}

function measureCohortTogglesWidth(compact) {
  const gap = compact ? 14 : 16;
  ctx.save();
  ctx.font = `500 ${compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  const width = cohortOptions.reduce((sum, cohort) => sum + measureCohortToggleWidth(cohort, compact), 0) + gap * (cohortOptions.length - 1);
  ctx.restore();
  return width;
}

function measureCohortToggleWidth(cohort, compact) {
  const checkSize = compact ? 15 : 16;
  return checkSize + 8 + ctx.measureText(cohort.label).width + 6;
}

function drawCheckToggle(x, y, size, enabled, color) {
  const t = T();
  ctx.save();
  roundedRect(x, y, size, size, 5);
  ctx.fillStyle = enabled ? color : t.checkBg;
  ctx.fill();
  ctx.strokeStyle = enabled ? withAlpha(color, 0.92) : t.checkBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  if (enabled) {
    ctx.strokeStyle = getCheckMarkColor(color);
    ctx.lineWidth = Math.max(1.8, size * 0.14);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.28, y + size * 0.53);
    ctx.lineTo(x + size * 0.43, y + size * 0.68);
    ctx.lineTo(x + size * 0.74, y + size * 0.34);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFootnotes(layout) {
  const { compact, chart } = layout;
  if (compact) return;

  ctx.save();
  ctx.fillStyle = T().bodyInkSofter;
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const text = pricing.isIntelligenceMetric(state.metric)
    ? "Hover for AA score + raw prices. Intelligence sources live in data/model-intelligence.json; see data/sources.md for mapping notes."
    : "Hover points for input + output. Standard text API rates; see data/sources.md for caveats.";
  ctx.fillText(text, layout.width - 34, chart.y + chart.h + 44);
  ctx.restore();
}

function drawHover(layout, drawnPoints) {
  if (state.pointer.x < 0 || state.pointer.y < 0) return;
  if (state.draggingCursor || getComparisonCursorAt(state.pointer)) return;

  let nearest = null;
  let nearestDistance = Infinity;
  for (const item of drawnPoints) {
    const distance = Math.hypot(item.x - state.pointer.x, item.y - state.pointer.y);
    if (distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }

  if (!nearest || nearestDistance > 42) return;
  state.hover = nearest;

  const tHov = T();
  const seriesColor = getSeriesColor(nearest.series);
  ctx.save();
  ctx.strokeStyle = tHov.hoverLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nearest.x, layout.chart.y);
  ctx.lineTo(nearest.x, layout.chart.y + layout.chart.h);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(nearest.x, nearest.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(seriesColor, 0.12);
  ctx.fill();
  ctx.strokeStyle = seriesColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  const point = nearest.point;
  const rows = getHoverRows(point);
  const compact = layout.compact;
  const padX = compact ? 16 : 18;
  const padY = compact ? 14 : 16;
  const headerH = compact ? 46 : 50;
  const tableRowH = compact ? 24 : 27;
  const noteFont = `${compact ? 10.5 : 11}px Inter, system-ui, sans-serif`;
  const titleFont = `600 ${compact ? 13 : 14}px Inter, system-ui, sans-serif`;
  const metaFont = `${compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  const labelFont = `600 ${compact ? 10.5 : 11}px Inter, system-ui, sans-serif`;
  const valueFont = `600 ${compact ? 11 : 12}px Inter, system-ui, sans-serif`;

  ctx.save();
  ctx.font = titleFont;
  const titleWidth = ctx.measureText(point.model).width;
  ctx.font = metaFont;
  const metaWidth = ctx.measureText(`${point.labInfo.name} - ${formatDate(point.date)}`).width;
  ctx.font = labelFont;
  const labelWidth = rows.reduce((max, row) => Math.max(max, ctx.measureText(row.label).width), 0);
  ctx.font = valueFont;
  const valueWidth = rows.reduce((max, row) => Math.max(max, ctx.measureText(row.value).width), 0);
  ctx.restore();

  const contentWidth = Math.max(titleWidth + 46, metaWidth + 46, labelWidth + valueWidth + (compact ? 26 : 30));
  const boxW = clamp(contentWidth + padX * 2, compact ? 214 : 246, compact ? Math.min(layout.width - 24, 286) : 344);
  const innerW = boxW - padX * 2;
  const noteBlocks = [point.note, pricing.isIntelligenceMetric(state.metric) ? point.intelligenceInfo?.note : null].filter(Boolean);
  const noteLines = getHoverNoteLines(noteBlocks, innerW, noteFont, compact ? 4 : 5);
  const tableH = rows.length * tableRowH;
  const notesH = noteLines.length ? 14 + noteLines.length * (compact ? 13 : 14) : 0;
  const boxH = padY * 2 + headerH + 12 + tableH + notesH;
  const { x: boxX, y: boxY } = placeHoverBox(layout, nearest.x, nearest.y, boxW, boxH);
  const tableX = boxX + padX;
  const tableY = boxY + padY + headerH;
  const tableW = innerW;
  const labelX = tableX + 12;
  const valueX = tableX + tableW - 12;

  shadowedPanel(boxX, boxY, boxW, boxH, 14);
  drawTintedImage(point.labInfo.logo, boxX + padX, boxY + padY + 2, 22, 22, getLabColor(point.labInfo));

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = tHov.hoverValueInk;
  ctx.font = titleFont;
  ctx.fillText(point.model, boxX + padX + 32, boxY + padY);
  ctx.fillStyle = tHov.hoverMetaInk;
  ctx.font = metaFont;
  ctx.fillText(`${point.labInfo.name} - ${formatDate(point.date)}`, boxX + padX + 32, boxY + padY + 18);

  roundedRect(tableX, tableY, tableW, tableH, 11);
  ctx.fillStyle = tHov.hoverTableBg;
  ctx.fill();
  ctx.strokeStyle = tHov.hoverTableBorder;
  ctx.stroke();

  ctx.textBaseline = "middle";
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowY = tableY + index * tableRowH;
    const centerY = rowY + tableRowH / 2;

    if (row.active) {
      roundedRect(tableX + 1, rowY + 1, tableW - 2, tableRowH - 2, 10);
      ctx.fillStyle = withAlpha(seriesColor, 0.1);
      ctx.fill();
    }

    if (index > 0) {
      ctx.strokeStyle = tHov.hoverRowDivider;
      ctx.beginPath();
      ctx.moveTo(tableX + 12, rowY);
      ctx.lineTo(tableX + tableW - 12, rowY);
      ctx.stroke();
    }

    ctx.textAlign = "left";
    ctx.fillStyle = tHov.hoverLabelInk;
    ctx.font = labelFont;
    ctx.fillText(row.label, labelX, centerY + 0.5);

    ctx.textAlign = "right";
    ctx.fillStyle = row.active ? seriesColor : tHov.hoverValueInk;
    ctx.font = valueFont;
    ctx.fillText(row.value, valueX, centerY + 0.5);
  }

  if (noteLines.length) {
    let textY = tableY + tableH + 12;
    ctx.strokeStyle = tHov.hoverTableBorder;
    ctx.beginPath();
    ctx.moveTo(boxX + padX, textY - 6);
    ctx.lineTo(boxX + boxW - padX, textY - 6);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = tHov.hoverNoteInk;
    ctx.font = noteFont;
    for (const line of noteLines) {
      ctx.fillText(line, boxX + padX, textY);
      textY += compact ? 13 : 14;
    }
  }

  ctx.restore();
}

function getHoverRows(point) {
  if (pricing.isIntelligenceMetric(state.metric)) {
    return [
      { label: "AA score", value: String(point.intelligenceScore), active: false },
      { label: "Price / IQ", value: money.format(metricValue(point)), active: true },
      { label: "Combined / 1M", value: money.format(point.combinedUsdPer1M), active: false },
      { label: "Input / 1M", value: money.format(point.inputUsdPer1M), active: false },
      { label: "Output / 1M", value: money.format(point.outputUsdPer1M), active: false }
    ];
  }

  return [
    { label: "Input / 1M", value: money.format(point.inputUsdPer1M), active: state.metric === "inputUsdPer1M" },
    { label: "Output / 1M", value: money.format(point.outputUsdPer1M), active: state.metric === "outputUsdPer1M" },
    { label: "Blended / 1M", value: money.format(point.blendedUsdPer1M), active: state.metric === "blendedUsdPer1M" }
  ];
}

function getHoverNoteLines(blocks, maxWidth, font, maxLines) {
  const lines = [];
  for (const block of blocks) {
    const remaining = maxLines - lines.length;
    if (remaining <= 0) break;
    lines.push(...wrapCanvasText(block, maxWidth, font, remaining));
  }
  return lines;
}

function placeHoverBox(layout, anchorX, anchorY, boxW, boxH) {
  const candidates = [anchorX + 18, anchorX - boxW - 18];
  const minY = 12;
  const maxY = Math.max(minY, layout.height - boxH - 12);

  for (const preferredX of candidates) {
    const x = clamp(preferredX, 12, layout.width - boxW - 12);
    let y = clamp(anchorY - boxH / 2, minY, maxY);
    y = avoidUiOverlap(x, y, boxW, boxH, layout, minY, maxY);
    if (!intersectsUiChrome(x, y, boxW, boxH)) return { x, y };
  }

  return {
    x: clamp(anchorX + 18, 12, layout.width - boxW - 12),
    y: avoidUiOverlap(
      clamp(anchorX + 18, 12, layout.width - boxW - 12),
      clamp(anchorY - boxH / 2, minY, maxY),
      boxW,
      boxH,
      layout,
      minY,
      maxY
    )
  };
}

function avoidUiOverlap(x, y, w, h, layout, minY, maxY) {
  const overlaps = getUiAvoidRects().filter((item) => rectsIntersect({ x, y, w, h }, item));
  if (!overlaps.length) return y;
  const below = Math.max(...overlaps.map((item) => item.y + item.h + 12));
  if (below <= maxY) return below;
  const above = Math.min(...overlaps.map((item) => item.y - h - 12));
  return clamp(above, minY, maxY);
}

function intersectsUiChrome(x, y, w, h) {
  return getUiAvoidRects().some((item) => rectsIntersect({ x, y, w, h }, item));
}

function getUiAvoidRects() {
  return [
    ...state.controls,
    ...state.timelineZoomControls,
    ...state.labToggles,
    ...state.cohortToggles,
    state.shareButton,
    state.filterButton,
    state.filterPanel,
    state.themeButton,
    state.bubbleMinimized ? null : state.bubblePanel
  ].filter(Boolean);
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateComparisonDateFromX(cursor, x) {
  if (!state.data) return;

  const layout = getLayout(state.width, state.height);
  const scales = getScales(layout);
  const t = clamp((x - layout.chart.x) / layout.chart.w, 0, 1);
  const nextValue = scales.dateMin + t * (scales.dateMax - scales.dateMin);
  const minGap = (scales.dateMax - scales.dateMin) * 0.025;

  if (cursor === "start") {
    state.startDateValue = Math.min(nextValue, state.endDateValue - minGap);
  } else {
    state.endDateValue = Math.max(nextValue, state.startDateValue + minGap);
  }

  clampCompareDateToVisibleRange();
}

function getPointerCursor(pointer) {
  if (state.draggingCursor || getComparisonCursorAt(pointer)) return "ew-resize";
  if (
    getLabToggleAt(pointer.x, pointer.y) ||
    getCohortToggleAt(pointer.x, pointer.y) ||
    getShareButtonAt(pointer.x, pointer.y) ||
    getFilterButtonAt(pointer.x, pointer.y) ||
    getThemeButtonAt(pointer.x, pointer.y) ||
    getControlAt(pointer.x, pointer.y) ||
    getTimelineZoomControlAt(pointer.x, pointer.y) ||
    getBubbleMinimizeAt(pointer.x, pointer.y) ||
    (state.bubbleMinimized && getBubblePanelAt(pointer.x, pointer.y))
  ) {
    return "pointer";
  }
  return "crosshair";
}

function getControlAt(x, y) {
  return state.controls.find(
    (item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
  );
}

function getTimelineZoomControlAt(x, y) {
  if (state.filterPanelOpen && getFilterPanelAt(x, y)) return null;
  return state.timelineZoomControls.find(
    (item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
  );
}

function setTimelineZoom(id) {
  if (id === state.timelineZoom) return;
  const previousStart = state.startDateValue;
  const previousEnd = state.endDateValue;
  state.timelineZoom = id;
  const extent = getVisibleDateExtent();
  const overlaps = previousEnd >= extent.min && previousStart <= extent.max;

  if (overlaps) {
    clampCompareDateToVisibleRange();
  } else {
    state.startDateValue = pricing.snapToUtcDay(extent.min + (extent.max - extent.min) * 0.5);
    state.endDateValue = extent.max;
  }

  state.hover = null;
  updateUrlFromState();
  draw();
}

function getLabToggleAt(x, y) {
  return state.labToggles.find(
    (item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
  );
}

function getCohortToggleAt(x, y) {
  return state.cohortToggles.find(
    (item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
  );
}

function getShareButtonAt(x, y) {
  const item = state.shareButton;
  if (!item) return null;
  return x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h ? item : null;
}

function getFilterButtonAt(x, y) {
  const item = state.filterButton;
  if (!item) return null;
  return x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h ? item : null;
}

function getFilterPanelAt(x, y) {
  const item = state.filterPanel;
  if (!item) return null;
  return x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h ? item : null;
}

function getBubblePanelAt(x, y) {
  const item = state.bubblePanel;
  if (!item) return null;
  return x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h ? item : null;
}

function getBubbleMinimizeAt(x, y) {
  const item = state.bubbleMinimizeButton;
  if (!item) return null;
  return x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h ? item : null;
}

function toggleLab(labId) {
  if (!state.enabledLabs.has(labId)) {
    state.enabledLabs.add(labId);
  } else if (state.enabledLabs.size > 1) {
    state.enabledLabs.delete(labId);
  }

  clampCompareDateToVisibleRange();
  state.hover = null;
}

function toggleCohort(cohortId) {
  if (!state.enabledCohorts.has(cohortId)) {
    state.enabledCohorts.add(cohortId);
  } else if (state.enabledCohorts.size > 1) {
    state.enabledCohorts.delete(cohortId);
  }

  clampCompareDateToVisibleRange();
  state.hover = null;
}

function clampCompareDateToVisibleRange() {
  const next = pricing.clampDateRange(state.data, getViewState(), state.startDateValue, state.endDateValue);
  state.startDateValue = next.startDateValue;
  state.endDateValue = next.endDateValue;
}

function getComparisonCursorAt(pointer) {
  if (!state.data || state.startDateValue == null || state.endDateValue == null) return null;

  const layout = getLayout(state.width, state.height);
  const scales = getScales(layout);
  const chart = layout.chart;
  const handleY = chart.y + chart.h / 2;
  const cursors = [
    { id: "start", x: scales.x(state.startDateValue) },
    { id: "end", x: scales.x(state.endDateValue) }
  ].sort((a, b) => Math.abs(pointer.x - a.x) - Math.abs(pointer.x - b.x));

  for (const cursor of cursors) {
    const nearLine = Math.abs(pointer.x - cursor.x) <= (layout.compact ? 20 : 14) && pointer.y >= chart.y - 76 && pointer.y <= chart.y + chart.h + 10;
    const nearHandle = Math.abs(pointer.x - cursor.x) <= (layout.compact ? 34 : 22) && Math.abs(pointer.y - handleY) <= (layout.compact ? 46 : 34);
    if (nearLine || nearHandle) return cursor.id;
  }

  return null;
}

function getComparisonStats() {
  return pricing.getComparisonStats(state.data, getViewState());
}

function getVisibleComparisonGroups(groups) {
  return cohortOptions
    .filter((cohort) => isCohortEnabled(cohort.id))
    .map((cohort) => summarizeComparisonGroup(groups[cohort.id]));
}

function getSeriesCohort(seriesId) {
  return pricing.getSeriesCohort(state.data, seriesId);
}

function summarizeComparisonGroup(group) {
  if (!group.rows.length) return emptyComparisonGroup(group.label);

  const startAverage = group.rows.reduce((sum, row) => sum + row.start, 0) / group.rows.length;
  const endAverage = group.rows.reduce((sum, row) => sum + row.end, 0) / group.rows.length;
  return {
    label: group.label,
    startAverage,
    endAverage,
    changePercent: ((endAverage - startAverage) / startAverage) * 100
  };
}

function getRangeSentence({ startDateText, endDateText, percent, flat, usesLatestEnd, subject }) {
  const direction = percent < 0 ? "down" : "up";
  const amount = formatPercent(Math.abs(percent));

  if (flat) {
    return usesLatestEnd
      ? `${subject} haven't really gotten any cheaper since ${startDateText}.`
      : `${subject} didn't really get any cheaper between ${startDateText} and ${endDateText}.`;
  }

  if (usesLatestEnd) {
    const movement = percent < 0 ? "have gotten cheaper" : "have gotten more expensive";
    return `${subject} ${movement} since ${startDateText}, ${direction} roughly ${amount}.`;
  }

  const movement = percent < 0 ? "got cheaper" : "got more expensive";
  return `${subject} ${movement} between ${startDateText} and ${endDateText}, ${direction} roughly ${amount}.`;
}

function getEnabledTokenSubject() {
  const enabled = Array.from(state.data.labs.values()).filter((lab) => isLabEnabled(lab.id));
  const cohort = getEnabledCohortSubject();
  if (enabled.length === 1) {
    return { text: `${providerPossessive(enabled[0].name)} ${cohort}`, plural: true };
  }
  if (enabled.length === 2) {
    return {
      text: `${providerPossessive(enabled[0].name)} and ${providerPossessive(enabled[1].name)} ${cohort}`,
      plural: true
    };
  }
  return { text: capitalize(cohort), plural: true };
}

function providerPossessive(name) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function getEnabledCohortSubject() {
  const enabled = cohortOptions.filter((cohort) => isCohortEnabled(cohort.id));
  if (enabled.length === cohortOptions.length) return "tokens";
  if (enabled.length === 1) return `${enabled[0].label.toLowerCase()} tokens`;
  if (enabled.length === 2) {
    return `${enabled[0].label.toLowerCase()} and ${enabled[1].label.toLowerCase()} tokens`;
  }
  return "tokens";
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function emptyComparisonGroup(label) {
  return {
    label,
    startAverage: null,
    endAverage: null,
    changePercent: 0
  };
}

function getLatestAtOrBefore(points, dateValue) {
  let latest = null;
  for (const point of points) {
    if (point.dateValue <= dateValue) latest = point;
    else break;
  }
  return latest;
}

function drawError(error) {
  const t = T();
  ctx.save();
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = t.bg1;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.fillStyle = state.theme === "dark" ? "#fca5a5" : "#991b1b";
  ctx.font = "16px Inter, system-ui, sans-serif";
  ctx.fillText(error.message || "Unable to load chart.", 24, 32);
  ctx.restore();
}

function metricValue(point) {
  return pricing.metricValue(point, state.metric);
}

function metricLabel(metric) {
  return pricing.metricLabel(metric);
}

function formatAxisMoney(value) {
  return pricing.formatCompactMoney(value);
}

function formatDate(date) {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

function formatLongDate(dateValue) {
  return pricing.formatLongDate(dateValue);
}

function ordinalSuffix(day) {
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

function formatPercent(value) {
  return pricing.formatPercent(value);
}

function formatCompactMoney(value) {
  return pricing.formatCompactMoney(value);
}

function roundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function shadowedPanel(x, y, w, h, r) {
  const t = T();
  ctx.save();
  ctx.shadowColor = t.panelShadow;
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 6;
  roundedRect(x, y, w, h, r);
  ctx.fillStyle = t.panel;
  ctx.fill();
  ctx.restore();
  roundedRect(x, y, w, h, r);
  ctx.strokeStyle = t.panelBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTintedImage(src, x, y, w, h, color) {
  const image = state.images.get(src);
  if (!image) return;

  const offscreen = document.createElement("canvas");
  offscreen.width = Math.max(1, Math.round(w * state.dpr));
  offscreen.height = Math.max(1, Math.round(h * state.dpr));
  const offCtx = offscreen.getContext("2d");
  offCtx.scale(state.dpr, state.dpr);
  offCtx.drawImage(image, 0, 0, w, h);
  offCtx.globalCompositeOperation = "source-in";
  offCtx.fillStyle = color;
  offCtx.fillRect(0, 0, w, h);
  ctx.drawImage(offscreen, x, y, w, h);
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function withAlpha(hex, alpha) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getCheckMarkColor(hex) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#0b1220" : "#ffffff";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function bindEarlyAccessForm() {
  const bar = document.getElementById("sa-bar");
  const form = document.getElementById("sa-bar-form");
  if (!form || !bar) return;
  const submit = document.getElementById("sa-bar-submit");
  const label = submit?.querySelector(".sa-bar-submit-label");
  const arrow = submit?.querySelector(".sa-bar-arrow");
  const spinner = submit?.querySelector(".sa-bar-spinner");
  const status = document.getElementById("sa-bar-status");
  const nameInput = document.getElementById("sa-bar-name");
  const emailInput = document.getElementById("sa-bar-email");

  function setStatus(text, tone = "") {
    if (!status) return;
    status.textContent = text;
    if (tone) status.setAttribute("data-tone", tone);
    else status.removeAttribute("data-tone");
  }

  function setBusy(busy) {
    if (!submit) return;
    submit.disabled = busy;
    if (label) label.style.display = busy ? "none" : "";
    if (arrow) arrow.style.display = busy ? "none" : "";
    if (spinner) spinner.style.display = busy ? "" : "none";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = (nameInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    if (!name || !email) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not submit");
      }
      bar.classList.add("sa-bar--success");
      setStatus("You're on the list — we'll be in touch.", "ok");
    } catch (error) {
      setStatus(error.message || "Something went wrong.", "err");
      setBusy(false);
    }
  });
}
