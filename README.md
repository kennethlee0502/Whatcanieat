# Can / I Eat This?

A mobile-first food decision-support application for selected dietary
restrictions. The application is built with Next.js, React, TypeScript, Zod,
and a deterministic rule engine.

## Setup

Use Node.js 20.19 or later.

```bash
npm install
npm run dev
```

The local application is available at `http://localhost:3000`.

## Environment variables

Copy `.env.example` to `.env.local` and provide:

```text
OPENAI_API_KEY=
```

Do not commit `.env.local` or print the key. Unit and integration tests use
deterministic mocks and do not require a real API key or make paid provider
requests.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

## Routes

- `/` — product introduction
- `/app` — temporary profile, image capture, analysis, result, clarification,
  and Clear All flow
- `/privacy` — current data handling and privacy boundaries
- `/build` — current extraction and deterministic evaluation architecture
- `/api/analyze` — non-cacheable server analysis endpoint

## Deployment

The application targets Vercel. Configure `OPENAI_API_KEY` as a server runtime
environment variable, create a preview deployment, and verify every public
route plus representative analysis success and error behavior. Deployment
success depends on valid Vercel access, project configuration, and runtime
secrets.

## Privacy boundaries

- The MVP has no account, database, or scan history.
- Only the validated profile is stored in browser `sessionStorage`.
- Images, object URLs, extracted facts, results, and clarification state remain
  in browser memory and are not persisted.
- Analysis sends the prepared food image and minimized relevant restriction
  context to the server and OpenAI.
- Height, weight, and locally calculated BMI are not transmitted for analysis.
- The application does not intentionally log images, profiles, prompts,
  provider responses, extracted facts, or verdicts.
- Clear All removes the stored session profile, resets in-memory application
  data, aborts active work, and releases temporary image resources.

## Current limitations

- The product supports pregnancy, food allergies, high blood pressure,
  vegetarian, and vegan profiles only.
- A food image cannot establish every hidden ingredient or preparation detail.
- Provider, network, and image-quality limitations can prevent or reduce an
  analysis.
- As of 2026-07-23, `npm audit` reports three high-severity transitive findings
  in the PostCSS and Sharp versions bundled through Next.js. npm proposes only
  a forced breaking downgrade to Next.js 9.3.3, so no automatic fix is applied.
- Results are decision support, not medical advice, diagnosis, or a guarantee
  that a food is safe.
- The product is not HIPAA compliant.
