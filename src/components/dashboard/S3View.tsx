import { useCallback, useEffect, useState } from 'react';
import { Box, Database, Eye, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { S3Service } from '../../services/aws';
import type { S3BucketInfo, S3ObjectContent, S3ObjectInfo } from '../../types';
import { usePageRefresh } from '../../hooks/useGlobalRefresh';
import { formatBytes, formatDateOnly } from '../../utils/formatters';
import { MetricCard } from '../shared/MetricCard';
import { DeleteConfirmation } from '../shared/DeleteConfirmation';
import { JsonTextarea } from '../shared/JsonTextarea';

interface ObjectEditorState {
  bucket: string;
  key: string;
  content: string;
  isJson: boolean;
}

export function S3View() {
  const [buckets, setBuckets] = useState<S3BucketInfo[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<S3BucketInfo | null>(null);
  const [objects, setObjects] = useState<S3ObjectInfo[]>([]);
  const [selectedObject, setSelectedObject] = useState<S3ObjectInfo | null>(null);
  const [objectContent, setObjectContent] = useState<S3ObjectContent | null>(null);
  const [objectEditor, setObjectEditor] = useState<ObjectEditorState | null>(null);
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'bucket' | 'object'; name: string; key?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefixFilter, setPrefixFilter] = useState('');

  const loadBuckets = useCallback(async () => {
    try {
      setError(null);
      const bucketList = await S3Service.listBuckets();
      setBuckets(bucketList ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar buckets S3');
      setBuckets([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh('s3-view', loadBuckets);

  useEffect(() => {
    loadBuckets();
  }, [loadBuckets]);

  const loadObjects = useCallback(
    async (bucket: S3BucketInfo) => {
      try {
        setSelectedBucket(bucket);
        setSelectedObject(null);
        setObjectContent(null);
        setLoadingObjects(true);
        setError(null);

        const objectList = await S3Service.listObjects(bucket.name, {
          prefix: prefixFilter || undefined,
          maxKeys: 100,
        });

        setObjects(objectList ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar objetos do bucket');
        setObjects([]);
      } finally {
        setLoadingObjects(false);
      }
    },
    [prefixFilter],
  );

  const handleViewObject = useCallback(
    async (objectInfo: S3ObjectInfo) => {
      if (!selectedBucket) {
        return;
      }

      try {
        setSelectedObject(objectInfo);
        setLoadingContent(true);
        setError(null);

        const content = await S3Service.getObjectContent(selectedBucket.name, objectInfo.key);

        setObjectContent(content);

        const trimmedContent = content.content.trim();
        const isJson =
          (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) ||
          (trimmedContent.startsWith('[') && trimmedContent.endsWith(']'));

        setObjectEditor({
          bucket: content.bucket,
          key: content.key,
          content: content.content,
          isJson,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar conteúdo do objeto');
        setObjectContent(null);
      } finally {
        setLoadingContent(false);
      }
    },
    [selectedBucket],
  );

  const handleCreateOrUpdateObject = useCallback(async () => {
    if (!objectEditor) {
      return;
    }

    try {
      setError(null);
      await S3Service.putObject(
        objectEditor.bucket,
        objectEditor.key,
        objectEditor.content,
        objectEditor.isJson ? 'application/json' : 'text/plain',
      );
      if (selectedBucket) {
        await loadObjects(selectedBucket);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar objeto S3');
    }
  }, [objectEditor, selectedBucket, loadObjects]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setError(null);

      if (deleteTarget.type === 'bucket') {
        await S3Service.deleteBucket(deleteTarget.name);
        setSelectedBucket(null);
        setObjects([]);
        setSelectedObject(null);
        setObjectContent(null);
        await loadBuckets();
      } else if (selectedBucket && deleteTarget.key) {
        await S3Service.deleteObject(selectedBucket.name, deleteTarget.key);
        setSelectedObject(null);
        setObjectContent(null);
        await loadObjects(selectedBucket);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao deletar recurso S3');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, selectedBucket, loadBuckets, loadObjects]);

  const handleCreateBucket = useCallback(async () => {
    if (!newBucketName.trim()) {
      return;
    }

    try {
      setError(null);
      setIsCreatingBucket(true);
      await S3Service.createBucket(newBucketName.trim());
      setNewBucketName('');
      await loadBuckets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar bucket S3');
    } finally {
      setIsCreatingBucket(false);
    }
  }, [newBucketName, loadBuckets]);

  const totalObjects = objects.length;
  const totalSize = objects.reduce((sum, item) => sum + item.size, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <FileText className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
          <button
            onClick={loadBuckets}
            className="mt-2 btn-primary text-sm"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Box className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">S3 Storage</h2>
          {selectedBucket && (
            <span className="text-sm text-gray-500">→ {selectedBucket.name}</span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadBuckets}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Buckets"
          value={buckets.length}
          subtitle="Buckets disponíveis"
          icon={Database}
          color="blue"
        />
        <MetricCard
          title="Objetos"
          value={totalObjects}
          subtitle={selectedBucket ? `No bucket ${selectedBucket.name}` : 'Selecione um bucket'}
          icon={FileText}
          color="green"
        />
        <MetricCard
          title="Tamanho Total"
          value={formatBytes(totalSize)}
          subtitle={selectedBucket ? 'Objetos listados' : 'Selecione um bucket'}
          icon={Box}
          color="purple"
        />
      </div>

      {/* Buckets and objects layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buckets list */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Buckets</h3>
          </div>

          {buckets.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Box className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium">Nenhum bucket encontrado</p>
              <p className="text-sm">Crie um novo bucket para começar a armazenar arquivos.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {buckets.map((bucket) => (
                <div
                  key={bucket.name}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    selectedBucket?.name === bucket.name
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  } transition-colors`}
                >
                  <div className="flex items-center space-x-3">
                    <Box className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">{bucket.name}</div>
                      {bucket.creationDate && (
                        <div className="text-xs text-gray-500">
                          Criado em {formatDateOnly(bucket.creationDate)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => loadObjects(bucket)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Ver arquivos"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: 'bucket',
                          name: bucket.name,
                        })
                      }
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Deletar bucket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create bucket form */}
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Criar novo bucket</h4>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
              <input
                type="text"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="nome-do-bucket"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateBucket}
                disabled={isCreatingBucket || !newBucketName.trim()}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingBucket ? 'Criando...' : 'Criar Bucket'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Objects and content */}
        <div className="space-y-6">
          {/* Objects list */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Objetos {selectedBucket ? `– ${selectedBucket.name}` : ''}
                </h3>
                {selectedBucket && (
                  <p className="text-xs text-gray-500">
                    {objects.length} objetos listados
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={prefixFilter}
                  onChange={(e) => setPrefixFilter(e.target.value)}
                  placeholder="Prefixo (pasta/)"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => selectedBucket && loadObjects(selectedBucket)}
                  disabled={!selectedBucket}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingObjects ? 'animate-spin' : ''}`} />
                  <span>Aplicar</span>
                </button>
              </div>
            </div>

            {!selectedBucket ? (
              <div className="text-center py-6 text-gray-500">
                <p>Selecione um bucket para ver seus arquivos.</p>
              </div>
            ) : loadingObjects ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Carregando objetos...</p>
              </div>
            ) : objects.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <p>Nenhum objeto encontrado neste bucket.</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-700 font-medium">Chave</th>
                      <th className="px-3 py-2 text-left text-gray-700 font-medium">Tamanho</th>
                      <th className="px-3 py-2 text-left text-gray-700 font-medium">Modificado em</th>
                      <th className="px-3 py-2 text-right text-gray-700 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((object) => (
                      <tr
                        key={object.key}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 text-gray-800 break-all">
                          {object.key}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {formatBytes(object.size)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {object.lastModified ? formatDateOnly(object.lastModified) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right space-x-2">
                          <button
                            onClick={() => handleViewObject(object)}
                            className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 p-1"
                            title="Visualizar / Editar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                type: 'object',
                                name: object.key,
                                key: object.key,
                              })
                            }
                            className="inline-flex items-center justify-center text-red-600 hover:text-red-800 p-1"
                            title="Deletar objeto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Object content / editor */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Conteúdo do Objeto
              </h3>
              {selectedBucket && (
                <button
                  onClick={() =>
                    setObjectEditor({
                      bucket: selectedBucket.name,
                      key: '',
                      content: '',
                      isJson: true,
                    })
                  }
                  className="flex items-center space-x-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Arquivo</span>
                </button>
              )}
            </div>

            {!objectEditor ? (
              <div className="text-center py-6 text-gray-500">
                <p>Selecione um objeto para visualizar ou clique em &quot;Novo Arquivo&quot;.</p>
              </div>
            ) : loadingContent && !objectContent ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Carregando conteúdo...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-2 md:space-y-0">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Chave do objeto
                    </label>
                    <input
                      type="text"
                      value={objectEditor.key}
                      onChange={(e) =>
                        setObjectEditor({
                          ...objectEditor,
                          key: e.target.value,
                        })
                      }
                      placeholder="pasta/arquivo.txt"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={objectEditor.isJson}
                        onChange={(e) =>
                          setObjectEditor({
                            ...objectEditor,
                            isJson: e.target.checked,
                          })
                        }
                        className="mr-1"
                      />
                      Conteúdo JSON
                    </label>
                  </div>
                  {objectContent?.isTruncated && (
                    <span className="text-xs text-orange-600">
                      Conteúdo truncado na visualização (arquivo grande)
                    </span>
                  )}
                </div>

                {objectEditor.isJson ? (
                  <JsonTextarea
                    value={objectEditor.content}
                    onChange={(value) =>
                      setObjectEditor({
                        ...objectEditor,
                        content: value,
                      })
                    }
                    label="Conteúdo do arquivo (JSON)"
                    rows={10}
                  />
                ) : (
                  <textarea
                    value={objectEditor.content}
                    onChange={(e) =>
                      setObjectEditor({
                        ...objectEditor,
                        content: e.target.value,
                      })
                    }
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Conteúdo de texto simples do arquivo"
                  />
                )}

                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => {
                      setSelectedObject(null);
                      setObjectContent(null);
                      setObjectEditor(null);
                    }}
                    className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={handleCreateOrUpdateObject}
                    disabled={!objectEditor.key.trim()}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Salvar Arquivo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmation
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          itemDescription={
            deleteTarget.type === 'bucket'
              ? `Bucket: ${deleteTarget.name}`
              : `Objeto: ${deleteTarget.name}`
          }
        />
      )}
    </div>
  );
}

