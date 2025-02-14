// src/core/event/EventBus.js

import { EventEmitter } from 'events';
import { CoreError } from '../errors/Error.js';

export class CoreEventBus extends EventEmitter {
  static dependencies = ['errorSystem', 'config'];

  constructor(deps = {}) {
    super();
    this.deps = deps;
    this.queues = new Map();
    this.subscriptions = new Map();
    this.history = new Map();
    this.maxHistorySize = deps.config?.eventHistory?.maxSize || 1000;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      throw new CoreError('ALREADY_INITIALIZED', 'EventBus is already initialized');
    }

    try {
      // Initialize event tracking
      this.state = {
        status: 'running',
        startTime: Date.now(),
        metrics: new Map(),
        errors: []
      };

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
        source: 'CoreEventBus',
        ...context
      });
    }
  }
  /**
   * Enhanced emit with queuing and history
   */
  async emit(eventName, data, options = {}) {
    const event = {
      id: crypto.randomUUID(),
      name: eventName,
      data,
      timestamp: new Date().toISOString(),
      metadata: options.metadata || {}
    };

    // Store in history
    this.trackEvent(event);

    // Handle queuing if needed
    if (options.queue) {
      return this.queueEvent(event, options);
    }

    // Normal event emission
    return super.emit(eventName, event);
  }

  /**
   * Enhanced subscription with patterns
   */
  subscribe(pattern, handler, options = {}) {
    const subscription = {
      id: crypto.randomUUID(),
      pattern,
      handler,
      options
    };

    this.subscriptions.set(subscription.id, subscription);
    this.on(pattern, handler);

    return subscription.id;
  }

  /**
   * Queue events for delayed processing
   */
  async queueEvent(event, options = {}) {
    const queue = this.queues.get(event.name) || [];
    queue.push({
      event,
      options,
      timestamp: new Date().toISOString()
    });

    this.queues.set(event.name, queue);

    // Process queue if immediate
    if (options.immediate) {
      await this.processQueue(event.name);
    }
  }

  /**
   * Process queued events
   */
  async processQueue(queueName) {
    const queue = this.queues.get(queueName) || [];
    
    while (queue.length > 0) {
      const { event } = queue.shift();
      await super.emit(event.name, event);
    }

    this.queues.set(queueName, queue);
  }

  /**
   * Track events in history
   */
  trackEvent(event) {
    const history = this.history.get(event.name) || [];
    history.unshift(event);

    // Trim history if needed
    if (history.length > this.maxHistorySize) {
      history.pop();
    }

    this.history.set(event.name, history);
  }

  /**
   * Get event history
   */
  getHistory(eventName) {
    return this.history.get(eventName) || [];
  }

  /**
   * Clear history and queues
   */
  async reset() {
    this.queues.clear();
    this.history.clear();
    this.removeAllListeners();
  }

  async shutdown() {
    if (!this.initialized) return;

    try {
      await this.reset();
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
export function createEventBus(deps = {}) {
    return new CoreEventBus(deps);
  }