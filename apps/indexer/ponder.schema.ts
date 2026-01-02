import { onchainTable, text, integer, bigint, boolean, doublePrecision, relations } from "@ponder/core";

export const Market = onchainTable("Market", (t) => ({
    id: t.text().primaryKey(), // Condition ID
    conditionId: t.text().notNull(),
    questionId: t.text(),
    oracle: t.text(),
    outcomeSlotCount: t.integer(),
    title: t.text(),
    collateralToken: t.text(),
    minSplits: t.bigint(),
    // Arrays not directly supported in all adapters, using simple text match or specific array type if available. 
    // Assuming .array() is not available, skipping arrays or using json for simplicity if needed.
    // But Ponder 0.7 usually supports scalar arrays for postgres. 
    // Will try to use .isArray() if it exists or just json. 
    // Exports showed 'json'. Let's use json for arrays to be safe.
    splitFrom: t.json(),
    splitTo: t.json(),
    createdAt: t.bigint().notNull(),
    resolved: t.boolean(),
    payouts: t.json(), // bigint array as json
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
}));

export const UserStats = onchainTable("UserStats", (t) => ({
    id: t.text().primaryKey(), // Wallet Address
    totalVolume: t.bigint().notNull(),
    totalPnL: t.doublePrecision(),
    winRate: t.doublePrecision(),
    tradeCount: t.integer().notNull(),
}));

export const MarketRelations = relations(Market, ({ many }) => ({
    outcomes: many(Outcome),
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
}));
