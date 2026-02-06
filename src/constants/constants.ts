// Application constants

// API URLs
export const API_BASE_URL = 'http://localhost:3006/api';
export const LOCALSTACK_URL = 'http://localhost:4566';
export const HEALTH_CHECK_URL = 'http://localhost:3006/health';
export const TEST_LOCALSTACK_URL = 'http://localhost:3006/test-localstack';
export const LOCALSTACK_HEALTH_URL = 'http://localhost:4566/_localstack/health';

// Refresh intervals
export const DEFAULT_REFRESH_INTERVAL = 10000; // 10 seconds
export const MIN_REFRESH_INTERVAL = 5000; // 5 seconds
export const MAX_REFRESH_INTERVAL = 60000; // 1 minute

// Colors for charts and UI
export const CHART_COLORS = {
  blue: '#3B82F6',
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
} as const;

// Default values
export const DEFAULT_TABLE_ITEM_COUNT = 0;
export const DEFAULT_TABLE_SIZE_BYTES = 0;
export const DEFAULT_LAMBDA_MEMORY_SIZE = 512;
export const DEFAULT_LAMBDA_TIMEOUT = 30;

// AWS Service names
export const AWS_SERVICES = {
  DYNAMODB: 'DynamoDB',
  SQS: 'SQS',
  LAMBDA: 'Lambda',
  CLOUDWATCH_LOGS: 'CloudWatch Logs',
} as const;

// LocalStack status types (can be used alongside ConnectionState)
export const LOCALSTACK_STATUS = {
  CHECKING: 'checking',
  OFFLINE: 'offline',
  ONLINE: 'online',
  EMPTY: 'empty',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  LOCALSTACK_NOT_RESPONDING: 'LocalStack não está respondendo. Verifique se o serviço está ativo.',
  FAILED_TO_CONNECT: 'Não foi possível conectar ao servidor LocalStack.',
  SERVICES_UNAVAILABLE: 'Serviços AWS indisponíveis no momento.',
  CONNECTION_PROBLEMS: 'Problema na conexão com os serviços AWS.',
} as const;

// Connection status messages and configurations
export const CONNECTION_MESSAGES = {
  CONNECTED: 'Connected to LocalStack',
  DISCONNECTED: 'Disconnected from LocalStack',
  CHECKING: 'Checking LocalStack...',
  ERROR: 'LocalStack Issues',
} as const;

export const CONNECTION_STATUS_CONFIG = {
  connected: {
    text: CONNECTION_MESSAGES.CONNECTED,
    color: 'bg-green-500',
  },
  checking: {
    text: CONNECTION_MESSAGES.CHECKING,
    color: 'bg-blue-500',
  },
  error: {
    text: CONNECTION_MESSAGES.ERROR,
    color: 'bg-orange-500',
  },
  disconnected: {
    text: CONNECTION_MESSAGES.DISCONNECTED,
    color: 'bg-red-500',
  },
} as const;