export const DAY_MS = 24 * 60 * 60 * 1000;
export const INTELLIGENCE_METRIC = "combinedUsdPer1MPerIntelligence";

export const metricOptions = [
  { id: "outputUsdPer1M", param: "output", label: "Output" },
  { id: "inputUsdPer1M", param: "input", label: "Input" },
  { id: "blendedUsdPer1M", param: "blended", label: "Blended" },
  { id: INTELLIGENCE_METRIC, param: "intelligence", label: "Per IQ" }
];

export const cohortOptions = [
  { id: "frontier", label: "Frontier", color: "#111827" },
  { id: "mini", label: "Small", color: "#64748b" },
  { id: "nano", label: "Tiny", color: "#8ab4f8" }
];

export const DEFAULT_METRIC = "outputUsdPer1M";
export const DEFAULT_TIMELINE_ZOOM = "all";
export const timelineZoomOptions = [
  { id: "all", param: "all", label: "All", months: null },
  { id: "2y", param: "2y", label: "2Y", months: 24 },
  { id: "1y", param: "1y", label: "1Y", months: 12 },
  { id: "6m", param: "6m", label: "6M", months: 6 }
];

export function normalizeData(data, intelligenceData = null) {
  const labs = new Map(data.labs.map((lab) => [lab.id, lab]));
  const series = new Map(data.series.map((item) => [item.id, item]));
  const intelligenceScores = new Map(Object.entries(intelligenceData?.scores || {}));
  const points = data.points
    .map((point) => {
      const intelligenceInfo = intelligenceScores.get(point.model) || null;
      const blendedUsdPer1M = (point.inputUsdPer1M + point.outputUsdPer1M) / 2;
      const combinedUsdPer1M = point.inputUsdPer1M + point.outputUsdPer1M;
      const intelligenceScore = intelligenceInfo?.score ?? null;

      return {
        ...point,
        dateValue: dateStringToValue(point.date),
        blendedUsdPer1M,
        combinedUsdPer1M,
        [INTELLIGENCE_METRIC]: intelligenceScore ? combinedUsdPer1M / intelligenceScore : null,
        intelligenceInfo,
        intelligenceScore,
        labInfo: labs.get(point.lab),
        seriesInfo: series.get(point.series)
      };
    })
    .sort((a, b) => a.dateValue - b.dateValue);
  const pointDateValues = points.map((point) => point.dateValue);
  const pointDateMin = Math.min(...pointDateValues);
  const pointDateMax = Math.max(...pointDateValues);
  const asOfDateValue = data.meta?.asOf ? dateStringToValue(data.meta.asOf) : pointDateMax;

  return {
    ...data,
    intelligenceMeta: intelligenceData?.meta || null,
    intelligenceScores,
    labs,
    series,
    points,
    pointsBySeries: groupBy(points, (point) => point.series),
    pointDateMin,
    pointDateMax,
    asOfDateValue: Math.max(asOfDateValue, pointDateMax)
  };
}

export function createViewStateFromSearchParams(data, searchParams) {
  const metric = parseMetricParam(searchParams.get("metric")) || data.meta?.defaultMetric || DEFAULT_METRIC;
  const timelineZoom = parseTimelineZoomParam(searchParams.get("zoom")) || DEFAULT_TIMELINE_ZOOM;
  const enabledLabs = parseEnabledList(
    searchParams.get("labs"),
    Array.from(data.labs.keys())
  );
  const enabledCohorts = parseEnabledList(
    searchParams.get("models"),
    cohortOptions.map((cohort) => cohort.id)
  );
  const baseView = { metric, timelineZoom, enabledLabs, enabledCohorts };
  const extent = getVisibleDateExtent(data, baseView);
  const fallbackStart = snapToUtcDay(extent.min + (extent.max - extent.min) * 0.5);
  const fallbackEnd = extent.max;
  const startDateValue = parseDateParam(searchParams.get("from")) ?? fallbackStart;
  const endDateValue = parseDateParam(searchParams.get("to")) ?? fallbackEnd;
  const clamped = clampDateRange(data, baseView, startDateValue, endDateValue);

  return {
    ...baseView,
    startDateValue: clamped.startDateValue,
    endDateValue: clamped.endDateValue
  };
}

