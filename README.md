# Prediction Market Indexer

A high-performance, type-safe indexer for Gnosis Conditional Tokens Framework (CTF) and Polymarket contracts. Built with [Ponder](https://ponder.sh/) and [Hono](https://hono.dev/).

## Features

- **Blazing Fast Indexing**: Uses Ponder's parallelized historical sync and hot-reloading architecture.
- **Type-Safe**: End-to-end TypeScript support from contract events to API responses.
- **SQL-Ready**: Data is indexed into standard PostgreSQL tables, making it accessible for complex analytics (no more GraphQL-only limitations).
- **Modern API**: Hono-based REST API for easy integration with frontends.

## Architecture

This is a monorepo managed by [TurboRepo](https://turbo.build/):

- **`apps/indexer`**: The Ponder indexing service. Listens to blockchain events and writes to the DB.
- **`apps/api`**: A Hono REST API service that reads from the indexed database and serves JSON to clients.
- **`packages/*`**: Shared configurations and utilities.

## Quick Start

### Prerequisites

- Node.js > 18
- pnpm
- Docker & Docker Compose

### Development

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Start the database**
   ```bash
   docker-compose up -d
   ```

3. **Start the indexer** (in one terminal)
   ```bash
   cd apps/indexer
   pnpm dev
   ```

4. **Start the API** (in another terminal)
   ```bash
   cd apps/api
   pnpm dev
   ```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for current progress and future plans.
