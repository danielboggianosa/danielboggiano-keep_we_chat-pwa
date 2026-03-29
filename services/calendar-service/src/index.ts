import express from 'express';

const app = express();
const PORT = Number(process.env.PORT ?? 4004);

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`Calendar Service listening on port ${PORT}`);
});
