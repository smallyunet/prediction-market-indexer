# Getting Started

## Installation

```bash
git clone https://github.com/smallyu/prediction-market-indexer.git
cd prediction-market-indexer
./init.sh
```

## Running Locally

```bash
docker-compose up -d
pnpm dev
```

## v0.0.6 API Examples

### Price Chart (derived)

```bash
curl "http://localhost:3000/markets/<MARKET_ID>/prices?interval=hour&limit=200"
curl "http://localhost:3000/markets/<MARKET_ID>/prices?outcomeIndex=1&interval=day&from=2026-01-01"
```

### Market Depth (derived)

```bash
curl "http://localhost:3000/markets/<MARKET_ID>/depth"
```

### Liquidity Providers (derived)

```bash
curl "http://localhost:3000/markets/<MARKET_ID>/liquidity-providers?limit=50&page=1"
```

### WebSocket (periodic realtime updates)

Connect with a market filter:

```bash
websocat "ws://localhost:3000/ws?marketId=<MARKET_ID>"
```

Or subscribe after connecting:

```json
{ "type": "subscribe", "marketId": "<MARKET_ID>" }
```
