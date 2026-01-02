import { ponder } from "@/generated";
import { eq } from "@ponder/core";
import { Market, Outcome, Position, UserStats } from "../ponder.schema";

ponder.on("CtfExchange:ConditionPreparation", async ({ event, context }) => {
    const { conditionId, oracle, questionId, outcomeSlotCount } = event.args;

    // Create the Market (Condition)
    // Drizzle insert.
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

    // Update UserStats
    let user = await context.db.query.UserStats.findFirst({
        where: eq(UserStats.id, stakeholder)
    });

    if (!user) {
        await context.db.insert(UserStats).values({
            id: stakeholder,
            totalVolume: 0n,
            tradeCount: 0,
            totalPnL: 0,
        });
        // Refetch to have the object or rely on local vars
        // We can just accumulate below. But for cleanliness, let's use the local values.
        user = { id: stakeholder, totalVolume: 0n, tradeCount: 0, totalPnL: 0 };
    }

    // Increment stats
    await context.db.update(UserStats)
        .set({
            totalVolume: user.totalVolume + amount,
            tradeCount: user.tradeCount + 1,
        })
        .where(eq(UserStats.id, stakeholder));

    // Create/Update Positions
    for (const indexSet of partition) {
        // partition is bigint array in args? No, uint256[] -> bigint[] in Ponder 0.7?
        // Viem returns bigint for uint256.
        // partition is `readonly bigint[]`.
        const val = Number(indexSet);
        const index = Math.log2(val);

        if (Number.isInteger(index)) {
            const positionId = `${stakeholder}-${conditionId}-${index}`;
            const existing = await context.db.query.Position.findFirst({
                where: eq(Position.id, positionId)
            });

            if (existing) {
                await context.db.update(Position)
                    .set({ shares: existing.shares + amount })
                    .where(eq(Position.id, positionId));
            } else {
                await context.db.insert(Position).values({
                    id: positionId,
                    userId: stakeholder,
                    outcomeId: `${conditionId}-${index}`,
                    shares: amount,
                });
            }
        }
    }
});

ponder.on("CtfExchange:PositionMerge", async ({ event, context }) => {
    const { stakeholder, conditionId, partition, amount } = event.args;

    for (const indexSet of partition) {
        const val = Number(indexSet);
        const index = Math.log2(val);
        if (Number.isInteger(index)) {
            const positionId = `${stakeholder}-${conditionId}-${index}`;
            const existing = await context.db.query.Position.findFirst({
                where: eq(Position.id, positionId)
            });

            if (existing) {
                await context.db.update(Position)
                    .set({ shares: existing.shares - amount })
                    .where(eq(Position.id, positionId));
            }
        }
    }

    // Update Trade Count
    const user = await context.db.query.UserStats.findFirst({ where: eq(UserStats.id, stakeholder) });
    if (user) {
        await context.db.update(UserStats)
            .set({ tradeCount: user.tradeCount + 1 })
            .where(eq(UserStats.id, stakeholder));
    }
});

ponder.on("CtfExchange:ConditionResolution", async ({ event, context }) => {
    const { conditionId, payoutNumerators } = event.args;

    // payoutNumerators is bigint[]
    // we need to store it as json or casting?
    // Market.payouts is 'json'.
    // We can cast to string array or keep as bigint array if JSON.stringify handles it (it doesn't handle bigint).
    // so we map to strings.
    const payoutsJson = payoutNumerators.map(n => n.toString());

    await context.db.update(Market)
        .set({
            resolved: true,
            payouts: payoutsJson, // cast to unknown as any if types complain?
        })
        .where(eq(Market.id, conditionId));
});

ponder.on("CtfExchange:PayoutRedemption", async ({ event, context }) => {
    const { redeemer, payout } = event.args;

    const user = await context.db.query.UserStats.findFirst({ where: eq(UserStats.id, redeemer) });
    if (user) {
        const val = Number(payout);
        await context.db.update(UserStats)
            .set({
                totalPnL: (user.totalPnL || 0) + val,
                tradeCount: user.tradeCount + 1
            })
            .where(eq(UserStats.id, redeemer));
    }
});
