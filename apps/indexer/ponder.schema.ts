import { onchainTable, relations } from "@ponder/core";

export const Market = onchainTable("Market", (t) => ({
    id: t.text().primaryKey(), // Condition ID
    conditionId: t.text().notNull(),
    questionId: t.text(),
    oracle: t.text(),
    outcomeSlotCount: t.integer(),
    title: t.text(),
    collateralToken: t.text(),
    minSplits: t.bigint(),
    splitFrom: t.json(),
    splitTo: t.json(),
    createdAt: t.bigint().notNull(),
    resolved: t.boolean(),
    payouts: t.json(), // bigint array as json
    // v0.0.4: Resolution metadata
    resolvedAt: t.bigint(),
    winningOutcomeIndex: t.integer(),
}));

export const Outcome = onchainTable("Outcome", (t) => ({
    id: t.text().primaryKey(), // MarketID-Index
    marketId: t.text().notNull(),
    index: t.integer().notNull(),
    name: t.text(),
    probability: t.doublePrecision(),
}));

export const Position = onchainTable("Position", (t) => ({
    id: t.text().primaryKey(), // UserId-OutcomeId
    userId: t.text().notNull(),
    outcomeId: t.text().notNull(),
    shares: t.bigint().notNull(),
    avgPrice: t.doublePrecision(),
    // v0.0.4: Track cost basis for PnL calculation
    costBasis: t.bigint(),
}));

export const UserStats = onchainTable("UserStats", (t) => ({
    id: t.text().primaryKey(), // Wallet Address
    totalVolume: t.bigint().notNull(),
    totalPnL: t.doublePrecision(),
    realizedPnL: t.doublePrecision(), // v0.0.4: Confirmed P&L from redemptions
    winRate: t.doublePrecision(),
    tradeCount: t.integer().notNull(),
    winCount: t.integer().notNull(),  // v0.0.4: Number of profitable redemptions
    lossCount: t.integer().notNull(), // v0.0.4: Number of unprofitable redemptions
}));

// v0.0.4: New Trade table for tracking individual trades
export const Trade = onchainTable("Trade", (t) => ({
    id: t.text().primaryKey(),           // txHash-logIndex
    userId: t.text().notNull(),
    marketId: t.text().notNull(),
    outcomeIndex: t.integer().notNull(),
    type: t.text().notNull(),            // "SPLIT" | "MERGE" | "REDEMPTION"
    shares: t.bigint().notNull(),
    collateralAmount: t.bigint().notNull(),
    pricePerShare: t.doublePrecision(),  // collateralAmount / shares
    pnl: t.doublePrecision(),            // Only populated for REDEMPTION type
    timestamp: t.bigint().notNull(),
}));

export const MarketRelations = relations(Market, ({ many }) => ({
    outcomes: many(Outcome),
    trades: many(Trade),
}));

export const OutcomeRelations = relations(Outcome, ({ one, many }) => ({
    market: one(Market, { fields: [Outcome.marketId], references: [Market.id] }),
    positions: many(Position),
}));

export const PositionRelations = relations(Position, ({ one }) => ({
    user: one(UserStats, { fields: [Position.userId], references: [UserStats.id] }),
    outcome: one(Outcome, { fields: [Position.outcomeId], references: [Outcome.id] }),
}));

export const UserStatsRelations = relations(UserStats, ({ many }) => ({
    positions: many(Position),
    trades: many(Trade),
}));

export const TradeRelations = relations(Trade, ({ one }) => ({
    user: one(UserStats, { fields: [Trade.userId], references: [UserStats.id] }),
    market: one(Market, { fields: [Trade.marketId], references: [Market.id] }),
}));
