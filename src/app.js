import 'dotenv/config';
import Fastify from 'fastify';

// Core System Imports
import { CoreContainer } from './core/container/Container.js';
import { ErrorSystem, createErrorSystem } from './core/errors/ErrorSystem.js';
import { setupErrorHandler } from './core/errors/integrations/fastify/handler.js';

export async function buildApp() {
  // Create the core container
  const container = new CoreContainer();

  // Create and register error system 
  const errorSystemFactory = () => {
    return createErrorSystem({ 
      logger: console 
    });
  };
  
  // Register as a factory function
  container.register('errorSystem', errorSystemFactory);

  // Create Fastify instance with error serialization
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        error: (error) => {
          // Resolve error system and use its serializer
          const errorSystem = container.resolve('errorSystem');
          return errorSystem.serializeError(error);
        }
      }
    }
  });

  // Setup Fastify error handling
  setupErrorHandler(fastify);

  // Initialize the container
  try {
    await container.initialize();
  } catch (error) {
    console.error('Container initialization error:', error);
    throw error;
  }

  // Basic route as a health check
  fastify.get('/', async (request, reply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    };
  });

  // Graceful shutdown handling
  const closeHandler = async () => {
    try {
      // Shutdown Fastify
      await fastify.close();
      
      // Shutdown container
      await container.shutdown();
    } catch (error) {
      console.error('Shutdown error:', error);
    }
  };

  // Handle various shutdown signals
  process.on('SIGINT', closeHandler);
  process.on('SIGTERM', closeHandler);

  // Add server close hook
  fastify.addHook('onClose', async () => {
    await container.shutdown();
  });

  return fastify;
}