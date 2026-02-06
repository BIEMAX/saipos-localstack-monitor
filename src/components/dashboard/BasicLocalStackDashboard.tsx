import { Activity, AlertCircle, Box, Database, Eye, FileText, KeyRound, MessageSquare, RefreshCw, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useGlobalRefresh, usePageRefresh } from '../../hooks/useGlobalRefresh';
import { LocalStackApiService } from '../../services/localstack-api';
import { S3Service, SecretsManagerService } from '../../services/aws';
import type { LogEvent, ServiceStats } from '../../types';
import { formatBytes, formatTimestamp } from '../../utils';
import { MetricCard } from '../shared/MetricCard';

interface BasicLocalStackDashboardProps {
  onTabChange?: (tab: string) => void;
}

export function BasicLocalStackDashboard({ onTabChange }: BasicLocalStackDashboardProps) {
  const [stats, setStats] = useState<ServiceStats>({
    dynamodb: { tables: [], totalTables: 0, totalItems: 0 },
    sqs: { queues: [], totalQueues: 0, totalVisibleMessages: 0, totalNotVisibleMessages: 0 },
    lambda: { functions: [], totalFunctions: 0, totalSize: 0 },
    logs: { logGroups: [], totalGroups: 0, totalStoredBytes: 0 },
    connected: false,
    lastUpdated: new Date()
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [selectedLogGroup, setSelectedLogGroup] = useState<string | null>(null);
  const [logEvents, setLogEvents] = useState<LogEvent[]>([]);
  const [serviceAvailability, setServiceAvailability] = useState({
    dynamodb: false,
    sqs: false,
    lambda: false,
    logs: false,
    s3: false,
    secretsManager: false,
  });
  const [s3BucketsCount, setS3BucketsCount] = useState(0);
  const [secretsCount, setSecretsCount] = useState(0);
  const [localstackStatus, setLocalstackStatus] = useState<'checking' | 'offline' | 'online' | 'empty'>('checking');

  const checkServiceAvailability = useCallback(async () => {
    const [dynamodb, sqs, lambda, logs, s3, secretsManager] = await Promise.all([
      LocalStackApiService.isDynamoDBAvailable(),
      LocalStackApiService.isSQSAvailable(),
      LocalStackApiService.isLambdaAvailable(),
      LocalStackApiService.isCloudWatchLogsAvailable(),
      S3Service.isAvailable(),
      SecretsManagerService.isAvailable(),
    ]);

    setServiceAvailability({ dynamodb, sqs, lambda, logs, s3, secretsManager });

    const availableServices = [dynamodb, sqs, lambda, logs, s3, secretsManager].filter(Boolean).length;

    if (availableServices === 0) {
      setLocalstackStatus('offline');
    } else {
      setLocalstackStatus('online');
    }

    return { dynamodb, sqs, lambda, logs, s3, secretsManager };
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setError(null);
      const availability = await checkServiceAvailability();
      const [serviceStats, buckets, secrets] = await Promise.all([
        LocalStackApiService.getServiceStats(),
        availability.s3 ? S3Service.listBuckets() : Promise.resolve([]),
        availability.secretsManager ? SecretsManagerService.listSecrets() : Promise.resolve([]),
      ]);
      setStats(serviceStats);
      setS3BucketsCount(buckets?.length ?? 0);
      setSecretsCount(secrets?.length ?? 0);

      const hasAnyData = serviceStats.dynamodb.totalTables > 0 ||
                        serviceStats.sqs.totalQueues > 0 ||
                        serviceStats.lambda.totalFunctions > 0 ||
                        serviceStats.logs.totalGroups > 0 ||
                        (buckets?.length ?? 0) > 0 ||
                        (secrets?.length ?? 0) > 0;

      if (Object.values(availability).some(Boolean) && !hasAnyData) {
        setLocalstackStatus('empty');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load LocalStack stats');
      setStats(prev => ({
        ...prev,
        connected: false,
        dynamodb: { tables: [], totalTables: 0, totalItems: 0 },
        sqs: { queues: [], totalQueues: 0, totalVisibleMessages: 0, totalNotVisibleMessages: 0 },
        lambda: { functions: [], totalFunctions: 0, totalSize: 0 },
        logs: { logGroups: [], totalGroups: 0, totalStoredBytes: 0 }
      }));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [checkServiceAvailability]);

  const { connectionStatus } = useGlobalRefresh();

  usePageRefresh('overview-dashboard', loadStats);

  useEffect(() => {
    setLocalstackStatus('checking');
    loadStats();
  }, [loadStats]);

  const loadTableData = async (tableName: string) => {
    try {
      setSelectedTable(tableName);
      const data = await LocalStackApiService.scanTable(tableName, 10);
      setTableData(data);
    } catch (error) {
      console.error(`Failed to load data for table ${tableName}:`, error);
      setTableData([]);
    }
  };

  const loadLogEvents = async (logGroupName: string) => {
    try {
      setSelectedLogGroup(logGroupName);
      const events = await LocalStackApiService.getLogEvents(logGroupName);
      setLogEvents(events);
    } catch (error) {
      console.error(`Failed to load log events for group ${logGroupName}:`, error);
      setLogEvents([]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
          <button
            onClick={loadStats}
            className="mt-2 btn-primary text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {localstackStatus === 'checking' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-3"></div>
            <div>
              <h3 className="text-gray-800 font-medium">Verificando LocalStack...</h3>
              <p className="text-gray-600 text-sm">
                Conectando aos serviços AWS e verificando disponibilidade.
              </p>
            </div>
          </div>
        </div>
      )}

      {localstackStatus === 'offline' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 font-medium">LocalStack Offline</h3>
              <p className="text-red-700 text-sm mt-1">
                O LocalStack não está respondendo. Verifique se está rodando e tente novamente.
              </p>
              <div className="mt-3">
                <button
                  onClick={loadStats}
                  className="btn-primary text-sm"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Tentar Novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {localstackStatus === 'empty' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-blue-800 font-medium">LocalStack Vazio</h3>
              <p className="text-blue-700 text-sm mt-1">
                O LocalStack está rodando, mas ainda não possui recursos criados. Para começar:
              </p>
              <ul className="text-blue-700 text-sm mt-2 ml-4 space-y-1">
                <li>• Crie tabelas DynamoDB usando a CLI ou SDK</li>
                <li>• Configure filas SQS para processamento de mensagens</li>
                <li>• Implante funções Lambda para automação</li>
                <li>• Execute suas aplicações para gerar logs no CloudWatch</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {localstackStatus === 'online' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <Activity className="w-5 h-5 text-green-600 mr-3" />
            <div>
              <h3 className="text-green-800 font-medium">LocalStack Ativo</h3>
              <p className="text-green-700 text-sm">
                LocalStack está rodando com {Object.values(serviceAvailability).filter(Boolean).length} serviços disponíveis e recursos configurados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Service Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="DynamoDB Tables"
          value={serviceAvailability.dynamodb ? stats.dynamodb.totalTables : "N/A"}
          subtitle={serviceAvailability.dynamodb ? `${stats.dynamodb.totalItems} items total` : "Serviço indisponível"}
          icon={Database}
          color={serviceAvailability.dynamodb ? "blue" : "gray"}
          onClick={serviceAvailability.dynamodb ? () => onTabChange?.('tokens') : undefined}
        />

        <MetricCard
          title="SQS Queues"
          value={serviceAvailability.sqs ? stats.sqs.totalQueues : "N/A"}
          subtitle={serviceAvailability.sqs ? `${stats.sqs.totalVisibleMessages} mensagens visíveis` : "Serviço indisponível"}
          icon={MessageSquare}
          color={serviceAvailability.sqs ? "green" : "gray"}
          onClick={serviceAvailability.sqs ? () => onTabChange?.('queue') : undefined}
        />

        <MetricCard
          title="S3 Buckets"
          value={serviceAvailability.s3 ? s3BucketsCount : "N/A"}
          subtitle={serviceAvailability.s3 ? "buckets" : "Serviço indisponível"}
          icon={Box}
          color={serviceAvailability.s3 ? "blue" : "gray"}
          onClick={serviceAvailability.s3 ? () => onTabChange?.('storage') : undefined}
        />

        <MetricCard
          title="Secrets Manager"
          value={serviceAvailability.secretsManager ? secretsCount : "N/A"}
          subtitle={serviceAvailability.secretsManager ? "segredos" : "Serviço indisponível"}
          icon={KeyRound}
          color={serviceAvailability.secretsManager ? "purple" : "gray"}
          onClick={serviceAvailability.secretsManager ? () => onTabChange?.('secrets') : undefined}
        />

        <MetricCard
          title="Lambda Functions"
          value={serviceAvailability.lambda ? stats.lambda.totalFunctions : "N/A"}
          subtitle={serviceAvailability.lambda ? formatBytes(stats.lambda.totalSize) : "Serviço indisponível"}
          icon={Zap}
          color={serviceAvailability.lambda ? "purple" : "gray"}
          onClick={serviceAvailability.lambda ? () => onTabChange?.('logs') : undefined}
        />

        <MetricCard
          title="Log Groups"
          value={serviceAvailability.logs ? stats.logs.totalGroups : "N/A"}
          subtitle={serviceAvailability.logs ? formatBytes(stats.logs.totalStoredBytes) : "Serviço indisponível"}
          icon={FileText}
          color={serviceAvailability.logs ? "yellow" : "gray"}
          onClick={serviceAvailability.logs ? () => onTabChange?.('logs') : undefined}
        />
      </div>

      {/* SQS Queue Details */}
      {serviceAvailability.sqs && stats.sqs.queues.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">SQS Queues</h3>
          <div className="space-y-3">
            {stats.sqs.queues.map((queue, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-gray-900">{queue.name}</div>
                    <div className="text-sm text-gray-500 truncate max-w-md">
                      {queue.url}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-green-600">{queue.visibleMessages}</div>
                    <div className="text-gray-500">Visíveis</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-purple-600">{queue.notVisibleMessages}</div>
                    <div className="text-gray-500">Processando</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DynamoDB Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">DynamoDB Tables</h3>
          {serviceAvailability.dynamodb && stats.dynamodb.tables.length > 0 ? (
            <div className="space-y-2">
              {stats.dynamodb.tables.map((table, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Database className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">{table.name}</div>
                      <div className="text-sm text-gray-500">
                        {table.itemCount} items • {formatBytes(table.sizeBytes)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => loadTableData(table.name)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : serviceAvailability.dynamodb ? (
            <div className="text-center py-4 text-gray-500">
              Nenhuma tabela encontrada
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              Serviço DynamoDB indisponível
            </div>
          )}
        </div>

        {/* Table Data Viewer */}
        {selectedTable && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Dados da Tabela: {selectedTable}
            </h3>
            {tableData.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tableData.map((item, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                    <pre className="text-gray-700 overflow-x-auto">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Nenhum item encontrado
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lambda Functions and Log Groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lambda Functions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lambda Functions</h3>
          {serviceAvailability.lambda && stats.lambda.functions.length > 0 ? (
            <div className="space-y-2">
              {stats.lambda.functions.map((func, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Zap className="w-4 h-4 text-purple-600" />
                    <div>
                      <div className="font-medium text-gray-900">{func.FunctionName}</div>
                      <div className="text-sm text-gray-500">
                        {func.Runtime} • {formatBytes(func.CodeSize)} • {func.State}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : serviceAvailability.lambda ? (
            <div className="text-center py-4 text-gray-500">
              Nenhuma função encontrada
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              Serviço Lambda indisponível
            </div>
          )}
        </div>

        {/* Log Groups */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">CloudWatch Log Groups</h3>
          {serviceAvailability.logs && stats.logs.logGroups.length > 0 ? (
            <div className="space-y-2">
              {stats.logs.logGroups.map((group, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-orange-600" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 truncate">{group.logGroupName}</div>
                      <div className="text-sm text-gray-500">
                        {formatBytes(group.storedBytes)} • {group.metricFilterCount} filters
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => loadLogEvents(group.logGroupName)}
                    className="text-orange-600 hover:text-orange-800 p-1"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : serviceAvailability.logs ? (
            <div className="text-center py-4 text-gray-500">
              Nenhum log group encontrado
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              Serviço CloudWatch Logs indisponível
            </div>
          )}
        </div>
      </div>

      {/* Log Events Viewer */}
      {selectedLogGroup && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Log Events: {selectedLogGroup}
          </h3>
          {logEvents.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logEvents.map((event, index) => (
                <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="text-gray-500 mb-1">
                    {formatTimestamp(event.timestamp)}
                  </div>
                  <div className="text-gray-700 font-mono">
                    {event.message}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              Nenhum log encontrado
            </div>
          )}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{connectionStatus === 'connected' ? 'Conectado ao LocalStack' : 'Desconectado do LocalStack'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}