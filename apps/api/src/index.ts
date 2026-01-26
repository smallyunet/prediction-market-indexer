import { Hono } from 'hono';
import { Pool } from 'pg';
import { swaggerUI } from '@hono/swagger-ui';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';

const app = new Hono();

// Connect to the Ponder database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ponder'
});

// OpenAPI specification
const openApiSpec = {
    openapi: '3.0.0',
    info: {
        title: 'Prediction Market Indexer API',
        version: '0.0.6',
        description: 'API for querying indexed prediction market data from Polymarket/CTF Exchange'
    },
    servers: [{ url: '/' }],
    paths: {
        '/': {
            get: {
                summary: 'API Info',
                responses: { '200': { description: 'API version and info' } }
            }
        },
        '/health': {
            get: {
                summary: 'Health Check',
                responses: { '200': { description: 'Server health status' } }
            }
        },
        '/markets': {
            get: {
                summary: 'List Markets',
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['all', 'resolved', 'unresolved'] } },
                    { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'resolvedAt', 'totalVolume'] } },
                    { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } }
                ],
                responses: { '200': { description: 'Paginated list of markets' } }
            }
        },
        '/markets/stats': {
            get: {
                summary: 'Market Statistics',
                description: 'Get aggregated market statistics (daily/weekly volumes)',
                parameters: [
                    { name: 'period', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } },
                    { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
                    { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } }
                ],
                responses: { '200': { description: 'Aggregated statistics' } }
            }
        },
        '/markets/{id}': {
            get: {
                summary: 'Get Market Details',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { '200': { description: 'Market details with outcomes and stats' }, '404': { description: 'Market not found' } }
            }
        },
        '/markets/{id}/prices': {
            get: {
                summary: 'Historical Outcome Prices',
                description: 'Get derived historical price points per outcome for a market. Prices are derived from open interest distribution (approx).',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'outcomeIndex', in: 'query', schema: { type: 'integer' } },
                    { name: 'interval', in: 'query', schema: { type: 'string', enum: ['minute', 'hour', 'day'], default: 'hour' } },
                    { name: 'from', in: 'query', schema: { type: 'string', description: 'ISO date string' } },
                    { name: 'to', in: 'query', schema: { type: 'string', description: 'ISO date string' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, maximum: 5000 } }
                ],
                responses: { '200': { description: 'Time-series price points' } }
            }
        },
        '/markets/{id}/depth': {
            get: {
                summary: 'Market Depth Snapshot',
                description: 'Get the latest derived depth snapshot (open interest by outcome).',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Latest market depth snapshot' }, '404': { description: 'No snapshots found' } }
            }
        },
        '/markets/{id}/liquidity-providers': {
            get: {
                summary: 'Liquidity Providers',
                description: 'List derived liquidity providers for a market, based on split/merge collateral flows.',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 500 } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }
                ],
                responses: { '200': { description: 'Liquidity providers list' } }
            }
        },
        '/ws': {
            get: {
                summary: 'WebSocket (real-time)',
                description: 'WebSocket endpoint for periodic real-time updates. Optional query: marketId',
                parameters: [
                    { name: 'marketId', in: 'query', schema: { type: 'string' } }
                ],
                responses: { '101': { description: 'Switching Protocols' } }
            }
        },
        '/leaderboard': {
            get: {
                summary: 'Trader Leaderboard',
                description: 'Get top traders ranked by PnL or win rate',
                parameters: [
                    { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['pnl', 'winRate', 'volume'] } },
                    { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }
                ],
                responses: { '200': { description: 'Ranked list of traders' } }
            }
        },
        '/users/{id}': {
            get: {
                summary: 'Get User Stats',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { '200': { description: 'User stats and positions' }, '404': { description: 'User not found' } }
            }
        }
    }
};

app.get('/', (c) => {
    return c.json({ message: 'Prediction Market Indexer API v0.0.6' });
});

app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve OpenAPI spec
app.get('/openapi.json', (c) => c.json(openApiSpec));

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

function parseIsoToSeconds(value?: string | null): number | null {
    if (!value) return null;
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 1000);
}

