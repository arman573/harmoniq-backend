# HARMONIQ Customer Core

AI-native Beauty Commerce Intelligence Platform.

HARMONIQ Customer Core is the customer intelligence foundation for beauty commerce. It is designed to unify customer support, customer profiles, product intelligence, recommendations, CRM signals, and explainable AI-assisted workflows.

## Core Principle

```text
AI interprets.
Backend decides.
Backend explains.
Backend estimates confidence.
```

OpenAI is used for interpretation, extraction, classification, and semantic understanding.

The backend owns deterministic business logic:

- scoring
- blockers
- recommendation decisions
- risk logic
- confidence estimation
- evidence handling
- explainability
- customer profile logic

## Current Product Direction

HARMONIQ is moving toward a unified customer intelligence platform for beauty brands, combining:

- customer support
- beauty advisory
- product recommendations
- CRM intelligence
- personalization
- automation signals
- explainability

## Tech Stack

- NestJS
- PostgreSQL
- TypeORM
- JWT/Auth
- Jest

## Development

```bash
npm install
npm run start:dev
```

## Build

```bash
npm run build
```

## Tests

```bash
npm test -- --runInBand
```

## Notes

This repository was renamed from `harmoniq-backend` to `harmoniq-customer-core` to better reflect the platform direction.
