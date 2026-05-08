const canvas = document.getElementById("price-canvas");
const ctx = canvas.getContext("2d");

const state = {
  data: null,
  dpr: 1,
  width: 0,
  height: 0,
  metric: "outputUsdPer1M",
  hover: null,
  pointer: { x: -1, y: -1 },
  controls: [],
  labToggles: [],
  cohortToggles: [],
  filterButton: null,
  filterPanel: null,
  enabledLabs: new Set(),
  enabledCohorts: new Set(),
  images: new Map(),
  startDateValue: null,
  endDateValue: null,
  draggingCursor: null,
  filterPanelOpen: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  animationStart: performance.now()
};

const metricOptions = [
  { id: "outputUsdPer1M", label: "Output" },
  { id: "inputUsdPer1M", label: "Input" },
  { id: "blendedUsdPer1M", label: "Blended" }
];

const cohortOptions = [
  { id: "frontier", label: "Frontier", color: "#111827" },
  { id: "mini", label: "Small", color: "#64748b" },
  { id: "nano", label: "Tiny", color: "#8ab4f8" }
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4
});

Promise.all([
  fetch("data/model-prices.json").then((response) => {
    if (!response.ok) throw new Error(`Could not load data: ${response.status}`);
    return response.json();
  })
]).then(([data]) => {
  state.data = normalizeData(data);
  initializeEnabledLabs();
  initializeEnabledCohorts();
  initializeCompareDate();
  loadImages(state.data).then(() => {
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    requestAnimationFrame(draw);
  });
}).catch((error) => {
  resize();
  drawError(error);
});

function normalizeData(data) {
  const labs = new Map(data.labs.map((lab) => [lab.id, lab]));
  const series = new Map(data.series.map((item) => [item.id, item]));
  const points = data.points
    .map((point) => ({
      ...point,
      dateValue: new Date(`${point.date}T00:00:00Z`).getTime(),
      blendedUsdPer1M: (point.inputUsdPer1M + point.outputUsdPer1M) / 2,
      labInfo: labs.get(point.lab),
      seriesInfo: series.get(point.series)
    }))
    .sort((a, b) => a.dateValue - b.dateValue);

  return {
    ...data,
    labs,
    series,
    points,
    pointsBySeries: groupBy(points, (point) => point.series)
  };
}

function initializeCompareDate() {
  const points = getVisiblePoints();
  const dateMin = Math.min(...points.map((point) => point.dateValue));
  const dateMax = Math.max(...points.map((point) => point.dateValue));
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
  return state.data.points.filter((point) =>
    isLabEnabled(point.lab) && isCohortEnabled(getSeriesCohort(point.series))
  );
}

function getVisibleDateExtent() {
  const points = getVisiblePoints();
  return {
    min: Math.min(...points.map((point) => point.dateValue)),
    max: Math.max(...points.map((point) => point.dateValue))
  };
}

function getVisibleSeriesEntries() {
  return Array.from(state.data.pointsBySeries.entries()).filter(([, points]) =>
    points.some((point) => isLabEnabled(point.lab) && isCohortEnabled(getSeriesCohort(point.series)))
  );
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
  state.height = Math.floor(window.innerHeight);
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
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
  const onLabToggle = getLabToggleAt(pointer.x, pointer.y);
  const onCohortToggle = getCohortToggleAt(pointer.x, pointer.y);
  const onFilterButton = getFilterButtonAt(pointer.x, pointer.y);
  const onFilterPanel = getFilterPanelAt(pointer.x, pointer.y);
  if (onControl || onLabToggle || onCohortToggle || onFilterButton || onFilterPanel) return;

  const cursor = getComparisonCursorAt(pointer);
  if (cursor) {
    state.draggingCursor = cursor;
    canvas.setPointerCapture?.(event.pointerId);
    updateComparisonDateFromX(cursor, pointer.x);
    draw();
  }
}

