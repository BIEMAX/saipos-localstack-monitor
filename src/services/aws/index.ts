// Consolidated exports for AWS services
export { BaseAWSService } from './base';
export { DynamoDBService } from './dynamodb';
export { SQSService } from './sqs';
export { LambdaService } from './lambda';
export { CloudWatchService } from './cloudwatch';
export { ConnectionService } from './connection';
export { S3Service } from './s3';
export { SecretsManagerService } from './secretsmanager';

// Re-export the main service stats method for backward compatibility
export { ConnectionService as LocalStackApiService } from './connection';