export function serializeViewState(data, view) {
  const params = new URLSearchParams();
  const metric = metricOptions.find((option) => option.id === view.metric) || metricOptions[0];
  const enabledLabs = Array.from(data.labs.keys()).filter((id) => view.enabledLabs.has(id));
  const enabledCohorts = cohortOptions
    .map((cohort) => cohort.id)
    .filter((id) => view.enabledCohorts.has(id));

  params.set("metric", metric.param);
  params.set("zoom", getTimelineZoomOption(view.timelineZoom).param);
  params.set("labs", enabledLabs.join(","));
  params.set("models", enabledCohorts.join(","));
  params.set("from", dateValueToParam(view.startDateValue));
  params.set("to", dateValueToParam(view.endDateValue));
  return params;
}

export function getVisiblePoints(data, view) {
  return data.points.filter((point) =>
    isLabEnabled(view, point.lab) && isCohortEnabled(view, getSeriesCohort(data, point.series))
  );
}

export function getVisibleDateExtent(data, view) {
  const fullExtent = getFullVisibleDateExtent(data, view);
  const zoom = getTimelineZoomOption(view.timelineZoom);
  if (!zoom.months) return fullExtent;

  return {
    min: Math.max(fullExtent.min, shiftUtcMonths(fullExtent.max, -zoom.months)),
    max: fullExtent.max
  };
}

export function getFullVisibleDateExtent(data, view) {
  const points = getVisiblePoints(data, view);
  if (!points.length) {
    return {
      min: data.pointDateMin,
      max: data.asOfDateValue || data.pointDateMax
    };
  }

  return {
    min: Math.min(...points.map((point) => point.dateValue)),
    max: Math.max(data.asOfDateValue || data.pointDateMax, ...points.map((point) => point.dateValue))
  };
}

export function getVisibleTimelinePoints(data, view) {
  const extent = getVisibleDateExtent(data, view);
  const visible = [];

  for (const [, points] of getVisibleSeriesEntries(data, view)) {
    let boundaryPoint = null;
    for (const point of points) {
      if (point.dateValue <= extent.min) boundaryPoint = point;
      if (point.dateValue > extent.min && point.dateValue <= extent.max) visible.push(point);
      if (point.dateValue > extent.max) break;
    }
    if (boundaryPoint) visible.push(boundaryPoint);
  }

  return visible;
}

export function getVisibleSeriesEntries(data, view) {
  return Array.from(data.pointsBySeries.entries()).filter(([, points]) =>
    points.some((point) => isLabEnabled(view, point.lab) && isCohortEnabled(view, getSeriesCohort(data, point.series)))
  );
}

export function getTimelineSeriesPoints(points, dateMin, dateMax) {
  let boundaryPoint = null;
  const visible = [];

  for (const point of points) {
    if (point.dateValue <= dateMin) boundaryPoint = point;
    if (point.dateValue > dateMin && point.dateValue <= dateMax) visible.push(point);
    if (point.dateValue > dateMax) break;
  }

  if (boundaryPoint) {
    visible.unshift({
      ...boundaryPoint,
      date: dateValueToParam(dateMin),
      dateValue: dateMin,
      boundary: boundaryPoint.dateValue !== dateMin
    });
  }

  return visible;
}

export function getExtendedSeriesPoints(points, dateMax) {
  if (!points.length) return points;
  const last = points[points.length - 1];
  if (last.dateValue >= dateMax) return points;
  return [
    ...points,
    {
      ...last,
      date: dateValueToParam(dateMax),
      dateValue: dateMax,
      extended: true
    }
  ];
}

export function clampDateRange(data, view, startDateValue, endDateValue) {
  const extent = getVisibleDateExtent(data, view);
  const dateMin = extent.min;
  const dateMax = extent.max;
  const minGap = Math.max(DAY_MS, (dateMax - dateMin) * 0.025);
  const start = clamp(
    snapToUtcDay(startDateValue),
    dateMin,
    Math.max(dateMin, dateMax - minGap)
  );
  const end = clamp(
    snapToUtcDay(endDateValue),
    Math.min(dateMax, start + minGap),
    dateMax
  );

  return {
    startDateValue: start,
    endDateValue: end
  };
}

