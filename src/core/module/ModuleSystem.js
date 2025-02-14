// src/core/module/ModuleSystem.js

import { EventEmitter } from 'events';
import { CoreModule } from './Module.js';
import { ModuleError } from '../errors/index.js';

export class ModuleSystem extends EventEmitter {
  static dependencies = ['errorSystem', 'eventBus'];

  constructor(deps) {
    super();
    this.deps = deps;
    this.modules = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      console.warn('ModuleSystem is already initialized');
      throw new ModuleError(
        'ALREADY_INITIALIZED',
        'ModuleSystem is already initialized'
      );
    }
  
    console.log('Initializing ModuleSystem...');
  
    for (const [name, module] of this.modules) {
      console.log(`Initializing module: ${name}`);
      await module.initialize();
    }
  
    this.initialized = true;
    this.emit('initialized');
  
    console.log('ModuleSystem initialization complete');
  }
  async register(name, Module, config = {}) {
    if (this.modules.has(name)) {
      throw new ModuleError(
        'DUPLICATE_MODULE',
        `Module ${name} is already registered`
      );
    }

    const module = new Module({
      ...this.deps,
      config
    });

    this.modules.set(name, module);
    this.emit('module:registered', { name, module });
  }

  async resolve(name) {
    if (!this.modules.has(name)) {
      throw new ModuleError(
        'MODULE_NOT_FOUND',
        `Module ${name} is not registered`
      );
    }

    return this.modules.get(name);
  }

  async shutdown() {
    if (!this.initialized) {
      return;
    }

    for (const [name, module] of this.modules) {
      await module.shutdown();
    }

    this.modules.clear();
    this.initialized = false;
    this.emit('shutdown');
  }
}

export function createModuleSystem(deps) {
  return new ModuleSystem(deps);
}