// GET /markets - List markets with advanced filtering, sorting, and pagination
app.get('/markets', async (c) => {
    try {
        // Query parameters
        const status = c.req.query('status') || 'all'; // all, resolved, unresolved
        const sortBy = c.req.query('sortBy') || 'createdAt'; // createdAt, resolvedAt, totalVolume
        const order = c.req.query('order') || 'desc'; // asc, desc
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const offset = (page - 1) * limit;

        // Validate sortBy to prevent SQL injection
        const allowedSortFields = ['createdAt', 'resolvedAt', 'totalVolume', 'tradeCount'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? `"${sortBy}"` : '"createdAt"';
        const safeOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // Build WHERE clause based on status
        let whereClause = '';
        if (status === 'resolved') {
            whereClause = 'WHERE "resolved" = true';
        } else if (status === 'unresolved') {
            whereClause = 'WHERE "resolved" = false';
        }

        // Count total records for pagination
        const countQuery = `SELECT COUNT(*) as total FROM "Market" ${whereClause}`;
        const countResult = await pool.query(countQuery);
        const total = parseInt(countResult.rows[0].total, 10);

        // Fetch markets
        const query = `
            SELECT * FROM "Market" 
            ${whereClause}
            ORDER BY ${safeSortBy} ${safeOrder} NULLS LAST
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        return c.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        console.error('Error fetching markets:', error);
        return c.json({
            success: false,
            error: error.message
        }, 500);
    }
});

// GET /markets/stats - Market statistics aggregation
app.get('/markets/stats', async (c) => {
    try {
        const period = c.req.query('period') || 'daily'; // daily, weekly, monthly
        const fromDate = c.req.query('from');
        const toDate = c.req.query('to');

        // Get overall stats
        const overallStats = await pool.query(`
            SELECT 
                COUNT(*) as "totalMarkets",
                COUNT(*) FILTER (WHERE "resolved" = true) as "resolvedMarkets",
                COUNT(*) FILTER (WHERE "resolved" = false) as "activeMarkets",
                COALESCE(SUM("totalVolume"), 0) as "totalVolume",
                COALESCE(SUM("tradeCount"), 0) as "totalTrades"
            FROM "Market"
        `);

        // Get time-series data based on period
        let intervalStr: string;
        switch (period) {
            case 'weekly': intervalStr = '1 week'; break;
            case 'monthly': intervalStr = '1 month'; break;
            default: intervalStr = '1 day';
        }

        // Build date filter
        let dateFilter = '';
        const params: any[] = [];
        if (fromDate) {
            params.push(Math.floor(new Date(fromDate).getTime() / 1000));
            dateFilter += ` AND "timestamp" >= $${params.length}`;
        }
        if (toDate) {
            params.push(Math.floor(new Date(toDate).getTime() / 1000));
            dateFilter += ` AND "timestamp" <= $${params.length}`;
        }

        // Get volume over time from trades
        const volumeQuery = `
            SELECT 
                date_trunc('${period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'}', 
                    to_timestamp("timestamp")::timestamp) as period,
                COUNT(*) as trades,
                COALESCE(SUM("collateralAmount"), 0) as volume
            FROM "Trade"
            WHERE 1=1 ${dateFilter}
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 30
        `;
        const volumeResult = await pool.query(volumeQuery, params);

        return c.json({
            success: true,
            data: {
                overview: overallStats.rows[0],
                timeSeries: volumeResult.rows,
                period,
            }
        });
    } catch (error: any) {
        console.error('Error fetching market stats:', error);
        return c.json({
            success: false,
            error: error.message
        }, 500);
    }
});

// GET /markets/:id - Get single market with details
app.get('/markets/:id', async (c) => {
    const marketId = c.req.param('id');
    try {
        // Fetch market
        const marketResult = await pool.query('SELECT * FROM "Market" WHERE "id" = $1', [marketId]);
        const market = marketResult.rows[0];

        if (!market) {
            return c.json({ success: false, error: 'Market not found' }, 404);
        }

        // Fetch outcomes
        const outcomesResult = await pool.query(
            'SELECT * FROM "Outcome" WHERE "marketId" = $1 ORDER BY "index" ASC',
            [marketId]
        );

        // Fetch trade statistics
        const tradeStatsResult = await pool.query(`
            SELECT 
                COUNT(*) as "tradeCount",
                COALESCE(SUM("collateralAmount"), 0) as "totalVolume"
            FROM "Trade" 
            WHERE "marketId" = $1
        `, [marketId]);

        const tradeStats = tradeStatsResult.rows[0];

        return c.json({
            success: true,
            data: {
                ...market,
                outcomes: outcomesResult.rows,
                stats: {
                    tradeCount: parseInt(tradeStats.tradeCount, 10),
                    totalVolume: tradeStats.totalVolume,
                },
            },
        });
    } catch (error: any) {
        console.error('Error fetching market:', error);
        return c.json({
            success: false,
            error: error.message
        }, 500);
    }
});

// GET /markets/:id/prices - Derived outcome price history
app.get('/markets/:id/prices', async (c) => {
    const marketId = c.req.param('id');
    try {
        const interval = (c.req.query('interval') || 'hour').toLowerCase();
        const safeUnit = interval === 'minute' ? 'minute' : interval === 'day' ? 'day' : 'hour';

        const outcomeIndexParam = c.req.query('outcomeIndex');
        const outcomeIndex = outcomeIndexParam != null ? parseInt(outcomeIndexParam, 10) : null;
        const limit = Math.min(5000, Math.max(1, parseInt(c.req.query('limit') || '500', 10)));

        const from = parseIsoToSeconds(c.req.query('from'));
        const to = parseIsoToSeconds(c.req.query('to'));

        const params: any[] = [marketId];
        const where: string[] = ['"marketId" = $1'];

        if (Number.isInteger(outcomeIndex)) {
            params.push(outcomeIndex);
            where.push(`"outcomeIndex" = $${params.length}`);
        }
        if (from != null) {
            params.push(from);
            where.push(`"timestamp" >= $${params.length}`);
        }
        if (to != null) {
            params.push(to);
            where.push(`"timestamp" <= $${params.length}`);
        }

        params.push(limit);

        const query = `
            SELECT
                date_trunc('${safeUnit}', to_timestamp("timestamp")::timestamp) as bucket,
                "outcomeIndex",
                AVG("price") as price,
                AVG("liquidityShares") as "liquidityShares"
            FROM "OutcomePricePoint"
            WHERE ${where.join(' AND ')}
            GROUP BY 1, 2
            ORDER BY 1 ASC
            LIMIT $${params.length}
        `;

        const result = await pool.query(query, params);
        return c.json({
            success: true,
            data: result.rows,
            meta: { marketId, interval: safeUnit },
        });
    } catch (error: any) {
        console.error('Error fetching prices:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /markets/:id/depth - Latest derived depth snapshot
app.get('/markets/:id/depth', async (c) => {
    const marketId = c.req.param('id');
    try {
        const result = await pool.query(
            'SELECT * FROM "MarketDepthSnapshot" WHERE "marketId" = $1 ORDER BY "timestamp" DESC LIMIT 1',
            [marketId]
        );
        const snapshot = result.rows[0];
        if (!snapshot) return c.json({ success: false, error: 'No depth snapshots found' }, 404);
        return c.json({ success: true, data: snapshot });
    } catch (error: any) {
        console.error('Error fetching depth:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /markets/:id/liquidity-providers - Derived LP list
app.get('/markets/:id/liquidity-providers', async (c) => {
    const marketId = c.req.param('id');
    try {
        const limit = Math.min(500, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const offset = (page - 1) * limit;

        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM "LiquidityProvider" WHERE "marketId" = $1',
            [marketId]
        );
        const total = parseInt(countResult.rows[0].total, 10);

        const result = await pool.query(
            `
                SELECT * FROM "LiquidityProvider"
                WHERE "marketId" = $1
                ORDER BY "netLiquidity" DESC NULLS LAST
                LIMIT $2 OFFSET $3
            `,
            [marketId, limit, offset]
        );

        return c.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        console.error('Error fetching liquidity providers:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /leaderboard - Top traders by PnL or WinRate
app.get('/leaderboard', async (c) => {
    try {
        const sortBy = c.req.query('sortBy') || 'pnl'; // pnl, winRate, volume
        const order = c.req.query('order') || 'desc';
        const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '10', 10)));
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const offset = (page - 1) * limit;

        // Map sortBy to column names
        const sortColumnMap: Record<string, string> = {
            pnl: '"realizedPnL"',
            winRate: '"winRate"',
            volume: '"totalVolume"',
            tradeCount: '"tradeCount"'
        };
        const safeSortBy = sortColumnMap[sortBy] || '"realizedPnL"';
        const safeOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // Count total users
        const countResult = await pool.query('SELECT COUNT(*) as total FROM "UserStats"');
        const total = parseInt(countResult.rows[0].total, 10);

        // Fetch leaderboard
        const query = `
            SELECT 
                "id" as address,
                "totalVolume",
                "realizedPnL",
                "winRate",
                "tradeCount",
                "winCount",
                "lossCount"
            FROM "UserStats"
            WHERE "tradeCount" > 0
            ORDER BY ${safeSortBy} ${safeOrder} NULLS LAST
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        // Add rank to each user
        const rankedUsers = result.rows.map((user: any, index: number) => ({
            rank: offset + index + 1,
            ...user
        }));

        return c.json({
            success: true,
            data: rankedUsers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            sortedBy: sortBy,
            order: safeOrder.toLowerCase(),
        });
    } catch (error: any) {
        console.error('Error fetching leaderboard:', error);
        return c.json({
            success: false,
            error: error.message
        }, 500);
    }
});

