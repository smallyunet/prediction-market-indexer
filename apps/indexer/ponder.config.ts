import { createConfig } from "@ponder/core";
import { http } from "viem";

import { CtfExchangeAbi } from "./abis/CtfExchangeAbi";

export default createConfig({
    networks: {
        polygon: {
            chainId: 137,
            transport: http(process.env.PONDER_RPC_URL_137 || "https://polygon-rpc.com"),
        },
    },
    contracts: {
        CtfExchange: {
            network: "polygon",
            abi: CtfExchangeAbi,
            address: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
            startBlock: 40000000,
        },
    },
});
