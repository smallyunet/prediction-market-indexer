import { ponder } from "@/generated";

ponder.on("CtfExchange:ConditionPreparation", async ({ event, context }) => {
    const { Market } = context.db;

    // ABI inputs: conditionId (bytes32), collateralToken (address), partition (uint256[]), amount (uint256)
    const { conditionId, collateralToken, partition, amount } = event.args;

    // We use conditionId as the Market unique identifier as it determines the question logic.
    await Market.create({
        id: conditionId,
        data: {
            conditionId: conditionId,
            collateralToken: collateralToken,
            splitFrom: [], // Initial state
            splitTo: [],   // Initial state
            createdAt: event.block.timestamp,
            resolved: false,
            // 'questionId' is not available in this specific event ABI
            // 'title', 'minSplits' are also not available here, would need metadata fetching
        }
    });
});
