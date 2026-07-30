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
const WAITLIST_API = "https://agents.standardagentbuilder.com/api/waitlist";
const WAITLIST_SOURCE = "tokens-getting-cheaper";
let resvgReady;
let fontBuffersReady;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/og" || url.pathname === "/og-image.png") {
      return handleOgImage(request, env, ctx);
    }

    if (url.pathname === "/api/early-access" && request.method === "POST") {
      return handleEarlyAccess(request, env);
    }

    if (isDocumentRequest(request, url)) {
      return handleDocument(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleEarlyAccess(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!name || !email) {
      return Response.json({ error: "Name and email are required" }, { status: 400 });
    }
    if (!env.WAITLIST_API_TOKEN) {
      console.error("[early-access] WAITLIST_API_TOKEN is not set");
      return Response.json({ error: "Server is missing credentials" }, { status: 500 });
    }
    const upstream = await fetch(WAITLIST_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WAITLIST_API_TOKEN}`
      },
      body: JSON.stringify({ email, name, source: WAITLIST_SOURCE })
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      console.warn(`[early-access] upstream ${upstream.status}: ${text}`);
      return Response.json({ error: "Could not reach the waitlist" }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[early-access] error:", error);
    return Response.json({ error: "Unexpected error" }, { status: 500 });
  }
}

async function handleDocument(request, env) {
  const assetResponse = await env.ASSETS.fetch(request);
  const contentType = assetResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return assetResponse;

  const url = new URL(request.url);
  const cleanParams = normalizeAmpParams(url.searchParams);
  const view = createViewStateFromSearchParams(DATA, cleanParams);
  const params = serializeViewState(DATA, view);
  const ogUrl = new URL("/api/og", url.origin);
  ogUrl.search = params.toString();
  const pageUrl = new URL(url.pathname || "/", url.origin);
  pageUrl.search = params.toString();
  const html = await assetResponse.text();
  const nextHtml = html
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${escapeAttr(ogUrl.toString())}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${escapeAttr(ogUrl.toString())}" />`)
    .replace("</head>", `<meta property="og:url" content="${escapeAttr(pageUrl.toString())}" />\n  </head>`);

  return new Response(nextHtml, {
    status: assetResponse.status,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-cache"
    }
  });
}

function normalizeAmpParams(searchParams) {
  const out = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    out.append(key.startsWith("amp;") ? key.slice(4) : key, value);
  }
  return out;
}

async function handleOgImage(request, env, ctx) {
  const url = new URL(request.url);
  const cleanParams = normalizeAmpParams(url.searchParams);
  const view = createViewStateFromSearchParams(DATA, cleanParams);
  const params = serializeViewState(DATA, view);
  const cacheKey = `og/v15/${await sha256(params.toString())}.png`;
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
  const png = await svgToPng(svg, request.url, env);

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

async function svgToPng(svg, requestUrl, env) {
  await ensureResvg();
  const fontBuffers = await loadFontBuffers(requestUrl, env);
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

async function loadFontBuffers(requestUrl, env) {
  if (!fontBuffersReady) {
    fontBuffersReady = (async () => {
      const fontUrl = new URL(interVariableUrl, requestUrl);
      let response;
      if (env?.ASSETS) {
        response = await env.ASSETS.fetch(new Request(fontUrl.toString()));
      } else {
        response = await fetch(fontUrl);
      }
      if (!response.ok) {
        throw new Error(`Font fetch failed: ${response.status} ${fontUrl.pathname}`);
      }
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength) {
        throw new Error(`Font buffer empty for ${fontUrl.pathname}`);
      }
      return [new Uint8Array(buffer)];
    })().catch((error) => {
      fontBuffersReady = null;
      throw error;
    });
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

function escapeAttr(value) {
  return String(value).replaceAll('"', "&quot;");
}