// GET /users/:id - Get user stats and positions
app.get('/users/:id', async (c) => {
    const userId = c.req.param('id');
    try {
        const userResult = await pool.query('SELECT * FROM "UserStats" WHERE "id" = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }

        const positionsResult = await pool.query(`
            SELECT p.*, o.name as "outcomeName", m.title as "marketTitle", m.id as "marketId", m.resolved as "marketResolved"
            FROM "Position" p
            JOIN "Outcome" o ON p."outcomeId" = o.id
            JOIN "Market" m ON o."marketId" = m.id
            WHERE p."userId" = $1 AND p."shares" > 0
        `, [userId]);

        // Fetch recent trades
        const tradesResult = await pool.query(`
            SELECT * FROM "Trade"
            WHERE "userId" = $1
            ORDER BY "timestamp" DESC
            LIMIT 20
        `, [userId]);

        return c.json({
            success: true,
            data: {
                stats: user,
                positions: positionsResult.rows,
                recentTrades: tradesResult.rows,
            }
        });
    } catch (error: any) {
        console.error('Error fetching user:', error);
        return c.json({
            success: false,
            error: error.message
        }, 500);
    }
});

const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });
const wsSubscriptions = new Map<any, { marketId: string | null }>();

app.get(
    '/ws',
    upgradeWebSocket((c) => {
        const marketId = c.req.query('marketId') || null;
        return {
            onOpen(_event, ws) {
                wsSubscriptions.set(ws, { marketId });
                ws.send(JSON.stringify({ type: 'hello', marketId }));
            },
            onMessage(event, ws) {
                try {
                    const msg = JSON.parse(typeof event.data === 'string' ? event.data : '');
                    if (msg?.type === 'subscribe' && typeof msg.marketId === 'string') {
                        wsSubscriptions.set(ws, { marketId: msg.marketId });
                        ws.send(JSON.stringify({ type: 'subscribed', marketId: msg.marketId }));
                    }
                    if (msg?.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
                    }
                } catch {
                    // ignore
                }
            },
            onClose(_event, ws) {
                wsSubscriptions.delete(ws);
            },
        };
    })
);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const server = serve(
    {
        fetch: app.fetch,
        port,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
);

injectWebSocket(server);

// Periodic real-time push (best-effort): latest prices
setInterval(async () => {
    try {
        if (wsSubscriptions.size === 0) return;

        const latest = await pool.query(`
            SELECT DISTINCT ON ("marketId", "outcomeIndex")
                "marketId", "outcomeIndex", "price", "liquidityShares", "timestamp"
            FROM "OutcomePricePoint"
            ORDER BY "marketId", "outcomeIndex", "timestamp" DESC
            LIMIT 500
        `);

        const rows = latest.rows;
        for (const [ws, sub] of wsSubscriptions.entries()) {
            const data = sub.marketId ? rows.filter((r: any) => r.marketId === sub.marketId) : rows;
            ws.send(JSON.stringify({ type: 'prices:latest', marketId: sub.marketId, data }));
        }
    } catch (error) {
        // keep server alive
    }
}, 5000);

export default app;
