import { ponder } from "@/generated";
import { eq, and } from "@ponder/core";
import { Market, Outcome, Position, UserStats, Trade } from "../ponder.schema";

// Helper to get or create user stats
async function getOrCreateUser(context: any, userId: string) {
    let user = await context.db.query.UserStats.findFirst({
        where: eq(UserStats.id, userId)
    });

    if (!user) {
        await context.db.insert(UserStats).values({
            id: userId,
            totalVolume: 0n,
            tradeCount: 0,
            totalPnL: 0,
            realizedPnL: 0,
            winRate: 0,
            winCount: 0,
            lossCount: 0,
        });
        user = {
            id: userId,
            totalVolume: 0n,
            tradeCount: 0,
            totalPnL: 0,
            realizedPnL: 0,
            winRate: 0,
            winCount: 0,
            lossCount: 0,
        };
    }
    return user;
}

// Helper to calculate win rate
function calculateWinRate(winCount: number, lossCount: number): number {
    const total = winCount + lossCount;
    if (total === 0) return 0;
    return winCount / total;
}

ponder.on("CtfExchange:ConditionPreparation", async ({ event, context }) => {
    const { conditionId, oracle, questionId, outcomeSlotCount } = event.args;

    // Create the Market (Condition)
    await context.db.insert(Market).values({
        id: conditionId,
        conditionId: conditionId,
        questionId: questionId,
        oracle: oracle,
        outcomeSlotCount: Number(outcomeSlotCount),
        createdAt: event.block.timestamp,
        resolved: false,
        splitFrom: [],
        splitTo: [],
        resolvedAt: null,
        winningOutcomeIndex: null,
    });

    // Create Outcomes
    const count = Number(outcomeSlotCount);
    for (let i = 0; i < count; i++) {
        await context.db.insert(Outcome).values({
            id: `${conditionId}-${i}`,
            marketId: conditionId,
            index: i,
            name: i === 0 ? "No" : i === 1 ? "Yes" : `Outcome ${i}`,
            probability: 0.5,
        });
    }
});

ponder.on("CtfExchange:PositionSplit", async ({ event, context }) => {
    const { stakeholder, collateralToken, conditionId, partition, amount } = event.args;

    // Check Market collateral
    const market = await context.db.query.Market.findFirst({
        where: eq(Market.id, conditionId)
    });

    if (market && !market.collateralToken) {
        await context.db.update(Market)
            .set({ collateralToken: collateralToken })
            .where(eq(Market.id, conditionId));
    }

    // Get or create user
    const user = await getOrCreateUser(context, stakeholder);

    // Increment stats
    await context.db.update(UserStats)
        .set({
            totalVolume: user.totalVolume + amount,
            tradeCount: user.tradeCount + 1,
        })
        .where(eq(UserStats.id, stakeholder));

    // Create/Update Positions and record Trades
    for (const indexSet of partition) {
        const val = Number(indexSet);
        const index = Math.log2(val);

        if (Number.isInteger(index)) {
            const positionId = `${stakeholder}-${conditionId}-${index}`;
            const existing = await context.db.query.Position.findFirst({
                where: eq(Position.id, positionId)
            });

            // Calculate price per share (collateral per share)
            const sharesCount = partition.length;
            const perOutcomeAmount = amount / BigInt(sharesCount);
            const pricePerShare = Number(amount) / Number(perOutcomeAmount) / sharesCount;

            if (existing) {
                // Update position and accumulate cost basis
                const newShares = existing.shares + perOutcomeAmount;
                const newCostBasis = (existing.costBasis || 0n) + perOutcomeAmount;
                await context.db.update(Position)
                    .set({
                        shares: newShares,
                        costBasis: newCostBasis,
                    })
                    .where(eq(Position.id, positionId));
            } else {
                await context.db.insert(Position).values({
                    id: positionId,
                    userId: stakeholder,
                    outcomeId: `${conditionId}-${index}`,
                    shares: perOutcomeAmount,
                    costBasis: perOutcomeAmount,
                });
            }

            // Record the trade
            const tradeId = `${event.transaction.hash}-${event.log.logIndex}-${index}`;
            await context.db.insert(Trade).values({
                id: tradeId,
                userId: stakeholder,
                marketId: conditionId,
                outcomeIndex: index,
                type: "SPLIT",
                shares: perOutcomeAmount,
                collateralAmount: perOutcomeAmount,
                pricePerShare: pricePerShare,
                pnl: null,
                timestamp: event.block.timestamp,
            });
        }
    }
});

