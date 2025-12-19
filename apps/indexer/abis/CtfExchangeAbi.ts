export const CtfExchangeAbi = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "bytes32", "name": "conditionId", "type": "bytes32" },
            { "indexed": true, "internalType": "contract IERC20", "name": "collateralToken", "type": "address" },
            { "indexed": false, "internalType": "uint256[]", "name": "partition", "type": "uint256[]" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "ConditionPreparation",
        "type": "event"
    }
] as const;
