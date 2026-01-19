---
layout: home

hero:
  name: "Prediction Market Indexer"
  text: "High-Performance Analytics for Gnosis CTF & Polymarket"
  tagline: "Alternative to Subgraph. Built with Ponder & Hono."
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/smallyu/prediction-market-indexer

features:
  - title: Fast Indexing
    details: Powered by Ponder for type-safe, high-speed EVM data indexing using optimized RPC calls.
  - title: SQL Analytics
    details: Query your data with standard SQL via PostgreSQL. No GraphQL limitations.
  - title: REST API
    details: Zero-config Hono API ready to serve rich analytics to your frontend.
  - title: OpenAPI Docs
    details: Interactive API documentation with Swagger UI at /docs endpoint.
---

# Overview

This project provides a robust backend infrastructure for Prediction Market applications, indexing the Gnosis Conditional Tokens Framework (CTF).

## Key Features

- **Multi-Chain Support**: Configured for Polygon Mainnet.
- **Core Models**: Markets, Outcomes, Positions, UserStats.
- **Dockerized**: Ready to deploy with `docker-compose`.

## Quick Start

### 1. Installation

```bash
pnpm install
```

### 2. Start Database

```bash
docker-compose up -d
```

### 3. Run Services

```bash
# Terminal 1: Indexer
cd apps/indexer && pnpm dev

# Terminal 2: API
cd apps/api && pnpm dev
```

Visit `http://localhost:3000/markets` to see the API in action.