export function getComparisonStats(data, view) {
  const startDate = view.startDateValue;
  const endDate = view.endDateValue;
  const rows = [];
  const groups = {
    frontier: { label: "Frontier avg", rows: [] },
    mini: { label: "Small avg", rows: [] },
    nano: { label: "Tiny avg", rows: [] }
  };

  for (const [seriesId, points] of getVisibleSeriesEntries(data, view)) {
    const start = getLatestAtOrBefore(points, startDate);
    const end = getLatestAtOrBefore(points, endDate);
    if (!start || !end) continue;

    const startValue = metricValue(start, view.metric);
    const endValue = metricValue(end, view.metric);
    if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) continue;

    const row = {
      start: startValue,
      end: endValue
    };
    rows.push(row);
    const cohortId = getSeriesCohort(data, seriesId);
    if (groups[cohortId]) groups[cohortId].rows.push(row);
  }

  if (!rows.length) {
    return {
      verdict: "flat",
      pillText: "not really",
      verdictColor: "#facc15",
      percent: 0,
      sentence: `No baseline is available from ${formatLongDate(startDate)} to ${formatLongDate(endDate)}.`,
      groups: getVisibleComparisonGroups(view, groups)
    };
  }

  const startAverage = rows.reduce((sum, row) => sum + row.start, 0) / rows.length;
  const endAverage = rows.reduce((sum, row) => sum + row.end, 0) / rows.length;
  const percent = ((endAverage - startAverage) / startAverage) * 100;
  const extent = getVisibleDateExtent(data, view);
  const usesLatestEnd = Math.abs(endDate - extent.max) < DAY_MS * 7;
  const flat = Math.abs(percent) <= 5;
  const verdict = flat ? "flat" : percent < 0 ? "yes" : "no";
  const sentence = getRangeSentence({
    startDateText: formatLongDate(startDate),
    endDateText: formatLongDate(endDate),
    percent,
    flat,
    usesLatestEnd,
    subject: getEnabledMetricSubject(data, view)
  });

  return {
    verdict,
    pillText: verdict === "flat" ? "not really" : verdict === "yes" ? "Yes" : "No",
    verdictColor: verdict === "flat" ? "#facc15" : verdict === "yes" ? "#16a34a" : "#dc2626",
    percent,
    sentence,
    groups: getVisibleComparisonGroups(view, groups)
  };
}

export function getSeriesCohort(data, seriesId) {
  return data.series.get(seriesId)?.cohort || "frontier";
}

export function isLabEnabled(view, labId) {
  return view.enabledLabs.has(labId);
}

export function isCohortEnabled(view, cohortId) {
  return view.enabledCohorts.has(cohortId);
}

export function metricValue(point, metric) {
  const value = point[metric];
  if (Number.isFinite(value)) return value;
  return Number.isFinite(point.outputUsdPer1M) ? point.outputUsdPer1M : null;
}

export function metricLabel(metric) {
  if (metric === "inputUsdPer1M") return "Input";
  if (metric === "blendedUsdPer1M") return "Blended";
  if (metric === INTELLIGENCE_METRIC) return "Per IQ";
  return "Output";
}

export function metricAxisLabel(metric) {
  if (metric === INTELLIGENCE_METRIC) {
    return "Combined price, USD per 1M tokens per AA intelligence point (log)";
  }
  return `${metricLabel(metric)} price, USD per 1M tokens (log)`;
}

export function isIntelligenceMetric(metric) {
  return metric === INTELLIGENCE_METRIC;
}

export function getTimelineTicks(min, max) {
  const rangeDays = Math.max(1, (max - min) / DAY_MS);
  const intervalMonths = rangeDays <= 220
    ? 1
    : rangeDays <= 460
      ? 2
      : rangeDays <= 900
        ? 3
        : rangeDays <= 1500
          ? 6
          : 12;
  const first = new Date(min);
  first.setUTCHours(0, 0, 0, 0);
  first.setUTCDate(1);
  while (first.getTime() < min || first.getUTCMonth() % intervalMonths !== 0) {
    first.setUTCMonth(first.getUTCMonth() + 1);
  }

  const ticks = [];
  let previousYear = null;
  for (const date = new Date(first); date.getTime() <= max; date.setUTCMonth(date.getUTCMonth() + intervalMonths)) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const label = intervalMonths === 12
      ? String(year)
      : `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}${previousYear == null || previousYear !== year ? ` ’${String(year).slice(-2)}` : ""}`;
    ticks.push({ value: date.getTime(), label });
    previousYear = year;
  }
  return ticks;
}

export function getLogTicks(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return [];

  const ticks = [];
  const factors = [1, 2, 2.5, 5];
  const startExponent = Math.floor(Math.log10(min));
  const endExponent = Math.ceil(Math.log10(max));

  for (let exponent = startExponent; exponent <= endExponent; exponent += 1) {
    const base = 10 ** exponent;
    for (const factor of factors) {
      const tick = Number((base * factor).toPrecision(12));
      if (tick >= min * 0.999 && tick <= max * 1.001) ticks.push(tick);
    }
  }

  return ticks;
}

