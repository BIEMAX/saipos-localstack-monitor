import { Activity, AlertCircle, CheckCircle, Clock, Database, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DynamoDBService } from '../../services/dynamodb';
import { LocalStackDirectService } from '../../services/localstack-direct';
import { SQSService } from '../../services/sqs';
import type { DashboardMetrics, QueueStats } from '../../types';
import { MetricCard } from '../shared/MetricCard';

export function OverviewDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalTokens: 0,
    activeTokens: 0,
    totalEvents: 0,
    successfulEvents: 0,
    failedEvents: 0,
    processingRate: 0,
  });

  const [queueStats, setQueueStats] = useState<QueueStats>({
    visibleMessages: 0,
    notVisibleMessages: 0,
    totalMessages: 0,
    lastUpdated: new Date(),
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000); 
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);

      let tokens: { isActive: boolean;
  platform: string;
  idStore: number}[] = [];
      let queueData = {
        visibleMessages: 0,
        notVisibleMessages: 0,
        totalMessages: 0,
        lastUpdated: new Date(),
      };

      try {
        const [tokensResult, queueResult] = await Promise.all([
          DynamoDBService.getAllTokens(),
          SQSService.getQueueStats(),
        ]);
        tokens = tokensResult;
        queueData = queueResult;
        setIsConnected(true);
      } catch (apiError) {
        console.warn('AWS SDK failed, trying direct LocalStack API:', apiError);

        try {
          const isConnected = await LocalStackDirectService.testConnection();

          if (isConnected) {
            const [tableItems, queues] = await Promise.all([
              LocalStackDirectService.scanDynamoTable('user-analytics-events-platform-tokens'),
              LocalStackDirectService.getSQSQueues(),
            ]);

            tokens = tableItems.map((item: { isActive?: { BOOL: boolean }, platform?: { S: string }, idStore?: { N: string } }) => ({
              isActive: item.isActive?.BOOL ?? true,
              platform: item.platform?.S ?? 'unknown',
              idStore: parseInt(item.idStore?.N ?? '0'),
            }));

            if (queues.length > 0) {
              const queueUrl = queues.find(q => q.includes('user-analytics-events-events.fifo')) || queues[0];
              const attributes = await LocalStackDirectService.getQueueAttributes(queueUrl);

              queueData = {
                visibleMessages: attributes.ApproximateNumberOfMessages,
                notVisibleMessages: attributes.ApproximateNumberOfMessagesNotVisible,
                totalMessages: attributes.ApproximateNumberOfMessages + attributes.ApproximateNumberOfMessagesNotVisible,
                lastUpdated: new Date(),
              };
            }

            setIsConnected(true);
          } else {
            throw new Error('LocalStack not available');
          }
        } catch (directApiError) {
          console.warn('Direct API also failed, using mock data:', directApiError);

          tokens = [
            { isActive: true, platform: 'meta', idStore: 123 },
            { isActive: true, platform: 'google', idStore: 123 },
            { isActive: true, platform: 'tiktok', idStore: 123 },
            { isActive: false, platform: 'meta', idStore: 124 },
          ];
          queueData = {
            visibleMessages: 0,
            notVisibleMessages: 0,
            totalMessages: 0,
            lastUpdated: new Date(),
          };
          setIsConnected(false);
        }
      }

      const totalTokens = tokens.length;
      const activeTokens = tokens.filter(token => token.isActive).length;

      setMetrics({
        totalTokens,
        activeTokens,
        totalEvents: queueData.totalMessages + (isConnected ? 0 : Math.floor(Math.random() * 100)), // Only mock when not connected
        successfulEvents: isConnected ? 0 : Math.floor(Math.random() * 90),
        failedEvents: isConnected ? 0 : Math.floor(Math.random() * 10),
        processingRate: queueData.notVisibleMessages > 0 ? queueData.notVisibleMessages * 2 : 0,
      });

      setQueueStats(queueData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
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
            onClick={loadDashboardData}
            className="mt-2 btn-primary text-sm"
          >
            Retry
          </button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
            <p className="font-medium text-yellow-800">Connection Issues</p>
          </div>
          <p className="text-yellow-700 text-sm mb-3">
            The dashboard cannot connect to LocalStack. This is normal if LocalStack is not running or there are CORS issues.
          </p>
          <div className="text-sm text-yellow-700">
            <p className="font-medium mb-1">Quick fixes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ensure LocalStack is running: <code className="bg-yellow-100 px-1 rounded">curl http://localhost:4566/_localstack/health</code></li>
              <li>Start the analytics system: <code className="bg-yellow-100 px-1 rounded">npm start</code> in saipos-backend-template</li>
              <li>Check the "Logs" tab for connection testing</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Tokens"
          value={metrics.totalTokens}
          subtitle="Platform tokens"
          icon={Database}
          color="blue"
        />

        <MetricCard
          title="Active Tokens"
          value={metrics.activeTokens}
          subtitle={`${metrics.totalTokens > 0 ? Math.round((metrics.activeTokens / metrics.totalTokens) * 100) : 0}% of total`}
          icon={CheckCircle}
          color="green"
        />

        <MetricCard
          title="Queue Messages"
          value={queueStats.visibleMessages}
          subtitle="Waiting to process"
          icon={MessageSquare}
          color="yellow"
        />

        <MetricCard
          title="Processing"
          value={queueStats.notVisibleMessages}
          subtitle="Being processed"
          icon={Clock}
          color="purple"
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Events"
          value={metrics.totalEvents}
          subtitle="All time processed"
          icon={Activity}
          color="blue"
        />

        <MetricCard
          title="Processing Rate"
          value={`${metrics.processingRate}/min`}
          subtitle="Current rate"
          icon={Activity}
          color="green"
        />

        <MetricCard
          title="Queue Total"
          value={queueStats.totalMessages}
          subtitle="All messages"
          icon={MessageSquare}
          color="gray"
        />

        <MetricCard
          title="Connection"
          value={isConnected ? "Live" : "Mock"}
          subtitle={isConnected ? "LocalStack" : "Offline data"}
          icon={isConnected ? CheckCircle : AlertCircle}
          color={isConnected ? "green" : "yellow"}
        />
      </div>

      {/* Real-time Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue Status */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Visible Messages:</span>
              <span className="font-medium text-yellow-600">{queueStats.visibleMessages}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Processing Messages:</span>
              <span className="font-medium text-purple-600">{queueStats.notVisibleMessages}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total in Queue:</span>
              <span className="font-medium text-blue-600">{queueStats.totalMessages}</span>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Last Updated:</span>
                <span className="text-gray-500">
                  {queueStats.lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Distribution</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">Meta</span>
              </div>
              <span className="font-medium">{Math.floor(metrics.activeTokens / 3)} tokens</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">Google</span>
              </div>
              <span className="font-medium">{Math.floor(metrics.activeTokens / 3)} tokens</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-gray-600">TikTok</span>
              </div>
              <span className="font-medium">{Math.floor(metrics.activeTokens / 3)} tokens</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>{isConnected ? 'Connected to LocalStack' : 'Using Mock Data'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Auto-refreshing every 5 seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
}