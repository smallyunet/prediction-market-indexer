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
    details: Powered by Ponder for type-safe, high-speed EVM data indexing.
  - title: SQL Analytics
    details: Query your data with standard SQL via PostgreSQL. No GraphQL limit.
  - title: REST API
    details: Zero-config Hono API ready to serve rich analytics to your frontend.
---

# Overview

This project provides a robust backend infrastructure for Prediction Market applications.

## Key Features

- **Multi-Chain Support**: Configured for Polygon Mainnet (CTF Exchange).
- **Core Models**: Markets, Positions, Outcomes, UserStats.
- **Dockerized**: Ready to deploy with `docker-compose`.
