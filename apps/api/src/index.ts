import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
    return c.json({ message: 'Prediction Market Indexer API' });
});

app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Server is running on port ${port}`);

export default {
    port,
    fetch: app.fetch,
};
