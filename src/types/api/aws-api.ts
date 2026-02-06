export interface DynamoDBListTablesResponse {
  TableNames: string[];
}

export interface DynamoDBKeySchema {
  AttributeName: string;
  KeyType: 'HASH' | 'RANGE';
}

export interface DynamoDBAttributeDefinition {
  AttributeName: string;
  AttributeType: 'S' | 'N' | 'B';
}

export interface DynamoDBLocalSecondaryIndex {
  IndexName: string;
  KeySchema: DynamoDBKeySchema[];
  Projection: {
    ProjectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE';
    NonKeyAttributes?: string[];
  };
  IndexSizeBytes?: number;
  ItemCount?: number;
}

export interface DynamoDBGlobalSecondaryIndex {
  IndexName: string;
  KeySchema: DynamoDBKeySchema[];
  Projection: {
    ProjectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE';
    NonKeyAttributes?: string[];
  };
  IndexStatus: 'CREATING' | 'UPDATING' | 'DELETING' | 'ACTIVE';
  ProvisionedThroughput?: {
    ReadCapacityUnits: number;
    WriteCapacityUnits: number;
  };
  IndexSizeBytes?: number;
  ItemCount?: number;
}

export interface DynamoDBProvisionedThroughput {
  ReadCapacityUnits: number;
  WriteCapacityUnits: number;
  LastIncreaseDateTime?: string;
  LastDecreaseDateTime?: string;
  NumberOfDecreasesToday?: number;
}

export interface DynamoDBBillingMode {
  BillingMode: 'PROVISIONED' | 'PAY_PER_REQUEST';
  ProvisionedThroughput?: DynamoDBProvisionedThroughput;
}

export interface DynamoDBTableDescription {
  Table: {
    TableName: string;
    ItemCount: number;
    TableSizeBytes: number;
    CreationDateTime: string;
    TableStatus: 'CREATING' | 'UPDATING' | 'DELETING' | 'ACTIVE' | 'INACCESSIBLE_ENCRYPTION_CREDENTIALS' | 'ARCHIVING' | 'ARCHIVED';
    KeySchema: DynamoDBKeySchema[];
    AttributeDefinitions: DynamoDBAttributeDefinition[];
    LocalSecondaryIndexes?: DynamoDBLocalSecondaryIndex[];
    GlobalSecondaryIndexes?: DynamoDBGlobalSecondaryIndex[];
    BillingModeSummary?: DynamoDBBillingMode;
    ProvisionedThroughput?: DynamoDBProvisionedThroughput;
    TableArn?: string;
    TableId?: string;
    StreamSpecification?: {
      StreamEnabled: boolean;
      StreamViewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES';
    };
    LatestStreamLabel?: string;
    LatestStreamArn?: string;
    RestoreSummary?: {
      SourceBackupArn?: string;
      SourceTableArn?: string;
      RestoreDateTime: string;
      RestoreInProgress: boolean;
    };
    SSEDescription?: {
      Status?: 'ENABLING' | 'ENABLED' | 'DISABLING' | 'DISABLED' | 'UPDATING';
      SSEType?: 'AES256' | 'KMS';
      KMSMasterKeyArn?: string;
    };
  };
}

export interface DynamoDBScanResponse {
  Items: Record<string, unknown>[];
  Count: number;
  ScannedCount: number;
  LastEvaluatedKey?: Record<string, unknown>;
}

export interface DynamoDBPutItemRequest {
  TableName: string;
  Item: Record<string, unknown>;
  ConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
}

export interface DynamoDBPutItemResponse {
  ConsumedCapacity?: {
    TableName: string;
    CapacityUnits: number;
  };
}

export interface SQSListQueuesResponse {
  QueueUrls: string[];
}

export interface SQSQueueAttributes {
  Attributes: {
    ApproximateNumberOfMessages: string;
    ApproximateNumberOfMessagesNotVisible: string;
    ApproximateNumberOfMessagesDelayed?: string;
    CreatedTimestamp: string;
    LastModifiedTimestamp: string;
    QueueArn: string;
    ReceiveMessageWaitTimeSeconds: string;
    VisibilityTimeoutSeconds: string;
    MessageRetentionPeriod: string;
    MaxReceiveCount?: string;
  };
}

export interface SQSMessageAttributes {
  StringValue?: string;
  BinaryValue?: string;
  DataType: string;
}

export interface SQSMessage {
  MessageId: string;
  ReceiptHandle: string;
  MD5OfBody: string;
  Body: string;
  MessageAttributes?: Record<string, {
    StringValue?: string;
    BinaryValue?: string;
    DataType: string;
  }>;
  Attributes?: Record<string, string> & {
    ApproximateReceiveCount?: string;
    ApproximateFirstReceiveTimestamp?: string;
    SentTimestamp?: string;
    SenderId?: string;
  };
}

