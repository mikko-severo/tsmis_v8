// src/core/event/EventBusSystem.js

import { EventEmitter } from 'events';
import { CoreEventBus } from './EventBus.js';
import { CoreError } from '../errors/Error.js';

export class EventBusSystem extends EventEmitter {
  static dependencies = ['errorSystem', 'config'];

  constructor(deps) {
    super();
    this.deps = deps;
    this.eventBus = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      throw new CoreError('ALREADY_INITIALIZED', 'EventBusSystem is already initialized');
    }

    try {
      // Create and initialize event bus
      this.eventBus = new CoreEventBus(this.deps);
      await this.eventBus.initialize();

      this.initialized = true;
      this.emit('system:initialized', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await this.handleError(error);
      throw error;
    }
  }

  async handleError(error, context = {}) {
    if (this.deps.errorSystem) {
      await this.deps.errorSystem.handleError(error, {
        source: 'EventBusSystem',
        ...context
      });
    }
  }

  getEventBus() {
    if (!this.initialized) {
      throw new CoreError('NOT_INITIALIZED', 'EventBusSystem is not initialized');
    }
    return this.eventBus;
  }

  async shutdown() {
    if (!this.initialized) return;

    try {
      await this.eventBus.shutdown();
      this.initialized = false;
      this.emit('system:shutdown', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await this.handleError(error, { phase: 'shutdown' });
      throw error;
    }
  }
}

// Factory function for container
export function createEventBusSystem(deps = {}) {
  return new EventBusSystem(deps);
}