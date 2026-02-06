import { useState } from 'react';
import saiposLogo from './assets/logo.png';
import { BasicLocalStackDashboard } from './components/dashboard/BasicLocalStackDashboard';
import { DebugTestPanel } from './components/dashboard/DebugTestPanel';
import { DynamoDBView } from './components/dashboard/DynamoDBView';
import { LambdaLogsViewer } from './components/dashboard/LambdaLogsViewer';
import { LambdaView } from './components/dashboard/LambdaView';
import { S3View } from './components/dashboard/S3View';
import { SecretsManagerView } from './components/dashboard/SecretsManagerView';
import { SQSView } from './components/dashboard/SQSView';
import { Header } from './components/layout/Header';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { CONNECTION_STATUS_CONFIG } from './constants';
import { GlobalRefreshProvider, useGlobalRefresh } from './hooks/useGlobalRefresh';

function AppContent() {
  const [activeTab, setActiveTab] = useState('overview');
  const { connectionStatus } = useGlobalRefresh();

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <BasicLocalStackDashboard onTabChange={setActiveTab} />;
      case 'storage':
        return <S3View />;
      case 'secrets':
        return <SecretsManagerView />;
      case 'tokens':
        return <DynamoDBView />;
      case 'queue':
        return <SQSView />;
      case 'lambda':
        return <LambdaView />;
      case 'logs':
        return <LambdaLogsViewer />;
      case 'debug':
        return <DebugTestPanel />;
      default:
        return <BasicLocalStackDashboard />;
    }
  };

  const getFooterConnectionStatus = () => {
    return CONNECTION_STATUS_CONFIG[connectionStatus] || CONNECTION_STATUS_CONFIG.disconnected;
  };

  const footerStatus = getFooterConnectionStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-saipos-gray-50 to-saipos-gray-100 font-poppins">

      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main style={{ minHeight: 'calc(100vh - 220px)' }} className="max-w-[120rem] mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-saipos-gray-200 bg-white">
        <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img
                src={saiposLogo}
                alt="Saipos Logo"
                className="h-6 w-auto"
              />
              <p className="text-saipos-gray-600 text-sm font-medium">
                LocalStack Monitor - Serviços AWS Completos
              </p>
            </div>
            <div className="flex items-center space-x-4 text-sm text-saipos-gray-600">
              <span className="font-medium">{footerStatus.text}</span>
              <div className={`w-2 h-2 ${footerStatus.color} rounded-full ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`}></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <GlobalRefreshProvider defaultInterval={10000}>
      <AppContent />
    </GlobalRefreshProvider>
  );
}

export default App;