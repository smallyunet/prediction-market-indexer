import { eq } from "@ponder/core";
import {
    LiquidityProvider,
    MarketDepthSnapshot,
    OutcomePricePoint,
} from "../../ponder.schema";
import { bigintArrayToJson } from "../lib/bigintJson";

export async function upsertLiquidityProvider(
    context: any,
    marketId: string,
    userId: string,
    deltaProvided: bigint,
    deltaRemoved: bigint,
    timestamp: bigint,
) {
    const id = `${marketId}-${userId}`;
    const existing = await context.db.query.LiquidityProvider.findFirst({
        where: eq(LiquidityProvider.id, id),
    });

    if (!existing) {
        const provided = deltaProvided > 0n ? deltaProvided : 0n;
        const removed = deltaRemoved > 0n ? deltaRemoved : 0n;
        const netLiquidity = provided - removed;
        await context.db.insert(LiquidityProvider).values({
            id,
            marketId,
            userId,
            provided,
            removed,
            netLiquidity,
            lastUpdatedAt: timestamp,
        });
        return;
    }

    const provided = (existing.provided || 0n) + deltaProvided;
    const removed = (existing.removed || 0n) + deltaRemoved;
    const netLiquidity = (existing.netLiquidity || 0n) + deltaProvided - deltaRemoved;

    await context.db
        .update(LiquidityProvider)
        .set({
            provided: provided < 0n ? 0n : provided,
            removed: removed < 0n ? 0n : removed,
            netLiquidity,
            lastUpdatedAt: timestamp,
        })
        .where(eq(LiquidityProvider.id, id));
}

export async function recordDepthAndPrices(
    context: any,
    marketId: string,
    outcomeSlotCount: number,
    sharesByOutcome: bigint[],
    timestamp: bigint,
    txHash: string,
    logIndex: number,
) {
    const totalShares = sharesByOutcome.reduce((acc, v) => acc + v, 0n);

    await context.db.insert(MarketDepthSnapshot).values({
        id: `${txHash}-${logIndex}`,
        marketId,
        totalShares,
        sharesByOutcome: bigintArrayToJson(sharesByOutcome),
        timestamp,
    });

    const totalSharesNumber = totalShares === 0n ? 0 : Number(totalShares);
    for (let i = 0; i < outcomeSlotCount; i++) {
        const s = sharesByOutcome[i] || 0n;
        const price = totalSharesNumber === 0 ? 0 : Number(s) / totalSharesNumber;
        await context.db.insert(OutcomePricePoint).values({
            id: `${txHash}-${logIndex}-${i}`,
            marketId,
            outcomeIndex: i,
            price,
            liquidityShares: s,
            timestamp,
        });
    }
}
