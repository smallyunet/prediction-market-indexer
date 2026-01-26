import { eq } from "@ponder/core";
import { UserStats } from "../../ponder.schema";

export async function getOrCreateUser(context: any, userId: string) {
    let user = await context.db.query.UserStats.findFirst({
        where: eq(UserStats.id, userId),
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

export function calculateWinRate(winCount: number, lossCount: number): number {
    const total = winCount + lossCount;
    if (total === 0) return 0;
    return winCount / total;
}
