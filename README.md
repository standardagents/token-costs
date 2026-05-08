# Are Tokens Getting Cheaper?

A dependency-free full-screen Canvas chart of OpenAI, Anthropic, and Google API token prices over time.

## Run

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Files

- `data/model-prices.json` - researched release-price data and source URLs.
- `data/sources.md` - scope, caveats, and source notes.
- `src/main.js` - Canvas renderer, hover/tap interactions, top lab/model-class toggles, and draggable comparison range cursors.
- `assets/logos/*.svg` - provider SVG marks.
- `assets/generated/chart-backdrop.png` - generated backdrop retained as an unused asset from the first visual pass.
