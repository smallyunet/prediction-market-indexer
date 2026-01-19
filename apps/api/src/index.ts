import { Hono } from 'hono';
import { Pool } from 'pg';
import { swaggerUI } from '@hono/swagger-ui';

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
        version: '0.0.5',
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
    return c.json({ message: 'Prediction Market Indexer API v0.0.5' });
});

app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve OpenAPI spec
app.get('/openapi.json', (c) => c.json(openApiSpec));

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

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

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`Server is running on port ${port}`);

export default {
    port,
    fetch: app.fetch,
};
