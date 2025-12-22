# Roadmap

## v0.0.1 - Skeleton (Completed)
- [x] Initial TurboRepo setup
- [x] Ponder schema design
- [x] Basic Hono API structure
- [x] Documentation site skeleton

## v0.0.2 - Basic Market Indexing (Current)
- [ ] **Indexer**: Complete `CtfExchange` ABI (add `ConditionResolution`).
- [ ] **Indexer**: Handle `ConditionPreparation` event to index Markets.
- [ ] **API**: Endpoint `GET /markets` to list available markets.
- [ ] **Docs**: Create `README.md` and "Getting Started" guide.

## v0.0.3 - Trading Activity
- [ ] **Indexer**: Handle `PositionSplit` and `PositionMerge` events.
- [ ] **Indexer**: Track `UserStats` (Interaction count).
- [ ] **API**: Endpoint `GET /users/:id` to fetch user activity.

## v0.0.4 - Performance Analytics
- [ ] **Indexer**: Calculate PnL and WinRate based on `PayoutRedemption`.
- [ ] **Indexer**: Market resolution logic.
- [ ] **API**: Advanced filtering and sorting for markets.
