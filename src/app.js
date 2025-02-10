import { setupErrorHandler, errorSerializer } from './core/errors/integrations/fastify/index.js';

// In your Fastify setup
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      error: errorSerializer.serializer
    }
  }
});

// Setup error handling
setupErrorHandler(fastify);