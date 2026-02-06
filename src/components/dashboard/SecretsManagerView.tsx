import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { SecretDetail, SecretSummary, SecretTag } from '../../types';
import { SecretsManagerService } from '../../services/aws';
import { usePageRefresh } from '../../hooks/useGlobalRefresh';
import { MetricCard } from '../shared/MetricCard';
import { DeleteConfirmation } from '../shared/DeleteConfirmation';

interface SecretFormState {
  name: string;
  description: string;
  secretString: string;
  tags: SecretTag[];
}

export function SecretsManagerView() {
  const [secrets, setSecrets] = useState<SecretSummary[]>([]);
  const [filteredSecrets, setFilteredSecrets] = useState<SecretSummary[]>([]);
  const [selectedSecret, setSelectedSecret] = useState<SecretDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSecretValue, setShowSecretValue] = useState(false);
  const [pendingShowValue, setPendingShowValue] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SecretSummary | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<SecretFormState>({
    name: '',
    description: '',
    secretString: '',
    tags: [],
  });

  const loadSecrets = useCallback(async () => {
    try {
      setError(null);
      const secretList = await SecretsManagerService.listSecrets();
      const list = secretList ?? [];
      setSecrets(list);
      setFilteredSecrets(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar segredos');
      setSecrets([]);
      setFilteredSecrets([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh('secrets-view', loadSecrets);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSecrets(secrets);
      return;
    }

    const term = searchTerm.toLowerCase();
    setFilteredSecrets(
      secrets.filter((secret) =>
        [secret.name, secret.description]
          .filter(Boolean)
          .some((value) => (value as string).toLowerCase().includes(term)),
      ),
    );
  }, [searchTerm, secrets]);

  const handleSelectSecret = useCallback(
    async (secret: SecretSummary) => {
      try {
        setSelectedSecret(null);
        setShowSecretValue(false);
        setPendingShowValue(false);
        setLoadingDetails(true);
        setError(null);

        const detail = await SecretsManagerService.getSecret(secret.name);
        setSelectedSecret(detail);

        setFormState({
          name: detail.name,
          description: detail.description ?? '',
          secretString: detail.secretString ?? '',
          tags:
            detail.tags != null
              ? Object.entries(detail.tags).map(([Key, Value]) => ({
                  Key,
                  Value,
                }))
              : [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar detalhes do segredo');
        setSelectedSecret(null);
      } finally {
        setLoadingDetails(false);
      }
    },
    [],
  );

  const handleNewSecret = useCallback(() => {
    setIsCreating(true);
    setSelectedSecret(null);
    setShowSecretValue(true);
    setFormState({
      name: '',
      description: '',
      secretString: '',
      tags: [],
    });
  }, []);

  const handleSaveSecret = useCallback(async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (isCreating) {
        if (!formState.name.trim()) {
          setError('Nome do segredo é obrigatório');
          return;
        }

        await SecretsManagerService.createSecret({
          name: formState.name.trim(),
          description: formState.description || undefined,
          secretString: formState.secretString,
          tags: formState.tags.filter((tag) => tag.Key && tag.Value),
        });
      } else if (selectedSecret) {
        await SecretsManagerService.updateSecret(selectedSecret.name, {
          description: formState.description || undefined,
          secretString: formState.secretString,
        });
      }

      await loadSecrets();

      if (!isCreating && selectedSecret) {
        await handleSelectSecret({
          arn: selectedSecret.arn,
          name: selectedSecret.name,
          description: formState.description || undefined,
          lastChangedDate: selectedSecret.lastChangedDate,
          tags: selectedSecret.tags,
        });
      } else {
        setIsCreating(false);
        setSelectedSecret(null);
        setFormState({
          name: '',
          description: '',
          secretString: '',
          tags: [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar segredo');
    } finally {
      setIsSaving(false);
    }
  }, [isCreating, formState, selectedSecret, loadSecrets, handleSelectSecret]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setError(null);
      await SecretsManagerService.deleteSecret(deleteTarget.name);
      setDeleteTarget(null);
      setSelectedSecret(null);
      setFormState({
        name: '',
        description: '',
        secretString: '',
        tags: [],
      });
      await loadSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao deletar segredo');
    }
  }, [deleteTarget, loadSecrets]);

  const handleRequestShowValue = useCallback(() => {
    setPendingShowValue(true);
  }, []);

  const handleConfirmShowValue = useCallback(() => {
    setPendingShowValue(false);
    setShowSecretValue(true);
  }, []);

  const lastUpdatedText = useMemo(() => {
    if (!selectedSecret?.lastChangedDate) {
      return '';
    }
    return new Date(selectedSecret.lastChangedDate).toLocaleString();
  }, [selectedSecret]);

  const totalSecrets = secrets.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <KeyRound className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Secrets Manager</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadSecrets}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar</span>
          </button>
          <button
            onClick={handleNewSecret}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Segredo</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Segredos"
          value={totalSecrets}
          subtitle="Segredos cadastrados"
          icon={KeyRound}
          color="purple"
        />
        <MetricCard
          title="Filtrados"
          value={filteredSecrets.length}
          subtitle="Resultados da busca"
          icon={KeyRound}
          color="blue"
        />
        <MetricCard
          title="Modo"
          value={isCreating ? 'Criação' : selectedSecret ? 'Edição' : 'Visualização'}
          subtitle="Estado atual"
          icon={KeyRound}
          color="green"
        />
      </div>

      {/* Layout: list + details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Secrets list */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Segredos</h3>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou descrição"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {error && (
            <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              {error}
            </div>
          )}

          {filteredSecrets.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>Nenhum segredo encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {filteredSecrets.map((secret) => (
                <div
                  key={secret.arn}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                    selectedSecret?.arn === secret.arn
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => handleSelectSecret(secret)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">{secret.name}</div>
                    {secret.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {secret.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(secret);
                    }}
                    className="ml-3 text-red-600 hover:text-red-800 p-1"
                    title="Deletar segredo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details / editor */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isCreating ? 'Criar novo segredo' : 'Detalhes do segredo'}
              </h3>
              {lastUpdatedText && !isCreating && (
                <p className="text-xs text-gray-500">
                  Última alteração em {lastUpdatedText}
                </p>
              )}
            </div>
          </div>

          {loadingDetails && !isCreating ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Carregando detalhes do segredo...</p>
            </div>
          ) : isCreating || selectedSecret ? (
            <div className="space-y-4">
              {/* Name (only editable on create) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nome do segredo
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      name: e.target.value,
                    })
                  }
                  disabled={!isCreating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="ex: analytics/api-key"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={formState.description}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Descrição opcional do segredo"
                />
              </div>

              {/* Secret value */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Valor do segredo
                  </label>
                  {!isCreating && (
                    <button
                      type="button"
                      onClick={handleRequestShowValue}
                      className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-800"
                    >
                      {showSecretValue ? (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Ocultar valor</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Mostrar valor</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <textarea
                  value={
                    showSecretValue || isCreating
                      ? formState.secretString
                      : formState.secretString
                      ? '•••••••••••••••'
                      : ''
                  }
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      secretString: e.target.value,
                    })
                  }
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Valor do segredo (JSON, token, password, etc.)"
                />
              </div>

              {/* Tags simple view / note */}
              {!isCreating && selectedSecret?.tags && (
                <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="font-medium mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(selectedSecret.tags).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700"
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2">
                {!isCreating && (
                  <button
                    onClick={() => {
                      setSelectedSecret(null);
                      setShowSecretValue(false);
                      setFormState({
                        name: '',
                        description: '',
                        secretString: '',
                        tags: [],
                      });
                    }}
                    className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Limpar
                  </button>
                )}
                <button
                  onClick={handleSaveSecret}
                  disabled={isSaving || (isCreating && !formState.name.trim())}
                  className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p>Selecione um segredo para visualizar ou clique em &quot;Novo Segredo&quot;.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmation
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          itemDescription={`Segredo: ${deleteTarget.name}`}
        />
      )}

      {/* Show secret confirmation */}
      {pendingShowValue && (
        <DeleteConfirmation
          isOpen={true}
          onClose={() => {
            setPendingShowValue(false);
          }}
          onConfirm={handleConfirmShowValue}
          itemDescription="Confirmar exibição do valor do segredo. Evite mostrar em telas compartilhadas ou gravações."
        />
      )}
    </div>
  );
}