ponder.on("CtfExchange:PositionMerge", async ({ event, context }) => {
    const { stakeholder, conditionId, partition, amount } = event.args;

    // Get or create user
    const user = await getOrCreateUser(context, stakeholder);

    // Update Trade Count
    await context.db.update(UserStats)
        .set({ tradeCount: user.tradeCount + 1 })
        .where(eq(UserStats.id, stakeholder));

    for (const indexSet of partition) {
        const val = Number(indexSet);
        const index = Math.log2(val);
        if (Number.isInteger(index)) {
            const positionId = `${stakeholder}-${conditionId}-${index}`;
            const existing = await context.db.query.Position.findFirst({
                where: eq(Position.id, positionId)
            });

            const sharesCount = partition.length;
            const perOutcomeAmount = amount / BigInt(sharesCount);

            if (existing) {
                const newShares = existing.shares - perOutcomeAmount;
                const newCostBasis = Math.max(0, Number((existing.costBasis || 0n) - perOutcomeAmount));
                await context.db.update(Position)
                    .set({
                        shares: newShares,
                        costBasis: BigInt(Math.floor(newCostBasis)),
                    })
                    .where(eq(Position.id, positionId));
            }

            // Record the trade
            const tradeId = `${event.transaction.hash}-${event.log.logIndex}-${index}`;
            await context.db.insert(Trade).values({
                id: tradeId,
                userId: stakeholder,
                marketId: conditionId,
                outcomeIndex: index,
                type: "MERGE",
                shares: perOutcomeAmount,
                collateralAmount: perOutcomeAmount,
                pricePerShare: 1.0, // Merge is 1:1
                pnl: null,
                timestamp: event.block.timestamp,
            });
        }
    }
});

ponder.on("CtfExchange:ConditionResolution", async ({ event, context }) => {
    const { conditionId, payoutNumerators } = event.args;

    // payoutNumerators is bigint[] - convert to strings for JSON storage
    const payoutsJson = payoutNumerators.map(n => n.toString());

    // Determine winning outcome (first non-zero payout)
    let winningOutcomeIndex: number | null = null;
    for (let i = 0; i < payoutNumerators.length; i++) {
        if (payoutNumerators[i] > 0n) {
            winningOutcomeIndex = i;
            break;
        }
    }

    // Update market with resolution data
    await context.db.update(Market)
        .set({
            resolved: true,
            payouts: payoutsJson,
            resolvedAt: event.block.timestamp,
            winningOutcomeIndex: winningOutcomeIndex,
        })
        .where(eq(Market.id, conditionId));

    // Update outcome probabilities based on resolution
    for (let i = 0; i < payoutNumerators.length; i++) {
        const outcomeId = `${conditionId}-${i}`;
        const probability = payoutNumerators[i] > 0n ? 1.0 : 0.0;
        await context.db.update(Outcome)
            .set({ probability: probability })
            .where(eq(Outcome.id, outcomeId));
    }
});

ponder.on("CtfExchange:PayoutRedemption", async ({ event, context }) => {
    const { redeemer, conditionId, indexSets, payout } = event.args;

    const user = await getOrCreateUser(context, redeemer);

    // Calculate PnL: payout received vs cost basis invested
    let totalCostBasis = 0n;

    // Look up the user's positions for this market
    for (const indexSet of indexSets) {
        const val = Number(indexSet);
        const index = Math.log2(val);
        if (Number.isInteger(index)) {
            const positionId = `${redeemer}-${conditionId}-${index}`;
            const position = await context.db.query.Position.findFirst({
                where: eq(Position.id, positionId)
            });

            if (position && position.costBasis) {
                totalCostBasis += position.costBasis;
            }

            // Clear the position after redemption
            if (position) {
                await context.db.update(Position)
                    .set({ shares: 0n, costBasis: 0n })
                    .where(eq(Position.id, positionId));
            }
        }
    }

    // Calculate realized PnL
    const payoutValue = Number(payout);
    const costValue = Number(totalCostBasis);
    const realizedPnL = payoutValue - costValue;
    const isWin = realizedPnL > 0;

    // Update user stats
    const newWinCount = user.winCount + (isWin ? 1 : 0);
    const newLossCount = user.lossCount + (isWin ? 0 : 1);
    const newWinRate = calculateWinRate(newWinCount, newLossCount);
    const newRealizedPnL = (user.realizedPnL || 0) + realizedPnL;

    await context.db.update(UserStats)
        .set({
            totalPnL: (user.totalPnL || 0) + payoutValue,
            realizedPnL: newRealizedPnL,
            tradeCount: user.tradeCount + 1,
            winCount: newWinCount,
            lossCount: newLossCount,
            winRate: newWinRate,
        })
        .where(eq(UserStats.id, redeemer));

    // Record the redemption trade
    const tradeId = `${event.transaction.hash}-${event.log.logIndex}`;
    await context.db.insert(Trade).values({
        id: tradeId,
        userId: redeemer,
        marketId: conditionId,
        outcomeIndex: -1, // Redemption covers all outcomes
        type: "REDEMPTION",
        shares: 0n, // N/A for redemption
        collateralAmount: payout,
        pricePerShare: null,
        pnl: realizedPnL,
        timestamp: event.block.timestamp,
    });
});
