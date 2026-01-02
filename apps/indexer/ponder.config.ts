import { createConfig } from "@ponder/core";
import { http } from "viem";

import { CtfExchangeAbi } from "./abis/CtfExchangeAbi";

export default createConfig({
    networks: {
        polygon: {
            chainId: process.env.PONDER_CHAIN_ID ? Number(process.env.PONDER_CHAIN_ID) : 137,
            transport: http(process.env.PONDER_RPC_URL_137 || "https://polygon-rpc.com"),
            pollingInterval: 1000,
            maxRequestsPerSecond: 100,
        },
    },
    contracts: {
        CtfExchange: {
            network: "polygon",
            abi: CtfExchangeAbi,
            address: (process.env.CTF_EXCHANGE_ADDRESS as `0x${string}`) || "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
            startBlock: process.env.PONDER_START_BLOCK ? Number(process.env.PONDER_START_BLOCK) : 40000000,
        },
    },
});
