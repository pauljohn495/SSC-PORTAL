import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './src/config/index.js';
import { connectToDatabase } from './src/config/db.js';
import routes from './src/routes/index.js';
import { initSocket } from './src/realtime/socket.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { notFound } from './src/middleware/notFound.js';
import { startPriorityCleanupInterval } from './src/utils/priorityCleanup.js';
import { rebuildAlgoliaIndex } from './src/services/algoliaService.js';

const app = express();

// Middleware
app.use(cors({ 
  origin: config.corsOrigin.split(','),
  exposedHeaders: ['X-API-Log']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectToDatabase();

    const server = http.createServer(app);
    initSocket(server);
    server.listen(config.port, () => {
      console.log(`Server is running at http://localhost:${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });

    // Start priority cleanup interval
    startPriorityCleanupInterval();

    rebuildAlgoliaIndex().catch((error) => {
      console.error('[Algolia] Rebuild failed:', error);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
