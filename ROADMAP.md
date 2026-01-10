# Roadmap

## v0.0.1 - Skeleton (Completed)
- [x] Initial TurboRepo setup
- [x] Ponder schema design
- [x] Basic Hono API structure
- [x] Documentation site skeleton

## v0.0.2 - Basic Market Indexing (Completed)
- [x] **Indexer**: Complete `CtfExchange` ABI (add `ConditionResolution`).
- [x] **Indexer**: Handle `ConditionPreparation` event to index Markets.
- [x] **API**: Endpoint `GET /markets` to list available markets.
- [x] **Docs**: Create `README.md` and "Getting Started" guide.

## v0.0.3 - Trading Activity (Completed)
- [x] **Indexer**: Handle `PositionSplit` and `PositionMerge` events.
- [x] **Indexer**: Track `UserStats` (Interaction count).
- [x] **API**: Endpoint `GET /users/:id` to fetch user activity.

## v0.0.4 - Performance Analytics (Completed)
- [x] **Indexer**: Calculate PnL and WinRate based on `PayoutRedemption`.
- [x] **Indexer**: Market resolution logic (winningOutcomeIndex, resolvedAt).
- [x] **Indexer**: New `Trade` table for individual trade tracking.
- [x] **API**: Advanced filtering and sorting for markets (status, sortBy, order).
- [x] **API**: Pagination support (page, limit).
- [x] **API**: New `GET /markets/:id` endpoint for single market details.

## v0.0.5 - Enhanced Analytics (Next)
- [ ] **Indexer**: Track market volume and liquidity metrics.
- [ ] **API**: Leaderboard endpoint for top traders by PnL/WinRate.
- [ ] **API**: Market statistics aggregation (daily/weekly volumes).
- [ ] **Docs**: API documentation with OpenAPI/Swagger.

