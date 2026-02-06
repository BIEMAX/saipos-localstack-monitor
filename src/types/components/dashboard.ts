// Dashboard component types and interfaces

import type {
  DynamoDBTableDescription,
  LambdaFunction,
  LogGroup,
} from '../api/aws-api';
import type { AnalyticsPlatformToken, TableInfo } from '../domain';
import type { DynamoDBRawItem } from './tables';
import type { BaseComponentProps } from './ui';

export interface ServiceMetricsSectionProps extends BaseComponentProps {
  stats: {
    totalTables: number;
    totalItems: number;
    totalQueues: number;
    totalMessages: number;
    totalFunctions: number;
    totalLogGroups: number;
  };
  onTabChange?: (tab: string) => void;
  loading?: boolean;
}

export interface StoreData {
  storeId: number;
  totalTokens: number;
  activeTokens: number;
  tokens: AnalyticsPlatformToken[];
}

export interface StoreTokensViewProps extends BaseComponentProps {
  stores?: StoreData[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export interface LambdaFunctionDetailsProps extends BaseComponentProps {
  functionName: string;
  functionData: {
    FunctionName: string;
    Runtime?: string;
    Handler?: string;
    CodeSize?: number;
    Timeout?: number;
    MemorySize?: number;
    LastModified?: string;
  };
  onClose?: () => void;
}

export interface LogEvent {
  timestamp: number;
  message: string;
  level?: 'info' | 'warn' | 'error';
  ingestionTime?: number;
}

export interface LogStream {
  logStreamName: string;
  creationTime: number;
  lastEventTimestamp: number;
  storedBytes: number;
}

export interface LambdaLogsViewerProps extends BaseComponentProps {
  functionName?: string;
  autoRefresh?: boolean;
  maxEvents?: number;
  onEventClick?: (event: LogEvent) => void;
}

export interface InvocationResult {
  statusCode: number;
  payload: string;
  executionDuration: number;
  billedDuration: number;
  memoryUsed: number;
  logResult?: string;
}

export interface DebugResult {
  test: string;
  status: 'SUCCESS' | 'FAILED' | 'ERROR';
  details: unknown;
  duration?: number;
  timestamp?: number;
}

export interface DebugTestPanelProps extends BaseComponentProps {
  onTestComplete?: (results: DebugResult[]) => void;
  autoRun?: boolean;
}

export interface TestResults {
  dynamodb: boolean | null;
  sqs: boolean | null;
  lambda?: boolean | null;
  logs: boolean | null;
  s3?: boolean | null;
  secretsManager?: boolean | null;
}

export interface BasicLocalStackDashboardProps extends BaseComponentProps {
  onTabChange?: (tab: string) => void;
}

export interface LambdaFunctionDisplay {
  functionName: string;
  runtime: string;
  status: 'Active' | 'Inactive' | 'Failed';
  lastModified: string;
  memorySize?: number;
  timeout?: number;
  codeSize?: number;
}

export interface QueueInfo {
  url: string;
  name: string;
  attributes?: {
    visibleMessages?: number;
    notVisibleMessages?: number;
    delayedMessages?: number;
  };
}

export interface QueueMetrics {
  visibleMessages: number;
  notVisibleMessages: number;
  delayedMessages: number;
  totalMessages: number;
}

export interface QueueHistoryPoint {
  timestamp: Date;
  visible: number;
  notVisible: number;
  delayed: number;
}

export interface DynamoTable {
  name: string;
  itemCount: number;
  sizeBytes: number;
  creationDateTime?: string;
  status?: 'ACTIVE' | 'CREATING' | 'DELETING' | 'UPDATING';
}

export interface TableInfoPanelProps extends BaseComponentProps {
  tableDetails: DynamoDBTableDescription;
  onClose: () => void;
}

export interface ItemCreatorProps extends BaseComponentProps {
  tableName: string;
  tableSchema: {
    keySchema: Array<{
      AttributeName: string;
      KeyType: 'HASH' | 'RANGE';
    }>;
    attributeDefinitions: Array<{
      AttributeName: string;
      AttributeType: 'S' | 'N' | 'B';
    }>;
  };
  onItemCreated: (item: DynamoDBRawItem) => void;
  onCancel: () => void;
}

export interface DynamoFormField {
  name: string;
  type: 'S' | 'N' | 'B' | 'BOOL' | 'SS' | 'NS' | 'M' | 'L';
  required: boolean;
  isKey: boolean;
  keyType?: 'HASH' | 'RANGE';
  value?: string;
  placeholder?: string;
  description?: string;
}

export interface LambdaSectionProps extends BaseComponentProps {
  functions: LambdaFunction[];
  isServiceAvailable: boolean;
  onFunctionClick?: (functionName: string) => void;
}

export interface LogsSectionProps extends BaseComponentProps {
  logGroups: LogGroup[];
  isServiceAvailable: boolean;
  onLogGroupClick?: (logGroup: string) => void;
}

export interface DynamoDBSectionProps extends BaseComponentProps {
  tables: TableInfo[];
  isServiceAvailable: boolean;
  onTableClick?: (tableName: string) => void;
}