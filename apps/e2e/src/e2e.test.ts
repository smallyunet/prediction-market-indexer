import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, pad } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { spawn, ChildProcess } from 'child_process';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';

// Configuration
const ANVIL_PORT = 8545;
const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`;
const DB_PORT = 5432;
const DATABASE_URL = `postgresql://postgres:password@127.0.0.1:${DB_PORT}/ponder`; // Use 127.0.0.1 to avoid IPv6 issues
const INDEXER_PORT = 42069;
const API_PORT = 3001;

// Clients
const chain = { ...foundry, id: 31337 }; // Anvil default
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'); // Anvil Account #0
const client = createWalletClient({ account, chain, transport: http(ANVIL_RPC) });
const publicClient = createPublicClient({ chain, transport: http(ANVIL_RPC) });

// Process references
let anvilProcess: ChildProcess;
let indexerProcess: ChildProcess;
let apiProcess: ChildProcess;

// Contract ABI (minimal for deployment)
const CONTRACT_ABI = parseAbi([
    'function emitConditionPreparation(bytes32 conditionId, address oracle, bytes32 questionId, uint256 outcomeSlotCount) external',
    'function emitPositionSplit(address stakeholder, address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata partition, uint256 amount) external'
]);

// Helper to wait for a port
const waitForPort = async (port: number, retries = 20): Promise<void> => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await fetch(`http://localhost:${port}/health`).catch(() => null);
            if (result && result.ok) return;
            // For Anvil, any response is good enough to know it's listening, but here we check typical health endpoints
        } catch (e) { }
        await new Promise(r => setTimeout(r, 500));
    }
    // throw new Error(`Port ${port} not ready`);
};

describe('E2E Flow', () => {
    let contractAddress: `0x${string}`;

    beforeAll(async () => {
        console.log('Starting E2E Setup...');

        // 0. Reset Database
        // Connect to 'postgres' db to drop/create 'ponder'
        const rootClient = new Pool({
            connectionString: `postgresql://postgres:password@localhost:${DB_PORT}/postgres`
        });
        try {
            await rootClient.query('DROP DATABASE IF EXISTS ponder WITH (FORCE)');
            await rootClient.query('CREATE DATABASE ponder');
            console.log('Database reset complete');
        } catch (e) {
            console.error('Failed to reset database:', e);
        } finally {
            await rootClient.end();
        }

        // 1. Start Anvil
        anvilProcess = spawn('anvil', ['--port', ANVIL_PORT.toString(), '--block-time', '1'], { stdio: 'ignore' });
        // Wait for Anvil (simple wait)
        await new Promise(r => setTimeout(r, 2000));

        // 2. Deploy Contract
        // We need the bytecode. For simplicity in this test script, let's assume we can compile or use a pre-compiled bytecode.
        // OR simpler: we use a "Test" contract that we compile on the fly using solc or just mock the event emission if possible? 
        // No, we need a real contract to emit events for Ponder to pick up.
        // Let's assume we have the bytecode of the CtfExchangeEmitter. 
        // Since we don't have solc installed in the environment easily, 
        // I will use a minimal raw bytecode for a contract that has these methods.
        // Actually, compiling creates complexity. 
        // ALTERNATIVE: Use `viem` to deploy if we had the artifact.
        // Let's trying simulating the event by sending a transaction to a random address? 
        // No, Ponder filters by contract address.
        // OK, I will skip the compilation step in this file and assume the user has `forge` installed to build it.
        // Let's run `forge build` in the `apps/e2e` dir.

        // Ensure we are in apps/e2e
        const packageRoot = path.resolve(__dirname, '..');
        try {
            console.log('Building contract in:', packageRoot);
            const { execSync } = await import('child_process');
            // Build using forge in the package root
            execSync('forge build', { cwd: packageRoot, stdio: 'inherit' });

            const artifactPath = path.resolve(packageRoot, 'out/EventEmittingContract.sol/CtfExchangeEmitter.json');
            if (!fs.existsSync(artifactPath)) {
                throw new Error(`Artifact not found at ${artifactPath}`);
            }

            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            const hash = await client.deployContract({
                abi: artifact.abi,
                bytecode: artifact.bytecode.object,
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            contractAddress = receipt.contractAddress!;
            console.log('Deployed Contract at:', contractAddress);

            // Get current block number for startBlock
            const blockNumber = await publicClient.getBlockNumber();
            console.log('Current Block:', blockNumber);

            // 3. Start Indexer
            const indexerLog = fs.openSync(path.resolve(__dirname, '../../indexer.log'), 'w');
            const indexerEnv = {
                ...process.env,
                PONDER_CHAIN_ID: '31337',
                PONDER_RPC_URL_137: ANVIL_RPC,
                CTF_EXCHANGE_ADDRESS: contractAddress,
                PONDER_START_BLOCK: blockNumber.toString(),
                PONDER_LOG_LEVEL: 'debug',
                DATABASE_URL: DATABASE_URL,
                PORT: INDEXER_PORT.toString()
            };

            console.log('Starting Indexer...');
            indexerProcess = spawn('pnpm', ['start'], {
                cwd: path.resolve(__dirname, '../../indexer'),
                env: indexerEnv,
                stdio: ['ignore', indexerLog, indexerLog]
            });

            // Wait for Indexer to be ready (it logs "Server listening")
            await new Promise(r => setTimeout(r, 10000)); // Generous wait for codegen + start

            // 4. Start API
            const apiLog = fs.openSync(path.resolve(__dirname, '../../api.log'), 'w');
            const apiEnv = {
                ...process.env,
                DATABASE_URL: DATABASE_URL,
                PORT: API_PORT.toString()
            };
            console.log('Starting API...');
            apiProcess = spawn('pnpm', ['dev'], {
                cwd: path.resolve(__dirname, '../../api'),
                env: apiEnv,
                stdio: ['ignore', apiLog, apiLog]
            });

            await waitForPort(API_PORT);
            console.log('Setup Complete');
        } catch (e) {
            console.error('Failed to compile/deploy contract:', e);
            throw e;
        }
    }, 60000);

    afterAll(() => {
        anvilProcess?.kill();
        indexerProcess?.kill();
        apiProcess?.kill();
    });

    it('should index a new market and find it via API', async () => {
        const conditionId = '0x' + '1'.repeat(64) as `0x${string}`;
        const questionId = '0x' + '2'.repeat(64) as `0x${string}`;
        const oracle = account.address;

        // Emit ConditionPreparation
        await client.writeContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'emitConditionPreparation',
            args: [conditionId, oracle, questionId, 2n]
        });

        // Wait for Indexer
        await new Promise(r => setTimeout(r, 2000));

        // Check API
        const res = await fetch(`http://localhost:${API_PORT}/markets`);
        const data = await res.json();

        expect(data.success).toBe(true);
        const market = data.data.find((m: any) => m.conditionId === conditionId);
        expect(market).toBeDefined();
        expect(market.questionId).toBe(questionId);
    });
});
