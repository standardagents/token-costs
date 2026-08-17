import {
  getComparisonStats,
  getExtendedSeriesPoints,
  getLogTicks,
  getTimelineSeriesPoints,
  getTimelineTicks,
  getVisibleDateExtent,
  getVisibleTimelinePoints,
  getVisibleSeriesEntries,
  metricValue
} from "./pricing.js";

const WIDTH = 1200;
const HEIGHT = 630;
const MARK_PATH = "M44.06,0v44.08H0v105.92h105.93v-44.07h44.07V0H44.06ZM19.09,130.91c-16.47-16.47-5.29-54.45,24.96-85.18v60.2h60.23c-30.73,30.27-68.71,41.47-85.2,24.98ZM105.93,104.29v-60.21h-60.21C76.46,13.8,114.42,2.6,130.91,19.09c16.51,16.49,5.31,54.47-24.98,85.2Z";

export function renderOgSvg(data, view) {
  const stats = getComparisonStats(data, view);
  const chart = { x: 604, y: 102, w: 526, h: 432 };
  const scales = getOgScales(data, view, chart);
  const startX = scales.x(view.startDateValue);
  const endX = scales.x(view.endDateValue);
  const activeWidth = Math.max(2, endX - startX);
  const lines = renderSeries(data, view, chart, scales);
  const grid = renderGrid(chart, scales);
  const answer = renderAnswerText(stats, 66, 352, 462);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="52%" stop-color="#f5f8fb"/>
      <stop offset="100%" stop-color="#e8f0f4"/>
    </linearGradient>
    <radialGradient id="wash" cx="22%" cy="24%" r="80%">
      <stop offset="0%" stop-color="#dfeaf2" stop-opacity="0.66"/>
      <stop offset="58%" stop-color="#f7fafc" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="plot-clip"><rect x="${chart.x}" y="${chart.y}" width="${chart.w}" height="${chart.h}"/></clipPath>
    <clipPath id="active-clip"><rect x="${startX}" y="${chart.y - 4}" width="${activeWidth}" height="${chart.h + 8}"/></clipPath>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash)"/>
  <g transform="translate(64 56) scale(0.28)" fill="#1f2937"><path d="${MARK_PATH}"/></g>
  <text x="124" y="78" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#1f2937">Standard Agents</text>
  <text x="64" y="188" font-family="Inter, Arial, sans-serif" font-size="62" font-weight="800" fill="#111827">Are tokens</text>
  <text x="64" y="258" font-family="Inter, Arial, sans-serif" font-size="62" font-weight="800" fill="#111827">getting cheaper?</text>
  ${answer}
  <rect x="${chart.x}" y="${chart.y}" width="${chart.w}" height="${chart.h}" rx="0" fill="#ffffff" fill-opacity="0.34" stroke="#111827" stroke-opacity="0.08"/>
  ${grid}
  <rect x="${chart.x}" y="${chart.y}" width="${Math.max(0, startX - chart.x)}" height="${chart.h}" fill="#f8fafc" fill-opacity="0.62"/>
  <rect x="${endX}" y="${chart.y}" width="${Math.max(0, chart.x + chart.w - endX)}" height="${chart.h}" fill="#f8fafc" fill-opacity="0.62"/>
  <g clip-path="url(#plot-clip)">${lines}</g>
  ${renderCursor(startX, chart)}
  ${renderCursor(endX, chart)}
</svg>`;
}

function getOgScales(data, view, chart) {
  const points = getVisibleTimelinePoints(data, view);
  const values = points
    .map((point) => metricValue(point, view.metric))
    .filter((value) => Number.isFinite(value));
  const { min: dateMin, max: dateMax } = getVisibleDateExtent(data, view);
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
    x: (dateValue) => chart.x + ((dateValue - dateMin) / dateRange) * chart.w,
    y: (value) => {
      const t = (Math.log10(value) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin));
      return chart.y + chart.h - t * chart.h;
    }
  };
}

function renderSeries(data, view, chart, scales) {
  return getVisibleSeriesEntries(data, view).map(([seriesId, points]) => {
    const series = data.series.get(seriesId);
    const timelinePoints = getTimelineSeriesPoints(points, scales.dateMin, scales.dateMax);
    const pathPoints = getExtendedSeriesPoints(timelinePoints, scales.dateMax);
    const d = buildPath(pathPoints, scales, view.metric);

    return `
      <path d="${d}" fill="none" stroke="#94a3b8" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.30"/>
      <path d="${d}" fill="none" stroke="${series.color}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#active-clip)"/>`;
  }).join("");
}

function renderGrid(chart, scales) {
  const yTicks = getLogTicks(scales.yMin, scales.yMax);
  const timelineTicks = getTimelineTicks(scales.dateMin, scales.dateMax);
  const yMarkup = yTicks.map((tick) => {
    const y = scales.y(tick);
    return `<line x1="${chart.x}" y1="${round(y)}" x2="${chart.x + chart.w}" y2="${round(y)}" stroke="#111827" stroke-opacity="${tick === 1 ? 0.12 : 0.055}"/>`;
  }).join("");
  const xMarkup = timelineTicks.map((tick) => {
    const x = scales.x(tick.value);
    if (x < chart.x || x > chart.x + chart.w) return "";
    return `<line x1="${round(x)}" y1="${chart.y}" x2="${round(x)}" y2="${chart.y + chart.h}" stroke="#111827" stroke-opacity="0.055"/>`;
  }).join("");
  return `${yMarkup}${xMarkup}`;
}

function renderCursor(x, chart) {
  return `<line x1="${round(x)}" y1="${chart.y - 8}" x2="${round(x)}" y2="${chart.y + chart.h + 8}" stroke="#111827" stroke-opacity="0.45" stroke-width="2.2" stroke-dasharray="7 8"/>`;
}

function renderAnswerText(stats, x, y, maxWidth) {
  const answer = stats.verdict === "yes" ? "Yes" : "No";
  const color = stats.verdict === "yes" ? "#16a34a" : "#dc2626";
  const pillW = 76;
  const pillH = 38;
  const pillGap = 10;
  const sentence = getSentenceAfterVerdict(stats.sentence, answer);
  const firstLineWidth = maxWidth - pillW - pillGap;
  const lines = wrapSentence(sentence, [firstLineWidth, maxWidth, maxWidth, maxWidth], 13.2);
  const textLines = lines.map((line, index) => {
    const lineX = index === 0 ? x + pillW + pillGap : x;
    const lineY = y + 28 + index * 34;
    return `<text x="${lineX}" y="${lineY}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="500" fill="#4b5563">${escapeXml(line)}</text>`;
  }).join("");

  return `<g>
    <rect x="${x}" y="${y}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${color}"/>
    <text x="${x + pillW / 2}" y="${y + 27}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="23" font-weight="800" fill="#ffffff">${answer}</text>
    ${textLines}
  </g>`;
}

function buildPath(points, scales, metric) {
  return points.map((point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${command}${round(scales.x(point.dateValue))},${round(scales.y(metricValue(point, metric)))}`;
  }).join(" ");
}

function getSentenceAfterVerdict(sentence, answer) {
  if (answer === "Yes") return sentence.replace(/^Yes,\s*/i, "");
  return sentence.replace(/^No,\s*/i, "");
}

function wrapSentence(text, widths, averageCharWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const width = widths[Math.min(lines.length, widths.length - 1)];
    const maxChars = Math.max(12, Math.floor(width / averageCharWidth));
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, widths.length);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function round(value) {
  return Math.round(value * 10) / 10;
}
