import { createSchema } from "@ponder/core";

export default createSchema((p) => ({
    Market: p.createTable({
        id: p.string(), // Question ID
        conditionId: p.string(),
        title: p.string().optional(),
        collateralToken: p.string(),
        minSplits: p.bigint().optional(),
        splitFrom: p.string().array().optional(),
        splitTo: p.string().array().optional(),
        createdAt: p.bigint(),
        resolved: p.boolean(),
        payouts: p.bigint().array().optional(),
    }),

    Outcome: p.createTable({
        id: p.string(), // MarketID-Index
        marketId: p.string().references("Market.id"),
        index: p.int(),
        name: p.string().optional(), // Yes/No
        probability: p.float(),
    }),

    Position: p.createTable({
        id: p.string(), // UserId-OutcomeId
        userId: p.string().references("UserStats.id"),
        outcomeId: p.string().references("Outcome.id"),
        shares: p.bigint(),
        avgPrice: p.float().optional(),
    }),

    UserStats: p.createTable({
        id: p.string(), // Wallet Address
        totalVolume: p.bigint(),
        totalPnL: p.float().optional(),
        winRate: p.float().optional(),
        tradeCount: p.int(),
    }),
}));
