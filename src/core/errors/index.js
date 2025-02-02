import { CoreError } from './Error.js';
import { ErrorTypes as TypedErrors, 
    AccessError,
    AuthError,
    ConfigError,
    ModuleError,
    NetworkError,
    ServiceError,
    ValidationError
} from './types/index.js';

// Create complete ErrorTypes including CoreError
export const ErrorTypes = {
    CoreError,
    ...TypedErrors
};

// Export individual error classes
export {
    CoreError,
    AccessError,
    AuthError,
    ConfigError,
    ModuleError,
    NetworkError,
    ServiceError,
    ValidationError
};


/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Core errors
  CORE: {
    UNKNOWN: 'UNKNOWN_ERROR',
    INITIALIZATION: 'INITIALIZATION_FAILED',
    VALIDATION: 'VALIDATION_FAILED'
  },

  // Module related
  MODULE: {
    INITIALIZATION: 'INITIALIZATION_FAILED',
    REGISTRATION: 'REGISTRATION_FAILED',
    DEPENDENCY: 'DEPENDENCY_ERROR',
    ROUTE: 'ROUTE_ERROR'
  },

  // Service related
  SERVICE: {
    INITIALIZATION: 'INITIALIZATION_FAILED',
    CONFIGURATION: 'CONFIGURATION_ERROR',
    DEPENDENCY: 'DEPENDENCY_ERROR',
    RUNTIME: 'RUNTIME_ERROR'
  },

  // Configuration related
  CONFIG: {
    VALIDATION: 'VALIDATION_FAILED',
    MISSING: 'MISSING_REQUIRED',
    INVALID: 'INVALID_VALUE'
  },

  // Validation related
  VALIDATION: {
    SCHEMA: 'SCHEMA_VALIDATION_FAILED',
    TYPE: 'INVALID_TYPE',
    REQUIRED: 'REQUIRED_FIELD_MISSING'
  },

  // Network related
  NETWORK: {
    REQUEST: 'REQUEST_FAILED',
    RESPONSE: 'RESPONSE_ERROR',
    TIMEOUT: 'REQUEST_TIMEOUT'
  },

  // Authentication related
  AUTH: {
    UNAUTHORIZED: 'UNAUTHORIZED',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN'
  },

  // Authorization related
  ACCESS: {
    FORBIDDEN: 'FORBIDDEN',
    INSUFFICIENT_RIGHTS: 'INSUFFICIENT_RIGHTS',
    RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED'
  }
};

/**
 * Create error instance from error response data
 * @param {Object} response - Error response data
 * @param {string} [defaultMessage] - Default error message
 * @returns {CoreError} Error instance
 */
// export function createErrorFromResponse(response, defaultMessage = 'Unknown error occurred') {
//   const errorData = response.data || response;
  
//   // Map error names to constructors
//   const errorTypes = {
//     AccessError,
//     AuthError,
//     ConfigError,
//     ModuleError,
//     NetworkError,
//     ServiceError,
//     ValidationError,
//     CoreError
//   };

//   // Get appropriate error constructor
//   const ErrorConstructor = errorTypes[errorData.name] || CoreError;

//   return new ErrorConstructor(
//     errorData.code || ErrorCodes.CORE.UNKNOWN,
//     errorData.message || defaultMessage,
//     errorData.details || {},
//     { cause: response }
//   );
// }
export function createErrorFromResponse(response, defaultMessage = 'Unknown error occurred') {
  const errorData = response.data || response;
  
  // Map error names to constructors from ErrorTypes
  const ErrorConstructor = ErrorTypes[errorData.name] || CoreError;

  return new ErrorConstructor(
      errorData.code || ErrorCodes.CORE.UNKNOWN,
      errorData.message || defaultMessage,
      errorData.details || {},
      { cause: response }
  );
}

export default ErrorTypes;
