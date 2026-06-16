// @Refract/sdk - User-facing instrumentation library

// Main SDK class
export { Refract, initRefract, getRefract } from './refract';

// Semantic conventions for LLM operations
export * as SemanticConventions from './semantic-conventions';

// Re-export OpenTelemetry types for convenience
export type { Span, Tracer } from '@opentelemetry/api';

// Re-export types for user convenience
export type { Trace, Alert, IngestRequest, IngestResponse, SdkConfig } from './types';