export function formatLongDate(dateValue) {
  const date = new Date(dateValue);
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC"
  }).format(date);
  const day = date.getUTCDate();
  return `${month} ${day}${ordinalSuffix(day)} ${date.getUTCFullYear()}`;
}

export function formatPercent(value) {
  if (value >= 100) return `${Math.round(value)}%`;
  if (value >= 10) return `${Math.round(value)}%`;
  return `${value.toFixed(1)}%`;
}

export function formatCompactMoney(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 100) return `$${Math.round(value)}`;
  if (value >= 10) return `$${value.toFixed(1)}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

export function dateStringToValue(date) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

export function snapToUtcDay(value) {
  return Math.round(value / DAY_MS) * DAY_MS;
}

export function dateValueToParam(value) {
  return new Date(snapToUtcDay(value)).toISOString().slice(0, 10);
}

function parseEnabledList(value, allowed) {
  const allowedSet = new Set(allowed);
  const requested = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => allowedSet.has(item));
  return new Set(requested.length ? requested : allowed);
}

function parseMetricParam(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  const option = metricOptions.find((item) => item.param === normalized || item.id === normalized);
  return option?.id || null;
}

function parseTimelineZoomParam(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return timelineZoomOptions.find((item) => item.param === normalized || item.id === normalized)?.id || null;
}

function getTimelineZoomOption(value) {
  return timelineZoomOptions.find((item) => item.id === value || item.param === value) || timelineZoomOptions[0];
}

function shiftUtcMonths(value, amount) {
  const source = new Date(value);
  const day = source.getUTCDate();
  const shifted = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), 1));
  shifted.setUTCMonth(shifted.getUTCMonth() + amount);
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  shifted.setUTCDate(Math.min(day, lastDay));
  return shifted.getTime();
}

function parseDateParam(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dateStringToValue(value);
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return null;
}

function getVisibleComparisonGroups(view, groups) {
  return cohortOptions
    .filter((cohort) => isCohortEnabled(view, cohort.id))
    .map((cohort) => summarizeComparisonGroup(groups[cohort.id]));
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
  const amount = formatPercent(Math.abs(percent));
  const inlineSubject = subject === "Tokens"
    ? "tokens"
    : subject.startsWith("Token ")
      ? `token${subject.slice(5)}`
      : subject;

  if (flat) {
    return usesLatestEnd
      ? `${subject} haven't really gotten any cheaper since ${startDateText}.`
      : `${subject} didn't really get any cheaper between ${startDateText} and ${endDateText}.`;
  }

  if (percent < 0) {
    return usesLatestEnd
      ? `Yes, ${inlineSubject} have gotten cheaper since ${startDateText}; they're down roughly ${amount}.`
      : `Yes, ${inlineSubject} got cheaper between ${startDateText} and ${endDateText}; they were down roughly ${amount}.`;
  }

  return usesLatestEnd
    ? `No, ${inlineSubject} have not gotten cheaper since ${startDateText}; they're up roughly ${amount}.`
    : `No, ${inlineSubject} did not get cheaper between ${startDateText} and ${endDateText}; they were up roughly ${amount}.`;
}

function getEnabledMetricSubject(data, view) {
  const enabled = Array.from(data.labs.values()).filter((lab) => isLabEnabled(view, lab.id));
  const cohort = getEnabledCohortSubject(view);
  if (enabled.length === 1) return `${providerPossessive(enabled[0].name)} ${cohort}`;
  if (enabled.length === 2) {
    return `${providerPossessive(enabled[0].name)} and ${providerPossessive(enabled[1].name)} ${cohort}`;
  }
  return capitalize(cohort);
}

function getEnabledCohortSubject(view) {
  const enabled = cohortOptions.filter((cohort) => isCohortEnabled(view, cohort.id));
  let subject = "tokens";

  if (enabled.length === 1) {
    subject = `${enabled[0].label.toLowerCase()} tokens`;
  } else if (enabled.length === 2) {
    subject = `${enabled[0].label.toLowerCase()} and ${enabled[1].label.toLowerCase()} tokens`;
  }

  return isIntelligenceMetric(view.metric) ? toIntelligenceSubject(subject) : subject;
}

function toIntelligenceSubject(subject) {
  if (subject.endsWith("tokens")) {
    return `${subject.slice(0, -6)}token costs per intelligence point`.trim();
  }
  return `${subject} per intelligence point`;
}

function providerPossessive(name) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
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

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function ordinalSuffix(day) {
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
