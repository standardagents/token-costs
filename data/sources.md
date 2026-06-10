# Research Notes

Data is stored in `data/model-prices.json`. Prices are USD per 1M tokens for standard first-party API text/chat usage.

Artificial Analysis intelligence mappings are stored in `data/model-intelligence.json`. The `Per IQ` chart mode uses:

`(inputUsdPer1M + outputUsdPer1M) / intelligenceScore`

## Scope

- Included: OpenAI, Anthropic, and Google public API text/chat model lines.
- Excluded: audio, image, video, embedding, reranking, moderation, search-only, tool invocation, partner cloud-only markups, batch/flex/priority discounts, prompt caching, regional uplifts, provisioned throughput, and negotiated enterprise discounts.
- For context-tiered models, the chart uses the lower-context standard text price.
- The canvas defaults to output-token price because output tokens are usually the binding cost. Hovering a point shows both input and output price.
- The `Per IQ` mode uses the Artificial Analysis Intelligence Index score attached to each release row. When Artificial Analysis does not track the exact launch-date page for a row, the mapping file records the closest family benchmark or price-update reuse in its `resolution` and `note` fields.

## Source Priority

1. Provider launch posts and provider docs.
2. Provider pricing pages for current or still-documented model prices.
3. Contemporaneous press/pricing references only when provider archives no longer expose retired model pricing.

## Known Caveats

- `Claude 3.5 Haiku` launched at a higher price and Anthropic later revised its public price to $0.80 input / $4 output on 2024-12-03. Both price events are represented.
- Some Google 1.5 pricing was originally communicated across Gemini API and Vertex AI pages with modality/context tiers. The data uses the Gemini API token price where available and records the lower-context text tier.
- `Gemini 2.5 Flash` preview pricing and the subsequent stable-release price update are both represented because the public input/output rates changed before the next Flash release.
- `Gemini 3.5 Flash` is represented for the May 19, 2026 launch. Google announced `Gemini 3.5 Pro` for the following month, but no public API price was available as of the June 8, 2026 update.
- `Claude Opus 4.8` is represented at Anthropic's regular API price. Anthropic also lists fast mode pricing, but this dataset excludes non-standard processing modes.
- `Claude Mythos Preview` is not represented because Anthropic described it as limited to a small number of organizations, without generally available public API pricing as of the June 8, 2026 update.

## Primary Provider Links

- OpenAI API pricing: https://openai.com/api/pricing/
- OpenAI GPT-5 for developers: https://openai.com/index/introducing-gpt-5-for-developers
- OpenAI GPT-5.5: https://openai.com/index/introducing-gpt-5-5/
- Artificial Analysis model leaderboard: https://artificialanalysis.ai/leaderboards/models
- Anthropic Claude model/pricing docs and launch posts: https://docs.anthropic.com/en/docs/about-claude/models/overview
- Anthropic Claude 3 family: https://www.anthropic.com/news/claude-3-family
- Anthropic Claude Opus 4.7: https://www.anthropic.com/news/claude-opus-4-7
- Anthropic Claude Opus 4.8: https://www.anthropic.com/news/claude-opus-4-8
- Anthropic Claude Fable 5: https://www.anthropic.com/news/claude-fable-5-mythos-5
- Google Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Google Gemini 1.5 Flash API price update: https://developers.googleblog.com/en/gemini-15-flash-updates-google-ai-studio-gemini-api/
- Google Gemini 1.5 Flash-8B GA: https://developers.googleblog.com/en/gemini-15-flash-8b-is-now-generally-available-for-use/
- Google Gemini 2.5 Flash pricing update: https://developers.googleblog.com/gemini-2-5-thinking-model-updates/
- Google Gemini 3: https://blog.google/products-and-platforms/products/gemini/gemini-3/
- Google Gemini 3 Flash: https://blog.google/products/gemini/gemini-3-flash/
- Google Gemini 3.1 Flash-Lite: https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-lite
- Google Gemini 3.5: https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/

Full per-point pricing source IDs and URLs are embedded in `data/model-prices.json`. Full per-model Artificial Analysis source URLs are embedded in `data/model-intelligence.json`.
