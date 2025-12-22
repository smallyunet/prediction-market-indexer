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

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`Server is running on port ${port}`);

export default {
    port,
    fetch: app.fetch,
};