export interface SQSReceiveMessageResponse {
  Messages: SQSMessage[];
}

export interface SQSMessageWithStatus extends SQSMessage {
  status: 'normal' | 'warning' | 'critical' | 'dead-letter';
  receiveCount: number;
  maxReceiveCount?: number;
  isProblematic: boolean;
  ageInQueue: number; // milliseconds
  retryAttempts: number;
}

export interface SQSSendMessageResponse {
  MessageId: string;
  MD5OfMessageBody: string;
  MD5OfMessageAttributes?: string;
  SequenceNumber?: string;
}

export interface SQSDeleteMessageResponse {
  success: boolean;
  synthetic?: boolean;
  message?: string;
}

export interface SQSReceiveMessageFilteredResponse extends SQSReceiveMessageResponse {
  mode: 'available' | 'dlq';
  visibilityTimeout: number;
  timestamp: string;
  totalDLQ?: number;
  totalInFlight?: number;
  synthetic?: boolean;
}

export interface LambdaEnvironment {
  Variables: Record<string, string>;
}

export interface LambdaTracingConfig {
  Mode: 'Active' | 'PassThrough';
}

export interface LambdaFunction {
  FunctionName: string;
  FunctionArn: string;
  Runtime: string;
  Role: string;
  Handler: string;
  CodeSize: number;
  Description: string;
  Timeout: number;
  MemorySize: number;
  LastModified: string;
  CodeSha256: string;
  Version: string;
  Environment: LambdaEnvironment;
  TracingConfig: LambdaTracingConfig;
  RevisionId: string;
  State?: string;
}

export interface LambdaListFunctionsResponse {
  Functions: LambdaFunction[];
}

export interface LambdaGetFunctionResponse {
  Configuration: LambdaFunction;
  Code: {
    RepositoryType: string;
    Location: string;
  };
  Tags: Record<string, string>;
}

export interface LambdaInvocationResponse {
  StatusCode: number;
  ExecutedVersion?: string;
  Payload?: string;
  ResponsePayload?: string;
  LogResult?: string;
  ExecutionDuration?: number;
  BilledDuration?: number;
  MemoryUsed?: number;
}

export interface LogGroup {
  logGroupName: string;
  creationTime: number;
  metricFilterCount: number;
  arn: string;
  storedBytes: number;
  retentionInDays?: number;
}

export interface LogGroupsResponse {
  logGroups: LogGroup[];
}

export interface LogStream {
  logStreamName: string;
  creationTime: number;
  firstEventTime: number;
  lastEventTime: number;
  lastIngestionTime: number;
  uploadSequenceToken: string;
  arn: string;
  storedBytes: number;
}

export interface LogStreamsResponse {
  logStreams: LogStream[];
}

export interface LogEvent {
  timestamp: number;
  message: string;
  ingestionTime?: number;
}

export interface LogEventsResponse {
  events: LogEvent[];
  nextForwardToken?: string;
  nextBackwardToken?: string;
}

export interface MetricDataPoint {
  Timestamp: string;
  Value?: number;
  Sum?: number;
  Average?: number;
  Maximum?: number;
  Minimum?: number;
  Unit?: string;
}

export interface CloudWatchMetrics {
  Invocations: MetricDataPoint[];
  Duration: MetricDataPoint[];
  Errors: MetricDataPoint[];
  Throttles: MetricDataPoint[];
  ConcurrentExecutions: MetricDataPoint[];
}

export interface CloudWatchInsightsField {
  field: string;
  value: string;
}

export interface CloudWatchInsightsResult {
  fields: CloudWatchInsightsField[];
}

export interface CloudWatchInsights {
  results: CloudWatchInsightsResult[];
  statistics?: {
    recordsMatched: number;
    recordsScanned: number;
    bytesScanned: number;
  };
  status: 'Scheduled' | 'Running' | 'Complete' | 'Failed' | 'Cancelled';
}

// S3 types
export interface S3BucketInfo {
  name: string;
  creationDate?: string;
}

export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified?: string;
  storageClass?: string;
}

export interface S3ObjectContent {
  bucket: string;
  key: string;
  content: string;
  contentType?: string;
  size: number;
  isTruncated: boolean;
}

// Secrets Manager types
export interface SecretTag {
  Key: string;
  Value: string;
}

export interface SecretSummary {
  arn: string;
  name: string;
  description?: string;
  tags?: Record<string, string>;
  lastChangedDate?: string;
}

export interface SecretDetail extends SecretSummary {
  secretString?: string;
  versionId?: string;
}