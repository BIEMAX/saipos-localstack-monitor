import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { LocalStackApiService } from '../../services/localstack-api';

export function ConnectionTest() {
  const [testResults, setTestResults] = useState<{
    dynamodb: boolean | null;
    sqs: boolean | null;
    logs: boolean | null;
  }>({
    dynamodb: null,
    sqs: null,
    logs: null,
  });

  const [details, setDetails] = useState<{
    tables: string[];
    queues: string[];
    tokens: number;
  }>({
    tables: [],
    queues: [],
    tokens: 0,
  });

  const [testing, setTesting] = useState(false);

  const testConnections = async () => {
    setTesting(true);
    const results = { dynamodb: false, sqs: false, logs: false };
    const newDetails: { tables: string[]; queues: string[]; tokens: number } = { tables: [], queues: [], tokens: 0 };

    try {
      // Test DynamoDB
      try {
        const dynamoStats = await LocalStackApiService.getDynamoDBStats();
        results.dynamodb = true;
        newDetails.tables = dynamoStats.tables.map(t => t.name);
        newDetails.tokens = dynamoStats.totalItems;
      } catch (error) {
        console.error('DynamoDB test failed:', error);
        results.dynamodb = false;
      }

      // Test SQS
      try {
        const sqsStats = await LocalStackApiService.getSQSStats();
        results.sqs = true;
        newDetails.queues = sqsStats.queues.map(q => q.name);
      } catch (error) {
        console.error('SQS test failed:', error);
        results.sqs = false;
      }

      // Test CloudWatch Logs
      try {
        await LocalStackApiService.getCloudWatchLogsStats();
        results.logs = true;
      } catch (error) {
        console.error('CloudWatch Logs test failed:', error);
        results.logs = false;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      results.dynamodb = false;
      results.sqs = false;
      results.logs = false;
    }

    setTestResults(results);
    setDetails(newDetails);
    setTesting(false);
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <div className="w-5 h-5 bg-gray-300 rounded-full" />;
    if (status) return <CheckCircle className="w-5 h-5 text-green-500" />;
    return <AlertCircle className="w-5 h-5 text-red-500" />;
  };

  const getStatusText = (status: boolean | null) => {
    if (status === null) return 'Not tested';
    if (status) return 'Connected';
    return 'Failed';
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Connection Test</h2>
        <button
          onClick={testConnections}
          disabled={testing}
          className="btn-primary flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
          <span>{testing ? 'Testing...' : 'Test Connections'}</span>
        </button>
      </div>

      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              {getStatusIcon(testResults.dynamodb)}
              <span className="font-medium">DynamoDB</span>
            </div>
            <span className="text-sm text-gray-600">{getStatusText(testResults.dynamodb)}</span>
          </div>
          {details.tables.length > 0 && (
            <div className="text-xs text-gray-500">
              <div>Tables: {details.tables.join(', ')}</div>
              {details.tokens > 0 && <div>Tokens: {details.tokens}</div>}
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              {getStatusIcon(testResults.sqs)}
              <span className="font-medium">SQS</span>
            </div>
            <span className="text-sm text-gray-600">{getStatusText(testResults.sqs)}</span>
          </div>
          {details.queues.length > 0 && (
            <div className="text-xs text-gray-500">
              Queues: {details.queues.map(q => q.split('/').pop()).join(', ')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div className="flex items-center space-x-3">
            {getStatusIcon(testResults.logs)}
            <span className="font-medium">CloudWatch Logs</span>
          </div>
          <span className="text-sm text-gray-600">{getStatusText(testResults.logs)}</span>
        </div>
      </div>

      {/* Troubleshooting Tips */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Troubleshooting Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Ensure LocalStack is running: <code className="bg-blue-100 px-1 rounded">curl http://localhost:4566/_localstack/health</code></li>
          <li>• Check if analytics system is active: <code className="bg-blue-100 px-1 rounded">npm start</code> in saipos-backend-template</li>
          <li>• If connections fail, the dashboard will use mock data for demonstration</li>
        </ul>
      </div>
    </div>
  );
}