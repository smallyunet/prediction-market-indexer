import { ponder } from "@/generated";
import { eq } from "@ponder/core";
import { Market, Outcome, Position, UserStats, Trade } from "../../ponder.schema";
import { parseBigintJsonArray, bigintArrayToJson } from "../lib/bigintJson";
import { upsertLiquidityProvider, recordDepthAndPrices } from "../services/derivedMetrics";
import { getOrCreateUser, calculateWinRate } from "../services/userStats";

ponder.on("CtfExchange:ConditionPreparation", async (args: any) => {
    const { event, context } = args;
    const { conditionId, oracle, questionId, outcomeSlotCount } = event.args;

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
        totalVolume: 0n,
        tradeCount: 0,
        openInterest: 0n,
        openInterestByOutcome: Array.from({ length: Number(outcomeSlotCount) }, () => "0"),
    });

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

ponder.on("CtfExchange:PositionSplit", async (args: any) => {
    const { event, context } = args;
    const { stakeholder, collateralToken, conditionId, partition, amount } = event.args;

    const market = await context.db.query.Market.findFirst({
        where: eq(Market.id, conditionId),
    });

    if (market) {
        const outcomeCount = market.outcomeSlotCount || partition.length;
        const existingSharesByOutcome = parseBigintJsonArray(market.openInterestByOutcome, outcomeCount);

        const sharesCount = partition.length;
        const perOutcomeAmount = amount / BigInt(sharesCount);
        for (const indexSet of partition) {
            const val = Number(indexSet);
            const index = Math.log2(val);
            if (Number.isInteger(index) && index >= 0 && index < outcomeCount) {
                existingSharesByOutcome[index] = (existingSharesByOutcome[index] || 0n) + perOutcomeAmount;
            }
        }

        await context.db
            .update(Market)
            .set({
                collateralToken: market.collateralToken || collateralToken,
                totalVolume: (market.totalVolume || 0n) + amount,
                tradeCount: (market.tradeCount || 0) + partition.length,
                openInterest: (market.openInterest || 0n) + amount,
                openInterestByOutcome: bigintArrayToJson(existingSharesByOutcome),
            })
            .where(eq(Market.id, conditionId));

        await upsertLiquidityProvider(context, conditionId, stakeholder, amount, 0n, event.block.timestamp);
        await recordDepthAndPrices(
            context,
            conditionId,
            outcomeCount,
            existingSharesByOutcome,
            event.block.timestamp,
            event.transaction.hash,
            event.log.logIndex,
        );
    }

    const user = await getOrCreateUser(context, stakeholder);

    await context.db
        .update(UserStats)
        .set({
            totalVolume: user.totalVolume + amount,
            tradeCount: user.tradeCount + 1,
        })
        .where(eq(UserStats.id, stakeholder));

    for (const indexSet of partition) {
        const val = Number(indexSet);
        const index = Math.log2(val);

        if (Number.isInteger(index)) {
            const positionId = `${stakeholder}-${conditionId}-${index}`;
            const existing = await context.db.query.Position.findFirst({
                where: eq(Position.id, positionId),
            });

            const sharesCount = partition.length;
            const perOutcomeAmount = amount / BigInt(sharesCount);
            const pricePerShare = Number(amount) / Number(perOutcomeAmount) / sharesCount;

            if (existing) {
                const newShares = existing.shares + perOutcomeAmount;
                const newCostBasis = (existing.costBasis || 0n) + perOutcomeAmount;
                await context.db
                    .update(Position)
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

ponder.on("CtfExchange:PositionMerge", async (args: any) => {
    const { event, context } = args;
    const { stakeholder, conditionId, partition, amount } = event.args;

    const user = await getOrCreateUser(context, stakeholder);

    await context.db
        .update(UserStats)
        .set({ tradeCount: user.tradeCount + 1 })
        .where(eq(UserStats.id, stakeholder));

    const market = await context.db.query.Market.findFirst({
        where: eq(Market.id, conditionId),
    });

    if (market) {
        const outcomeCount = market.outcomeSlotCount || partition.length;
        const existingSharesByOutcome = parseBigintJsonArray(market.openInterestByOutcome, outcomeCount);

        const sharesCount = partition.length;
        const perOutcomeAmount = amount / BigInt(sharesCount);
        for (const indexSet of partition) {
            const val = Number(indexSet);
            const index = Math.log2(val);
            if (Number.isInteger(index) && index >= 0 && index < outcomeCount) {
                const next = (existingSharesByOutcome[index] || 0n) - perOutcomeAmount;
                existingSharesByOutcome[index] = next > 0n ? next : 0n;
            }
        }

        await context.db
            .update(Market)
            .set({
                totalVolume: (market.totalVolume || 0n) + amount,
                tradeCount: (market.tradeCount || 0) + partition.length,
                openInterest: (() => {
                    const next = (market.openInterest || 0n) - amount;
                    return next > 0n ? next : 0n;
                })(),
                openInterestByOutcome: bigintArrayToJson(existingSharesByOutcome),
            })
            .where(eq(Market.id, conditionId));

        await upsertLiquidityProvider(context, conditionId, stakeholder, 0n, amount, event.block.timestamp);
        await recordDepthAndPrices(
            context,
            conditionId,
            outcomeCount,
            existingSharesByOutcome,
            event.block.timestamp,
            event.transaction.hash,
            event.log.logIndex,
        );
    }

    for (const indexSet of partition) {
        const val = Number(indexSet);
        const index = Math.log2(val);
        if (Number.isInteger(index)) {
            const positionId = `${stakeholder}-${conditionId}-${index}`;
            const existing = await context.db.query.Position.findFirst({
                where: eq(Position.id, positionId),
            });

            const sharesCount = partition.length;
            const perOutcomeAmount = amount / BigInt(sharesCount);

            if (existing) {
                const newShares = existing.shares - perOutcomeAmount;
                const nextCostBasis = (existing.costBasis || 0n) - perOutcomeAmount;
                await context.db
                    .update(Position)
                    .set({
                        shares: newShares,
                        costBasis: nextCostBasis > 0n ? nextCostBasis : 0n,
                    })
                    .where(eq(Position.id, positionId));
            }

            const tradeId = `${event.transaction.hash}-${event.log.logIndex}-${index}`;
            await context.db.insert(Trade).values({
                id: tradeId,
                userId: stakeholder,
                marketId: conditionId,
                outcomeIndex: index,
                type: "MERGE",
                shares: perOutcomeAmount,
                collateralAmount: perOutcomeAmount,
                pricePerShare: 1.0,
                pnl: null,
                timestamp: event.block.timestamp,
            });
        }
    }
});

ponder.on("CtfExchange:ConditionResolution", async (args: any) => {
    const { event, context } = args;
    const { conditionId, payoutNumerators } = event.args;

    const payoutsJson = payoutNumerators.map((n: bigint) => n.toString());

    let winningOutcomeIndex: number | null = null;
    for (let i = 0; i < payoutNumerators.length; i++) {
        if (payoutNumerators[i] > 0n) {
            winningOutcomeIndex = i;
            break;
        }
    }

    await context.db
        .update(Market)
        .set({
            resolved: true,
            payouts: payoutsJson,
            resolvedAt: event.block.timestamp,
            winningOutcomeIndex: winningOutcomeIndex,
        })
        .where(eq(Market.id, conditionId));

    for (let i = 0; i < payoutNumerators.length; i++) {
        const outcomeId = `${conditionId}-${i}`;
        const probability = payoutNumerators[i] > 0n ? 1.0 : 0.0;
        await context.db.update(Outcome).set({ probability: probability }).where(eq(Outcome.id, outcomeId));
    }
});

ponder.on("CtfExchange:PayoutRedemption", async (args: any) => {
    const { event, context } = args;
    const { redeemer, conditionId, indexSets, payout } = event.args;

    const user = await getOrCreateUser(context, redeemer);

    let totalCostBasis = 0n;

    const market = await context.db.query.Market.findFirst({
        where: eq(Market.id, conditionId),
    });

    const outcomeCount = market?.outcomeSlotCount || indexSets.length || 2;
    const sharesByOutcome = parseBigintJsonArray(market?.openInterestByOutcome, outcomeCount);
    let totalSharesDelta = 0n;

    for (const indexSet of indexSets) {
        const val = Number(indexSet);
        const index = Math.log2(val);
        if (Number.isInteger(index)) {
            const positionId = `${redeemer}-${conditionId}-${index}`;
            const position = await context.db.query.Position.findFirst({
                where: eq(Position.id, positionId),
            });

            if (position && position.costBasis) {
                totalCostBasis += position.costBasis;
            }

            if (position && position.shares) {
                totalSharesDelta += position.shares;
                const next = (sharesByOutcome[index] || 0n) - position.shares;
                sharesByOutcome[index] = next > 0n ? next : 0n;
            }

            if (position) {
                await context.db
                    .update(Position)
                    .set({ shares: 0n, costBasis: 0n })
                    .where(eq(Position.id, positionId));
            }
        }
    }

    if (market) {
        const nextOpenInterest = (market.openInterest || 0n) - totalSharesDelta;
        await context.db
            .update(Market)
            .set({
                openInterest: nextOpenInterest > 0n ? nextOpenInterest : 0n,
                openInterestByOutcome: bigintArrayToJson(sharesByOutcome),
            })
            .where(eq(Market.id, conditionId));

        await recordDepthAndPrices(
            context,
            conditionId,
            outcomeCount,
            sharesByOutcome,
            event.block.timestamp,
            event.transaction.hash,
            event.log.logIndex,
        );
    }

    const payoutValue = Number(payout);
    const costValue = Number(totalCostBasis);
    const realizedPnL = payoutValue - costValue;
    const isWin = realizedPnL > 0;

    const newWinCount = user.winCount + (isWin ? 1 : 0);
    const newLossCount = user.lossCount + (isWin ? 0 : 1);
    const newWinRate = calculateWinRate(newWinCount, newLossCount);
    const newRealizedPnL = (user.realizedPnL || 0) + realizedPnL;

    await context.db
        .update(UserStats)
        .set({
            totalPnL: (user.totalPnL || 0) + payoutValue,
            realizedPnL: newRealizedPnL,
            tradeCount: user.tradeCount + 1,
            winCount: newWinCount,
            lossCount: newLossCount,
            winRate: newWinRate,
        })
        .where(eq(UserStats.id, redeemer));

    const tradeId = `${event.transaction.hash}-${event.log.logIndex}`;
    await context.db.insert(Trade).values({
        id: tradeId,
        userId: redeemer,
        marketId: conditionId,
        outcomeIndex: -1,
        type: "REDEMPTION",
        shares: 0n,
        collateralAmount: payout,
        pricePerShare: null,
        pnl: realizedPnL,
        timestamp: event.block.timestamp,
    });
});
