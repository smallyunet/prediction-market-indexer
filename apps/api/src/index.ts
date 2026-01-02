import { Hono } from 'hono';
import { Pool } from 'pg';

const app = new Hono();

// Connect to the Ponder database
// Ponder defaults: user=postgres, db=ponder, password=password (in docker-compose)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ponder'
});

app.get('/', (c) => {
    return c.json({ message: 'Prediction Market Indexer API v0.0.2' });
});

app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/markets', async (c) => {
    try {
        // Ponder creates tables with "" quoting usually if they have uppercase. 
        // Our schema has 'Market'. Let's try selecting from the table.
        // Usually Ponder tables are snake_case if we didn't specify otherwise, 
        // but 'p.createTable' with 'Market' usually results in 'Market' table.
        const result = await pool.query('SELECT * FROM "Market" ORDER BY "createdAt" DESC LIMIT 50');
        return c.json({
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error('Error fetching markets:', error);
        return c.json({
            success: false,
            error: error.message
        }, 500);
    }
});

app.get('/users/:id', async (c) => {
    const userId = c.req.param('id');
    try {
        const userResult = await pool.query('SELECT * FROM "UserStats" WHERE "id" = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }

        const positionsResult = await pool.query(`
            SELECT p.*, o.name as "outcomeName", m.title as "marketTitle", m.id as "marketId"
            FROM "Position" p
            JOIN "Outcome" o ON p."outcomeId" = o.id
            JOIN "Market" m ON o."marketId" = m.id
            WHERE p."userId" = $1
        `, [userId]);

        return c.json({
            success: true,
            data: {
                stats: user,
                positions: positionsResult.rows
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
