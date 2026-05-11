import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import interVariableUrl from "../assets/fonts/Inter-Variable.ttf?url";
import intelligenceData from "../data/model-intelligence.json";
import priceData from "../data/model-prices.json";
import { createViewStateFromSearchParams, normalizeData, serializeViewState } from "../src/pricing.js";
import { renderOgSvg } from "../src/og-svg.js";

const DATA = normalizeData(priceData, intelligenceData);
const OG_TTL_SECONDS = 60 * 24 * 60 * 60;
const OG_CACHE_CONTROL = `public, max-age=${OG_TTL_SECONDS}, s-maxage=${OG_TTL_SECONDS}, stale-while-revalidate=86400`;
let resvgReady;
let fontBuffersReady;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/og" || url.pathname === "/og-image.png") {
      return handleOgImage(request, env, ctx);
    }

    if (isDocumentRequest(request, url)) {
      return handleDocument(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleDocument(request, env) {
  const assetResponse = await env.ASSETS.fetch(request);
  const contentType = assetResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return assetResponse;

  const url = new URL(request.url);
  const view = createViewStateFromSearchParams(DATA, url.searchParams);
  const params = serializeViewState(DATA, view);
  const ogUrl = new URL("/api/og", url.origin);
  ogUrl.search = params.toString();
  const pageUrl = new URL(url.pathname || "/", url.origin);
  pageUrl.search = params.toString();
  const html = await assetResponse.text();
  const nextHtml = html
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${escapeHtml(ogUrl.toString())}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${escapeHtml(ogUrl.toString())}" />`)
    .replace("</head>", `<meta property="og:url" content="${escapeHtml(pageUrl.toString())}" />\n  </head>`);

  return new Response(nextHtml, {
    status: assetResponse.status,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-cache"
    }
  });
}

async function handleOgImage(request, env, ctx) {
  const url = new URL(request.url);
  const view = createViewStateFromSearchParams(DATA, url.searchParams);
  const params = serializeViewState(DATA, view);
  const cacheKey = `og/v11/${await sha256(params.toString())}.png`;
  const headers = {
    "content-type": "image/png",
    "cache-control": OG_CACHE_CONTROL,
    "vary": "Accept-Encoding",
    "x-og-cache-key": cacheKey
  };

  const cached = await env.OG_IMAGES?.get(cacheKey);
  if (cached) {
    const expiresAt = Date.parse(cached.customMetadata?.expiresAt || "");
    if (!Number.isFinite(expiresAt) || expiresAt > Date.now()) {
      return new Response(cached.body, {
        headers: {
          ...headers,
          "x-og-cache": "HIT"
        }
      });
    }
    ctx.waitUntil(env.OG_IMAGES.delete(cacheKey));
  }

  const svg = renderOgSvg(DATA, view);
  const png = await svgToPng(svg, request.url);

  if (env.OG_IMAGES) {
    const expiresAt = new Date(Date.now() + OG_TTL_SECONDS * 1000).toISOString();
    ctx.waitUntil(env.OG_IMAGES.put(cacheKey, png, {
      httpMetadata: {
        contentType: "image/png",
        cacheControl: OG_CACHE_CONTROL
      },
      customMetadata: {
        params: params.toString(),
        expiresAt
      }
    }));
  }

  return new Response(png, {
    headers: {
      ...headers,
      "x-og-cache": "MISS"
    }
  });
}

async function svgToPng(svg, requestUrl) {
  await ensureResvg();
  const fontBuffers = await loadFontBuffers(requestUrl);
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      fontBuffers,
      loadSystemFonts: false,
      defaultFontFamily: "Inter"
    }
  });
  try {
    return renderer.render().asPng();
  } finally {
    renderer.free();
  }
}

async function loadFontBuffers(requestUrl) {
  if (!fontBuffersReady) {
    fontBuffersReady = fetch(new URL(interVariableUrl, requestUrl))
      .then((response) => response.arrayBuffer())
      .then((buffer) => [new Uint8Array(buffer)]);
  }
  return fontBuffersReady;
}

async function ensureResvg() {
  if (!resvgReady) {
    resvgReady = initWasm(resvgWasm).catch((error) => {
      if (String(error?.message || "").includes("Already initialized")) return;
      throw error;
    });
  }
  await resvgReady;
}

function isDocumentRequest(request, url) {
  if (url.pathname !== "/" && url.pathname !== "/index.html") return false;
  return request.method === "GET" || request.method === "HEAD";
}

async function sha256(value) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
