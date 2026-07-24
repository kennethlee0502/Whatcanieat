# Can / I Eat This?

A mobile-first food decision-support application that helps people with dietary restrictions make safer food decisions from a single photo.

The application combines LLM-based visual understanding with a deterministic rule engine to produce transparent, explainable recommendations. It is built with Next.js, React, TypeScript, Zod, and OpenAI.

---

## Why I Built This

I'm about to become a first-time dad.

When my wife became pregnant, I noticed that almost every meal turned into the same routine: she would take a photo of her food and ask ChatGPT, "Can I eat this?"

Sometimes the answer was helpful. Other times, important context—like the fact that she was pregnant—wasn't consistently reflected in the conversation. More importantly, the reasoning behind the recommendation wasn't always transparent.

That experience made me realize there was an opportunity for a different kind of product.

Instead of relying on a general-purpose conversation, I wanted an application that permanently understands a user's dietary profile, analyzes the food in front of them, and applies deterministic rules to produce explainable recommendations.

Pregnancy was the original motivation, but the same idea naturally extends to food allergies, vegetarian and vegan diets, high blood pressure, diabetes, kidney disease, and personalized nutrition.

This is a product I genuinely expect my own family to use.

---

## Working Slice

The current MVP supports one complete end-to-end workflow.

A user can:

- Select one or more dietary restrictions
- Upload or capture a food image
- Extract structured observations from the image using an LLM
- Evaluate those observations using deterministic dietary rules
- Receive an explainable recommendation
- Answer clarification questions when additional information could improve the recommendation

The application is fully deployed and functional today.

---

## Product Philosophy

One of the core design decisions was separating **perception** from **decision making**.

The LLM is responsible only for understanding what is visible in the image and converting it into structured observations.

The recommendation itself is produced entirely by a deterministic rule engine.

Rather than asking an LLM:

> "Can I eat this?"

the application asks:

> "What do you see?"

The deterministic rule engine then answers:

> "Based on the user's dietary profile, should they eat it?"

This makes every recommendation:

- explainable
- reproducible
- testable
- independent of provider wording

---

## Why Mobile First

This was intentionally designed as a mobile-first web application.

People don't decide whether they can eat something while sitting in front of a desktop computer. They make that decision in restaurants, grocery stores, cafeterias, or at the dinner table.

Taking a photo and getting an answer within a few seconds felt like the natural experience.

I also believe more and more people experience software primarily through their phones. Designing for mobile first wasn't just a UI decision—it was a product decision.

## Architecture

Current architecture:

```text
Food Image
      │
      ▼
OpenAI Vision
(Structured Extraction)
      │
      ▼
Validation (Zod)
      │
      ▼
Deterministic Rule Engine
      │
      ▼
Recommendation
      │
      ▼
Explanation + Provenance
```

The system intentionally separates AI extraction from deterministic evaluation.

LLMs generate observations.

Rules generate recommendations.

---

## Setup

Use Node.js 20.19 or later.

```bash
npm install
npm run dev
```

The local application is available at:

```
http://localhost:3000
```

---

## Environment Variables

Copy `.env.example` to `.env.local`.

```
OPENAI_API_KEY=
```

Do not commit `.env.local`.

Tests use deterministic mocks and do not require a real API key.

---

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

---

## Routes

| Route          | Description           |
| -------------- | --------------------- |
| `/`            | Landing page          |
| `/app`         | Main application      |
| `/privacy`     | Privacy boundaries    |
| `/build`       | Architecture overview |
| `/api/analyze` | Analysis endpoint     |

---

## Privacy

The MVP intentionally stores almost nothing.

- No accounts
- No database
- No scan history
- Images remain in browser memory only
- Only the user's dietary profile is stored in `sessionStorage`
- Images and extracted facts are never intentionally persisted
- Height, weight, and BMI are never sent to the AI provider
- Clear All removes every locally stored state

---

## Current Limitations

Current supported dietary profiles:

- Pregnancy
- Food Allergies
- High Blood Pressure
- Vegetarian
- Vegan

Known limitations:

- Hidden ingredients cannot always be inferred from a single image.
- Image quality affects extraction accuracy.
- Network or provider failures can interrupt analysis.
- Results are decision support—not medical advice.
- The application is not HIPAA compliant.
- As of 2026-07-23, `npm audit` reports three high-severity transitive findings in PostCSS and Sharp through Next.js. The only automatic fix requires downgrading to Next.js 9, so no automatic remediation has been applied.

---

## What I Learned

Building this product changed how I think about AI decision making.

The first version optimized for certainty.

After using it myself, I realized that certainty was the wrong optimization target.

For example, if the application clearly detects raw salmon for a pregnancy profile, asking additional questions about the rice or sauce doesn't improve the recommendation.

The better optimization target is **decision value**.

The application should only ask additional questions when the answer could realistically change the recommendation.

That insight became the foundation for the next milestone of the project: **Evidence-Driven Decision Making**, which redesigns clarification around decision value rather than descriptive completeness.

---

## Future Vision

I believe this product can evolve into a personalized dietary decision platform rather than simply an AI food scanner.

Some directions I'm interested in exploring include:

- Persistent health profiles across devices
- Integration with electronic health records (EHR)
- Physician-approved dietary restrictions
- Personalized calorie and nutrition tracking
- Diabetes and kidney disease support
- Family profiles for children and elderly caregivers
- Integration with Apple Health and wearable devices

My long-term goal isn't to replace doctors or dietitians.

It's to reduce everyday decision fatigue by giving people trustworthy, transparent, evidence-based dietary guidance that fits their own health profile.

---

## Repository

This repository contains the complete source code, deterministic rule engine, documentation, and architecture used by the application.
