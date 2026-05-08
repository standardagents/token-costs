# Research Notes

Data is stored in `data/model-prices.json`. Prices are USD per 1M tokens for standard first-party API text/chat usage.

## Scope

- Included: OpenAI, Anthropic, and Google public API text/chat model lines.
- Excluded: audio, image, video, embedding, reranking, moderation, search-only, tool invocation, partner cloud-only markups, batch/flex/priority discounts, prompt caching, regional uplifts, provisioned throughput, and negotiated enterprise discounts.
- For context-tiered models, the chart uses the lower-context standard text price.
- The canvas defaults to output-token price because output tokens are usually the binding cost. Hovering a point shows both input and output price.

## Source Priority

1. Provider launch posts and provider docs.
2. Provider pricing pages for current or still-documented model prices.
3. Contemporaneous press/pricing references only when provider archives no longer expose retired model pricing.

## Known Caveats

- `Claude 3.5 Haiku` launched at a higher price and Anthropic later revised its public price to $0.80 input / $4 output on 2024-12-03. The dataset keeps the launch price because this chart is release-price oriented.
- Some Google 1.5 pricing was originally communicated across Gemini API and Vertex AI pages with modality/context tiers. The data uses the Gemini API token price where available and records the lower-context text tier.

## Primary Provider Links

- OpenAI API pricing: https://openai.com/api/pricing/
- OpenAI GPT-5 for developers: https://openai.com/index/introducing-gpt-5-for-developers
- OpenAI GPT-5.5: https://openai.com/index/introducing-gpt-5-5/
- Anthropic Claude model/pricing docs and launch posts: https://docs.anthropic.com/en/docs/about-claude/models/overview
- Anthropic Claude 3 family: https://www.anthropic.com/news/claude-3-family
- Anthropic Claude Opus 4.7: https://www.anthropic.com/news/claude-opus-4-7
- Google Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Google Gemini 3: https://blog.google/products-and-platforms/products/gemini/gemini-3/
- Google Gemini 3 Flash: https://blog.google/products/gemini/gemini-3-flash/
- Google Gemini 3.1 Flash-Lite: https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-lite

Full per-point source IDs and URLs are embedded in the JSON file.