function onPointerUp() {
  state.draggingCursor = null;
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
  const filterButton = getFilterButtonAt(x, y);

  if (filterButton) {
    state.filterPanelOpen = !state.filterPanelOpen;
    state.hover = null;
    draw();
    return;
  }

  const labToggle = getLabToggleAt(x, y);

  if (labToggle) {
    toggleLab(labToggle.labId);
    draw();
    return;
  }

  const cohortToggle = getCohortToggleAt(x, y);

  if (cohortToggle) {
    toggleCohort(cohortToggle.cohortId);
    draw();
    return;
  }

  const control = getControlAt(x, y);

  if (control) {
    state.metric = control.id;
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
  ctx.save();
  const pulse = state.reducedMotion ? 0 : Math.sin((now - state.animationStart) / 3000) * 0.03;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.42, `rgba(247, 249, 252, ${0.98 + pulse})`);
  gradient.addColorStop(1, "#edf3f7");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const crosswash = ctx.createLinearGradient(width * 0.16, 0, width * 0.86, height);
  crosswash.addColorStop(0, "rgba(255, 255, 255, 0)");
  crosswash.addColorStop(0.5, "rgba(221, 232, 238, 0.34)");
  crosswash.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = crosswash;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(17, 24, 39, 0.035)";
  ctx.lineWidth = 1;
  const grid = 64;
  for (let x = 0; x <= width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function getLayout(width, height) {
  const compact = width < 980 || height < 560;
  const margin = compact
    ? { top: 164, right: 14, bottom: 38, left: 48 }
    : { top: 132, right: 184, bottom: 72, left: 86 };

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
  const points = getVisiblePoints();
  const values = points.map((point) => metricValue(point));
  const dateMin = Math.min(...points.map((point) => point.dateValue));
  const dateMax = Math.max(...points.map((point) => point.dateValue));
  const min = Math.max(0.03, Math.min(...values) * 0.72);
  const max = Math.max(...values) * 1.35;
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
  const x = compact ? 20 : 34;
  const y = compact ? 26 : 30;

  ctx.save();
  ctx.fillStyle = "#111827";
  ctx.font = `${compact ? 24 : 34}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText("Are tokens getting cheaper?", x, y);

  ctx.fillStyle = "rgba(31, 41, 55, 0.72)";
  ctx.font = `${compact ? 12 : 14}px Inter, system-ui, sans-serif`;
  const subtitle =
    compact
      ? "Major lab API prices, log scale, USD per 1M tokens"
      : "Release-price timeline for major OpenAI, Anthropic, and Google API model lines";
  ctx.fillText(subtitle, x, y + (compact ? 34 : 46));

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(17, 24, 39, 0.56)";
  ctx.font = `${compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  if (!compact) {
    ctx.fillText(`Data as of ${state.data.meta.asOf}`, width - x, y + 8);
  }
  ctx.restore();
}

function drawControls(layout) {
  const { compact, width } = layout;
  const y = compact ? 82 : 88;
  state.controls = [];
  state.labToggles = [];
  state.cohortToggles = [];
  state.filterButton = null;
  state.filterPanel = null;

  ctx.save();

  if (compact) {
    drawMetricControls(18, y, compact);
    drawFilterButton(18, y + 40, compact);
    if (state.filterPanelOpen) drawCompactFilterPanel(layout, y + 78);
  } else {
    const right = width - 34;
    const metricWidth = measureMetricControlsWidth(compact);
    const cohortWidth = measureCohortTogglesWidth(compact);
    const labWidth = measureLabTogglesWidth(compact);
    const metricX = right - metricWidth;
    const cohortX = metricX - 24 - cohortWidth;
    const labX = cohortX - 24 - labWidth;

    drawLabToggles(labX, y + 16, compact);
    drawCohortToggles(cohortX, y + 16, compact);
    drawMetricControls(metricX, y, compact);
  }

  ctx.restore();
}

function drawFilterButton(x, y, compact) {
  const h = 30;
  const w = compact ? 138 : 148;
  const active = state.filterPanelOpen;
  const enabled = state.enabledLabs.size + state.enabledCohorts.size;
  const total = state.data.labs.size + cohortOptions.length;
  const text = `Filters ${enabled}/${total}`;

  roundedRect(x, y, w, h, 15);
  ctx.fillStyle = active ? "#111827" : "rgba(255, 255, 255, 0.78)";
  ctx.fill();
  ctx.strokeStyle = active ? "#111827" : "rgba(17, 24, 39, 0.14)";
  ctx.stroke();

  ctx.fillStyle = active ? "#ffffff" : "rgba(17, 24, 39, 0.72)";
  ctx.font = `600 ${compact ? 12 : 13}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 14, y + h / 2 + 0.5);
  drawChevron(x + w - 22, y + h / 2, active, active ? "#ffffff" : "rgba(17, 24, 39, 0.62)");

  state.filterButton = { x, y, w, h };
}

function drawCompactFilterPanel(layout, y) {
  const x = 18;
  const w = layout.width - 36;
  const h = 128;
  state.filterPanel = { x, y, w, h };
  shadowedPanel(x, y, w, h, 12);

  ctx.save();
  ctx.fillStyle = "rgba(17, 24, 39, 0.5)";
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Labs", x + 14, y + 24);
  drawLabToggles(x + 14, y + 50, true);
  ctx.fillStyle = "rgba(17, 24, 39, 0.5)";
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.fillText("Models", x + 14, y + 82);
  drawCohortToggles(x + 14, y + 106, true);
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

function drawMetricControls(x, y, compact) {
  const h = 32;
  const gap = 6;
  const itemWidths = metricOptions.map(() => (compact ? 74 : 92));

  ctx.font = `${compact ? 12 : 13}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  metricOptions.forEach((option, index) => {
    const w = itemWidths[index];
    const active = option.id === state.metric;
    roundedRect(x, y, w, h, 16);
    ctx.fillStyle = active ? "#111827" : "rgba(255, 255, 255, 0.72)";
    ctx.fill();
    ctx.strokeStyle = active ? "#111827" : "rgba(17, 24, 39, 0.14)";
    ctx.stroke();
    ctx.fillStyle = active ? "#ffffff" : "rgba(17, 24, 39, 0.72)";
    ctx.fillText(option.label, x + w / 2, y + h / 2 + 0.5);
    state.controls.push({ id: option.id, x, y, w, h });
    x += w + gap;
  });
}

function measureMetricControlsWidth(compact) {
  const gap = 6;
  const itemWidths = metricOptions.map(() => (compact ? 74 : 92));
  return itemWidths.reduce((sum, item) => sum + item, 0) + gap * (metricOptions.length - 1);
}

function drawPlotSurface(layout) {
  const { chart } = layout;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
  ctx.fillRect(chart.x, chart.y, chart.w, chart.h);
  ctx.strokeStyle = "rgba(17, 24, 39, 0.1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(chart.x, chart.y, chart.w, chart.h);
  ctx.restore();
}

function drawAxes(layout, scales) {
  const { chart, compact } = layout;
  const yTicks = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200].filter(
    (tick) => tick >= scales.yMin && tick <= scales.yMax
  );
  const years = [2023, 2024, 2025, 2026];

  ctx.save();
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;

  yTicks.forEach((tick) => {
    const y = scales.y(tick);
    ctx.strokeStyle = tick === 1 ? "rgba(17, 24, 39, 0.18)" : "rgba(17, 24, 39, 0.075)";
    ctx.beginPath();
    ctx.moveTo(chart.x, y);
    ctx.lineTo(chart.x + chart.w, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(17, 24, 39, 0.55)";
    ctx.fillText(formatAxisMoney(tick), chart.x - 10, y);
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  years.forEach((year) => {
    const x = scales.x(new Date(`${year}-01-01T00:00:00Z`).getTime());
    if (x < chart.x || x > chart.x + chart.w) return;
    ctx.strokeStyle = "rgba(17, 24, 39, 0.075)";
    ctx.beginPath();
    ctx.moveTo(x, chart.y);
    ctx.lineTo(x, chart.y + chart.h);
    ctx.stroke();
    ctx.fillStyle = "rgba(17, 24, 39, 0.54)";
    ctx.fillText(String(year), x, chart.y + chart.h + 14);
  });

  if (!compact) {
    ctx.save();
    ctx.translate(28, chart.y + chart.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(17, 24, 39, 0.58)";
    ctx.textAlign = "center";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillText(`${metricLabel(state.metric)} price, USD per 1M tokens (log)`, 0, 0);
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

  for (const [seriesId, points] of seriesEntries) {
    const series = state.data.series.get(seriesId);
    const path = points.map((point) => ({
      point,
      x: scales.x(point.dateValue),
      y: scales.y(metricValue(point))
    }));

    drawSeriesPath(path, series.dash, withAlpha("#6b7280", 0.24 * alphaProgress), layout.compact ? 1.7 : 2.1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(startX, layout.chart.y - 4, Math.max(0, endX - startX) + 4, layout.chart.h + 8);
    ctx.clip();
    drawSeriesPath(path, series.dash, withAlpha(series.color, 0.86 * alphaProgress), layout.compact ? 2 : 2.6);
    ctx.restore();

    for (const item of path) {
      drawnPoints.push({ ...item, series });
      const inRange = item.x >= startX - 0.5 && item.x <= endX + 0.5;
      const color = inRange ? series.color : "rgba(107, 114, 128, 0.72)";
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
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
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
      x: scales.x(last.dateValue),
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

    ctx.strokeStyle = withAlpha(label.series.color, 0.42);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(label.x, sourceY);
    ctx.lineTo(textX - 7, label.y);
    ctx.stroke();

    ctx.fillStyle = "rgba(17, 24, 39, 0.76)";
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

  ctx.save();
  drawComparisonCursorLine(layout, startX);
  drawComparisonCursorLine(layout, endX);
  drawComparisonHandle(layout, startX);
  drawComparisonHandle(layout, endX);

  const tableWidth = compact ? 244 : 278;
  const bubbleW = compact ? Math.min(layout.width - 24, 306) : 392;
  const sentenceFont = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
  const sentenceLines = wrapCanvasText(stats.sentence, bubbleW - 32, sentenceFont, 3);
  const sentenceLineH = compact ? 14 : 15;
  const pillH = compact ? 21 : 23;
  const tableYInset = 18 + pillH + 7 + sentenceLines.length * sentenceLineH + 15;
  const tableRowH = compact ? 17 : 19;
  const bubbleH = tableYInset + tableRowH * (stats.groups.length + 1) + 16;
  const controlAvoidX = compact || !state.controls.length ? layout.width - 12 : state.controls[0].x - 14;
  const maxBubbleX = Math.max(12, controlAvoidX - bubbleW);
  const midX = (startX + endX) / 2;
  const bubbleX = clamp(midX - bubbleW / 2, 12, maxBubbleX);
  const bubbleY = chart.y + 10;
  const bubbleAnchorX = clamp(midX, bubbleX + 16, bubbleX + bubbleW - 16);

  ctx.strokeStyle = "rgba(17, 24, 39, 0.2)";
  ctx.beginPath();
  ctx.moveTo(bubbleAnchorX, bubbleY);
  ctx.lineTo(midX, chart.y);
  ctx.stroke();

  shadowedPanel(bubbleX, bubbleY, bubbleW, bubbleH, 13);

  drawComparisonNarrative(bubbleX, bubbleY + 18, bubbleW, stats, compact, color, sentenceLines);
  drawComparisonTable(bubbleX, bubbleY + tableYInset, bubbleW, stats, compact);
  ctx.restore();
}

function drawComparisonCursorLine(layout, x) {
  const { chart } = layout;
  ctx.strokeStyle = "rgba(17, 24, 39, 0.55)";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x, chart.y);
  ctx.lineTo(x, chart.y + chart.h);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawComparisonHandle(layout, x) {
  const { chart, compact } = layout;
  const handleY = chart.y + chart.h / 2;
  const handleW = compact ? 20 : 18;
  const handleH = compact ? 58 : 54;
  roundedRect(x - handleW / 2, handleY - handleH / 2, handleW, handleH, handleW / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(17, 24, 39, 0.24)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = "rgba(17, 24, 39, 0.48)";
  ctx.lineWidth = 1;
  for (const offset of [-3, 3]) {
    ctx.beginPath();
    ctx.moveTo(x + offset, handleY - 13);
    ctx.lineTo(x + offset, handleY + 13);
    ctx.stroke();
  }
}

function drawComparisonNarrative(x, y, w, stats, compact, color, sentenceLines) {
  const fontSize = compact ? 11 : 12;
  const pillH = compact ? 21 : 23;
  const pillPad = compact ? 18 : 20;
  const lineH = compact ? 14 : 15;
  const pillW = measureVerdictPillWidth(stats.pillText, fontSize, stats.verdict === "flat", pillPad);
  const pillTextColor = stats.verdict === "flat" ? "#422006" : "#ffffff";

  ctx.save();
  ctx.textBaseline = "middle";
  drawVerdictPill(x + (w - pillW) / 2, y, pillW, pillH, stats.pillText, color, pillTextColor, fontSize);

  ctx.fillStyle = "rgba(17, 24, 39, 0.62)";
  ctx.textAlign = "center";
  ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  sentenceLines.forEach((line, index) => {
    ctx.fillText(line, x + w / 2, y + pillH + 7 + index * lineH);
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
  const labelX = x + 16;
  const beforeX = x + w - (compact ? 92 : 102);
  const afterX = x + w - 18;
  const rowH = compact ? 17 : 19;

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = `${compact ? 9 : 10}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(17, 24, 39, 0.48)";
  ctx.textAlign = "right";
  ctx.fillText("Before", beforeX, y);
  ctx.fillText("After", afterX, y);

  ctx.strokeStyle = "rgba(17, 24, 39, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 14, y + rowH / 2);
  ctx.lineTo(x + w - 14, y + rowH / 2);
  ctx.stroke();

  stats.groups.forEach((group, index) => {
    const rowY = y + rowH * (index + 1);
    ctx.font = `600 ${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(17, 24, 39, 0.78)";
    ctx.textAlign = "left";
    ctx.fillText(group.label, labelX, rowY);

    ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(17, 24, 39, 0.64)";
    ctx.fillText(formatCompactMoney(group.startAverage), beforeX, rowY);

    ctx.fillStyle = group.changePercent < -0.5
      ? "#15803d"
      : group.changePercent > 0.5
        ? "#b91c1c"
        : "rgba(17, 24, 39, 0.64)";
    ctx.fillText(formatCompactMoney(group.endAverage), afterX, rowY);
  });

  ctx.restore();
}

function drawLabToggles(x, y, compact) {
  const labs = Array.from(state.data.labs.values());
  const logoSize = compact ? 18 : 23;
  const checkSize = compact ? 16 : 17;
  const gap = compact ? 12 : 14;

  ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  labs.forEach((lab) => {
    const itemW = measureLabToggleWidth(lab, compact);
    const enabled = isLabEnabled(lab.id);
    const alpha = enabled ? 1 : 0.34;
    const checkX = x;
    const logoX = x + checkSize + (compact ? 6 : 8);
    const color = enabled ? lab.brandColor : "#9ca3af";

    drawCheckToggle(checkX, y - checkSize / 2, checkSize, enabled, lab.brandColor);
    ctx.globalAlpha = alpha;
    drawTintedImage(lab.logo, logoX, y - logoSize / 2, logoSize, logoSize, color);
    ctx.globalAlpha = 1;

    const labelX = logoX + logoSize + 8;
    state.labToggles.push({
      labId: lab.id,
      x: checkX - 8,
      y: y - 18,
      w: itemW + 16,
      h: 36
    });

    ctx.fillStyle = enabled ? "rgba(17, 24, 39, 0.68)" : "rgba(107, 114, 128, 0.48)";
    ctx.fillText(lab.name, labelX, y);
    x += itemW + gap;
  });
}

function measureLabTogglesWidth(compact) {
  const gap = compact ? 12 : 14;
  const labs = Array.from(state.data.labs.values());
  ctx.save();
  ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
  const width = labs.reduce((sum, lab) => sum + measureLabToggleWidth(lab, compact), 0) + gap * (labs.length - 1);
  ctx.restore();
  return width;
}

function measureLabToggleWidth(lab, compact) {
  const logoSize = compact ? 18 : 23;
  const checkSize = compact ? 16 : 17;
  return checkSize + (compact ? 6 : 8) + logoSize + 8 + ctx.measureText(lab.name).width + 10;
}

function drawCohortToggles(x, y, compact) {
  const checkSize = compact ? 15 : 16;
  const gap = compact ? 12 : 14;

  ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  cohortOptions.forEach((cohort) => {
    const itemX = x;
    const itemW = measureCohortToggleWidth(cohort, compact);
    const enabled = isCohortEnabled(cohort.id);
    drawCheckToggle(itemX, y - checkSize / 2, checkSize, enabled, cohort.color);
    ctx.fillStyle = enabled ? "rgba(17, 24, 39, 0.72)" : "rgba(107, 114, 128, 0.48)";
    ctx.fillText(cohort.label, itemX + checkSize + 7, y);
    state.cohortToggles.push({
      cohortId: cohort.id,
      x: itemX - 8,
      y: y - 18,
      w: itemW + 16,
      h: 36
    });
    x += itemW + gap;
  });
}

function measureCohortTogglesWidth(compact) {
  const gap = compact ? 12 : 14;
  ctx.save();
  ctx.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
  const width = cohortOptions.reduce((sum, cohort) => sum + measureCohortToggleWidth(cohort, compact), 0) + gap * (cohortOptions.length - 1);
  ctx.restore();
  return width;
}

function measureCohortToggleWidth(cohort, compact) {
  const checkSize = compact ? 15 : 16;
  return checkSize + 7 + ctx.measureText(cohort.label).width + 10;
}

function drawCheckToggle(x, y, size, enabled, color) {
  ctx.save();
  roundedRect(x, y, size, size, 5);
  ctx.fillStyle = enabled ? color : "rgba(255, 255, 255, 0.72)";
  ctx.fill();
  ctx.strokeStyle = enabled ? withAlpha(color, 0.82) : "rgba(107, 114, 128, 0.38)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (enabled) {
    ctx.strokeStyle = "#ffffff";
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
  ctx.fillStyle = "rgba(17, 24, 39, 0.5)";
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const text = "Hover points for input + output. Standard text API rates; see data/sources.md for caveats.";
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

  ctx.save();
  ctx.strokeStyle = "rgba(17, 24, 39, 0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nearest.x, layout.chart.y);
  ctx.lineTo(nearest.x, layout.chart.y + layout.chart.h);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(nearest.x, nearest.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(nearest.series.color, 0.12);
  ctx.fill();
  ctx.strokeStyle = nearest.series.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  const point = nearest.point;
  const rows = [
    point.model,
    point.labInfo.name,
    formatDate(point.date),
    `Input ${money.format(point.inputUsdPer1M)} / 1M`,
    `Output ${money.format(point.outputUsdPer1M)} / 1M`
  ];
  const note = point.note && !layout.compact ? wrapText(point.note, 42) : [];
  const boxW = layout.compact ? 224 : 286;
  const lineH = layout.compact ? 16 : 18;
  const boxH = 24 + rows.length * lineH + note.length * 14 + (note.length ? 10 : 0);
  let boxX = nearest.x + 16;
  let boxY = nearest.y - boxH / 2;
  if (boxX + boxW > layout.width - 12) boxX = nearest.x - boxW - 16;
  boxY = Math.max(12, Math.min(layout.height - boxH - 12, boxY));

  shadowedPanel(boxX, boxY, boxW, boxH, 12);
  drawTintedImage(point.labInfo.logo, boxX + 14, boxY + 14, 22, 22, point.labInfo.brandColor);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#111827";
  ctx.font = `600 ${layout.compact ? 13 : 14}px Inter, system-ui, sans-serif`;
  ctx.fillText(rows[0], boxX + 46, boxY + 13);
  ctx.fillStyle = "rgba(17, 24, 39, 0.62)";
  ctx.font = `${layout.compact ? 11 : 12}px Inter, system-ui, sans-serif`;
  ctx.fillText(`${rows[1]} - ${rows[2]}`, boxX + 46, boxY + 31);

  let textY = boxY + 56;
  ctx.font = `${layout.compact ? 12 : 13}px Inter, system-ui, sans-serif`;
  for (const row of rows.slice(3)) {
    ctx.fillStyle = row.startsWith(metricLabel(state.metric)) ? point.seriesInfo.color : "rgba(17, 24, 39, 0.78)";
    ctx.fillText(row, boxX + 16, textY);
    textY += lineH;
  }

  if (note.length) {
    textY += 4;
    ctx.fillStyle = "rgba(17, 24, 39, 0.54)";
    ctx.font = "11px Inter, system-ui, sans-serif";
    for (const line of note) {
      ctx.fillText(line, boxX + 16, textY);
      textY += 14;
    }
  }

  ctx.restore();
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
    getFilterButtonAt(pointer.x, pointer.y) ||
    getControlAt(pointer.x, pointer.y)
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
  const points = getVisiblePoints();
  const dateMin = Math.min(...points.map((point) => point.dateValue));
  const dateMax = Math.max(...points.map((point) => point.dateValue));
  const minGap = (dateMax - dateMin) * 0.025;
  state.startDateValue = clamp(state.startDateValue, dateMin, Math.max(dateMin, dateMax - minGap));
  state.endDateValue = clamp(state.endDateValue, Math.min(dateMax, state.startDateValue + minGap), dateMax);
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
  const startDate = state.startDateValue;
  const endDate = state.endDateValue;
  const rows = [];
  const groups = {
    frontier: { label: "Frontier avg", rows: [] },
    mini: { label: "Small avg", rows: [] },
    nano: { label: "Tiny avg", rows: [] }
  };

  for (const [seriesId, points] of getVisibleSeriesEntries()) {
    const start = getLatestAtOrBefore(points, startDate);
    const end = getLatestAtOrBefore(points, endDate);
    if (!start || !end) continue;

    const row = {
      start: metricValue(start),
      end: metricValue(end)
    };
    rows.push(row);
    const cohortId = getSeriesCohort(seriesId);
    if (groups[cohortId]) groups[cohortId].rows.push(row);
  }

  if (!rows.length) {
    return {
      verdict: "flat",
      pillText: "not really",
      verdictColor: "#facc15",
      percent: 0,
      sentence: `No baseline is available from ${formatLongDate(startDate)} to ${formatLongDate(endDate)}.`,
      groups: getVisibleComparisonGroups(groups)
    };
  }

  const startAverage = rows.reduce((sum, row) => sum + row.start, 0) / rows.length;
  const endAverage = rows.reduce((sum, row) => sum + row.end, 0) / rows.length;
  const percent = ((endAverage - startAverage) / startAverage) * 100;
  const startDateText = formatLongDate(startDate);
  const endDateText = formatLongDate(endDate);
  const latestDate = getVisibleDateExtent().max;
  const usesLatestEnd = Math.abs(endDate - latestDate) < 1000 * 60 * 60 * 24 * 7;
  const flat = Math.abs(percent) <= 5;
  const verdict = flat ? "flat" : percent < 0 ? "yes" : "no";
  const subject = getEnabledTokenSubject();
  const sentence = getRangeSentence({
    startDateText,
    endDateText,
    percent,
    flat,
    usesLatestEnd,
    subject: subject.text
  });

  return {
    verdict,
    pillText: verdict === "flat" ? "not really" : verdict === "yes" ? "Yes" : "No",
    verdictColor: verdict === "flat" ? "#facc15" : verdict === "yes" ? "#16a34a" : "#dc2626",
    percent,
    sentence,
    groups: getVisibleComparisonGroups(groups)
  };
}

function getVisibleComparisonGroups(groups) {
  return cohortOptions
    .filter((cohort) => isCohortEnabled(cohort.id))
    .map((cohort) => summarizeComparisonGroup(groups[cohort.id]));
}

function getSeriesCohort(seriesId) {
  return state.data.series.get(seriesId)?.cohort || "frontier";
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
  ctx.save();
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = "#f7f8fb";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.fillStyle = "#991b1b";
  ctx.font = "16px Inter, system-ui, sans-serif";
  ctx.fillText(error.message || "Unable to load chart.", 24, 32);
  ctx.restore();
}

function metricValue(point) {
  return point[state.metric] ?? point.outputUsdPer1M;
}

function metricLabel(metric) {
  if (metric === "inputUsdPer1M") return "Input";
  if (metric === "blendedUsdPer1M") return "Blended";
  return "Output";
}

function formatAxisMoney(value) {
  if (value >= 1) return `$${value}`;
  return `$${value.toFixed(value < 0.1 ? 3 : 2)}`;
}

function formatDate(date) {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

function formatLongDate(dateValue) {
  const date = new Date(dateValue);
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC"
  }).format(date);
  const day = date.getUTCDate();
  return `${month} ${day}${ordinalSuffix(day)} ${date.getUTCFullYear()}`;
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
  if (value >= 100) return `${Math.round(value)}%`;
  if (value >= 10) return `${Math.round(value)}%`;
  return `${value.toFixed(1)}%`;
}

function formatCompactMoney(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 100) return `$${Math.round(value)}`;
  if (value >= 10) return `$${value.toFixed(1)}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(value < 0.1 ? 3 : 2)}`;
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
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.16)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  roundedRect(x, y, w, h, r);
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fill();
  ctx.restore();
  roundedRect(x, y, w, h, r);
  ctx.strokeStyle = "rgba(17, 24, 39, 0.08)";
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
