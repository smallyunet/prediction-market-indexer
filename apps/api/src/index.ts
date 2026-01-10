import { Hono } from 'hono';
import { Pool } from 'pg';

const app = new Hono();

// Connect to the Ponder database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ponder'
});

app.get('/', (c) => {
    return c.json({ message: 'Prediction Market Indexer API v0.0.4' });
});

app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /markets - List markets with advanced filtering, sorting, and pagination
app.get('/markets', async (c) => {
    try {
        // Query parameters
        const status = c.req.query('status') || 'all'; // all, resolved, unresolved
        const sortBy = c.req.query('sortBy') || 'createdAt'; // createdAt, resolvedAt
        const order = c.req.query('order') || 'desc'; // asc, desc
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const offset = (page - 1) * limit;

        // Validate sortBy to prevent SQL injection
        const allowedSortFields = ['createdAt', 'resolvedAt'];
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

