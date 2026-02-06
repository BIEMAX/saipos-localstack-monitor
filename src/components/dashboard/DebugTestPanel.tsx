import { AlertCircle, Bug, CheckCircle, Eye, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { LocalStackApiService } from '../../services/localstack-api';
import { S3Service, SecretsManagerService } from '../../services/aws';
import { HEALTH_CHECK_URL, TEST_LOCALSTACK_URL } from '../../constants';
import type { DebugResult, TestResults } from '../../types';

export function DebugTestPanel() {
  const [debugResults, setDebugResults] = useState<DebugResult[]>([]);

  const [testResults, setTestResults] = useState<TestResults>({
    dynamodb: null,
    sqs: null,
    logs: null,
    s3: null,
    secretsManager: null,
  });

  const [details, setDetails] = useState<{
    tables: string[];
    queues: string[];
    tokens: number;
    buckets: string[];
    secretsCount: number;
  }>({
    tables: [],
    queues: [],
    tokens: 0,
    buckets: [],
    secretsCount: 0,
  });

  const [debugTesting, setDebugTesting] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);

  const runDebugTests = async () => {
    setDebugTesting(true);
    const results: DebugResult[] = [];

    // Test 1: API Server connectivity
    try {
      const response = await fetch(HEALTH_CHECK_URL);
      const data = await response.json();
      results.push({
        test: 'API Server Health',
        status: response.ok ? 'SUCCESS' : 'FAILED',
        details: data
      });
    } catch (error) {
      results.push({
        test: 'API Server Health',
        status: 'ERROR',
        details: error as Record<string, unknown>
      });
    }

    // Test 2: LocalStack connectivity
    try {
      const response = await fetch(TEST_LOCALSTACK_URL);
      const data = await response.json();
      results.push({
        test: 'LocalStack Connection',
        status: data.connected ? 'SUCCESS' : 'FAILED',
        details: data
      });
    } catch (error) {
      results.push({
        test: 'LocalStack Connection',
        status: 'ERROR',
        details: error as Record<string, unknown>
      });
    }

    // Test 3: DynamoDB Service
    try {
      const dynamoStats = await LocalStackApiService.getDynamoDBStats();
      results.push({
        test: 'DynamoDB Service',
        status: 'SUCCESS',
        details: {
          totalTables: dynamoStats.totalTables,
          totalItems: dynamoStats.totalItems,
          tables: dynamoStats.tables.map(t => t.name)
        }
      });
    } catch (error) {
      results.push({
        test: 'DynamoDB Service',
        status: 'ERROR',
        details: error as Record<string, unknown>
      });
    }

    // Test 4: SQS Service
    try {
      const sqsStats = await LocalStackApiService.getSQSStats();
      results.push({
        test: 'SQS Service',
        status: 'SUCCESS',
        details: {
          totalQueues: sqsStats.totalQueues,
          totalVisibleMessages: sqsStats.totalVisibleMessages,
          queues: sqsStats.queues.map(q => q.name)
        }
      });
    } catch (error) {
      results.push({
        test: 'SQS Service',
        status: 'ERROR',
        details: error as Record<string, unknown>
      });
    }

    // Test 5: CloudWatch Logs Service
    try {
      const logsStats = await LocalStackApiService.getCloudWatchLogsStats();
      results.push({
        test: 'CloudWatch Logs Service',
        status: 'SUCCESS',
        details: {
          totalGroups: logsStats.totalGroups,
          totalStoredBytes: logsStats.totalStoredBytes,
          logGroups: logsStats.logGroups.map(g => g.logGroupName)
        }
      });
    } catch (error) {
      results.push({
        test: 'CloudWatch Logs Service',
        status: 'ERROR',
        details: error as Record<string, unknown>
      });
    }

    // Test 6: S3 Service
    try {
      const buckets = await S3Service.listBuckets();
      results.push({
        test: 'S3 Service',
        status: 'SUCCESS',
        details: {
          totalBuckets: buckets.length,
          buckets: buckets.map(b => b.name)
        }
      });
    } catch (error) {
      results.push({
        test: 'S3 Service',
        status: 'ERROR',
        details: error as Record<string, unknown>
      });
    }

    // Test 7: Secrets Manager Service
    try {
      const secrets = await SecretsManagerService.listSecrets();
      const list = secrets ?? [];
      results.push({
        test: 'Secrets Manager Service',
        status: 'SUCCESS',
        details: {
          totalSecrets: list.length,
          secretNames: list.map(s => s.name)
        }
      });
    } catch (error) {
      results.push({
        test: 'Secrets Manager Service',
        status: 'ERROR',
        details: error as Record<string, unknown>
      });
    }

    setDebugResults(results);
    setDebugTesting(false);
  };

  const testConnections = async () => {
    setConnectionTesting(true);
    const results: TestResults = {
      dynamodb: false,
      sqs: false,
      logs: false,
      s3: false,
      secretsManager: false,
    };
    const newDetails = {
      tables: [] as string[],
      queues: [] as string[],
      tokens: 0,
      buckets: [] as string[],
      secretsCount: 0,
    };

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

      // Test S3
      try {
        const buckets = await S3Service.listBuckets();
        results.s3 = true;
        newDetails.buckets = buckets.map(b => b.name);
      } catch (error) {
        console.error('S3 test failed:', error);
        results.s3 = false;
      }

      // Test Secrets Manager
      try {
        const secrets = await SecretsManagerService.listSecrets();
        results.secretsManager = true;
        newDetails.secretsCount = secrets?.length ?? 0;
      } catch (error) {
        console.error('Secrets Manager test failed:', error);
        results.secretsManager = false;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      results.dynamodb = false;
      results.sqs = false;
      results.logs = false;
      results.s3 = false;
      results.secretsManager = false;
    }

    setTestResults(results);
    setDetails(newDetails);
    setConnectionTesting(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-600 bg-green-50';
      case 'FAILED': return 'text-red-600 bg-red-50';
      case 'ERROR': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <div className="w-5 h-5 bg-gray-300 rounded-full" />;
    if (status) return <CheckCircle className="w-5 h-5 text-green-500" />;
    return <AlertCircle className="w-5 h-5 text-red-500" />;
  };

  const getStatusText = (status: boolean | null) => {
    if (status === null) return 'Não testado';
    if (status) return 'Conectado';
    return 'Falhou';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bug className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Debug & Testes</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Tests */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Teste de Conexões</h3>
            <button
              onClick={testConnections}
              disabled={connectionTesting}
              className="btn-primary flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${connectionTesting ? 'animate-spin' : ''}`} />
              <span>{connectionTesting ? 'Testando...' : 'Testar Conexões'}</span>
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
                  <div>Tabelas: {details.tables.join(', ')}</div>
                  {details.tokens > 0 && <div>Items: {details.tokens}</div>}
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
                  Filas: {details.queues.map(q => q.split('/').pop()).join(', ')}
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

            <div className="p-3 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(testResults.s3 ?? null)}
                  <span className="font-medium">S3</span>
                </div>
                <span className="text-sm text-gray-600">{getStatusText(testResults.s3 ?? null)}</span>
              </div>
              {details.buckets.length > 0 && (
                <div className="text-xs text-gray-500">
                  Buckets: {details.buckets.join(', ')}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(testResults.secretsManager ?? null)}
                  <span className="font-medium">Secrets Manager</span>
                </div>
                <span className="text-sm text-gray-600">{getStatusText(testResults.secretsManager ?? null)}</span>
              </div>
              {details.secretsCount > 0 && (
                <div className="text-xs text-gray-500">
                  Segredos: {details.secretsCount}
                </div>
              )}
            </div>
          </div>

          {/* Troubleshooting Tips */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Dicas de Solução:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Verificar se LocalStack está rodando: <code className="bg-blue-100 px-1 rounded">curl http://localhost:4566/_localstack/health</code></li>
              <li>• Verificar se API Server está ativo: <code className="bg-blue-100 px-1 rounded">curl http://localhost:3006/health</code></li>
            </ul>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Debug de Serviços</h3>
            <button
              onClick={runDebugTests}
              disabled={debugTesting}
              className="btn-primary flex items-center space-x-2"
            >
              <Play className={`w-4 h-4 ${debugTesting ? 'animate-spin' : ''}`} />
              <span>{debugTesting ? 'Executando...' : 'Executar Debug'}</span>
            </button>
          </div>

          {debugResults.length > 0 && (
            <div className="space-y-4">
              {debugResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{result.test}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.status)}`}>
                      {result.status}
                    </span>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 flex items-center">
                      <Eye className="w-3 h-3 mr-1" />
                      Ver Detalhes
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                      <pre className="whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}

          {debugResults.length === 0 && !debugTesting && (
            <div className="text-center py-8 text-gray-500">
              <Play className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p>Clique em "Executar Debug" para verificar os serviços</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}