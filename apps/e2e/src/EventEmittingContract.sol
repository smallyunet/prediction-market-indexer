// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract CtfExchangeEmitter {
    event ConditionPreparation(
        bytes32 indexed conditionId,
        address indexed oracle,
        bytes32 indexed questionId,
        uint256 outcomeSlotCount
    );

    event ConditionResolution(
        bytes32 indexed conditionId,
        address indexed oracle,
        bytes32 indexed questionId,
        uint256 outcomeSlotCount,
        uint256[] payoutNumerators
    );

    event PositionSplit(
        address indexed stakeholder,
        address collateralToken,
        bytes32 indexed parentCollectionId,
        bytes32 indexed conditionId,
        uint256[] partition,
        uint256 amount
    );

    function emitConditionPreparation(
        bytes32 conditionId,
        address oracle,
        bytes32 questionId,
        uint256 outcomeSlotCount
    ) external {
        emit ConditionPreparation(conditionId, oracle, questionId, outcomeSlotCount);
    }

    function emitPositionSplit(
        address stakeholder,
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external {
        emit PositionSplit(stakeholder, collateralToken, parentCollectionId, conditionId, partition, amount);
    }
}
