export const CtfExchangeAbi = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "bytes32", "name": "conditionId", "type": "bytes32" },
            { "indexed": true, "internalType": "address", "name": "oracle", "type": "address" },
            { "indexed": true, "internalType": "bytes32", "name": "questionId", "type": "bytes32" },
            { "indexed": false, "internalType": "uint256", "name": "outcomeSlotCount", "type": "uint256" }
        ],
        "name": "ConditionPreparation",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "bytes32", "name": "conditionId", "type": "bytes32" },
            { "indexed": true, "internalType": "address", "name": "oracle", "type": "address" },
            { "indexed": true, "internalType": "bytes32", "name": "questionId", "type": "bytes32" },
            { "indexed": false, "internalType": "uint256", "name": "outcomeSlotCount", "type": "uint256" },
            { "indexed": false, "internalType": "uint256[]", "name": "payoutNumerators", "type": "uint256[]" }
        ],
        "name": "ConditionResolution",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "stakeholder", "type": "address" },
            { "indexed": false, "internalType": "contract IERC20", "name": "collateralToken", "type": "address" },
            { "indexed": true, "internalType": "bytes32", "name": "parentCollectionId", "type": "bytes32" },
            { "indexed": true, "internalType": "bytes32", "name": "conditionId", "type": "bytes32" },
            { "indexed": false, "internalType": "uint256[]", "name": "partition", "type": "uint256[]" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "PositionSplit",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "stakeholder", "type": "address" },
            { "indexed": false, "internalType": "contract IERC20", "name": "collateralToken", "type": "address" },
            { "indexed": true, "internalType": "bytes32", "name": "parentCollectionId", "type": "bytes32" },
            { "indexed": true, "internalType": "bytes32", "name": "conditionId", "type": "bytes32" },
            { "indexed": false, "internalType": "uint256[]", "name": "partition", "type": "uint256[]" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "PositionMerge",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "redeemer", "type": "address" },
            { "indexed": false, "internalType": "contract IERC20", "name": "collateralToken", "type": "address" },
            { "indexed": true, "internalType": "bytes32", "name": "parentCollectionId", "type": "bytes32" },
            { "indexed": false, "internalType": "bytes32", "name": "conditionId", "type": "bytes32" },
            { "indexed": false, "internalType": "uint256[]", "name": "indexSets", "type": "uint256[]" },
            { "indexed": false, "internalType": "uint256", "name": "payout", "type": "uint256" }
        ],
        "name": "PayoutRedemption",
        "type": "event"
    }
] as const;
