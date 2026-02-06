import { Bug, Database, Eye, FileText, KeyRound, MessageSquare, Zap, Box } from 'lucide-react';
import saiposLogo from '../../assets/logo.png';
import { GlobalRefreshControl } from '../shared/GlobalRefreshControl';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const tabs = [
    { id: 'overview', name: 'Visão Geral', icon: Eye },
    { id: 'storage', name: 'S3', icon: Box },
    { id: 'secrets', name: 'Secrets Manager', icon: KeyRound },
    { id: 'tokens', name: 'DynamoDB', icon: Database },
    { id: 'queue', name: 'SQS', icon: MessageSquare },
    { id: 'lambda', name: 'Lambda', icon: Zap },
    { id: 'logs', name: 'Logs', icon: FileText },
    { id: 'debug', name: 'Debug & Teste', icon: Bug },
  ];

  return (
    <header className="bg-gradient-to-r from-saipos-blue-600 to-saipos-blue-700 shadow-lg">
      <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <img
              src={saiposLogo}
              alt="Saipos Logo"
              className="h-8 w-auto"
            />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">LocalStack Monitor</h1>
              <p className="text-sm text-white/80 font-medium">Monitoramento dos serviços AWS</p>
            </div>
          </div>

          <GlobalRefreshControl />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white/10 backdrop-blur-sm border-t border-white/20">
        <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 py-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-sm
                    ${activeTab === tab.id
                      ? 'bg-white text-saipos-blue-700 shadow-md'
                      : 'text-white/90 hover:text-white hover:bg-white/20'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}