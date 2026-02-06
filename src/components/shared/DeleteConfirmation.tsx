import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, X } from 'lucide-react';

interface DeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called on confirm. When checkboxLabel is set, receives the checkbox state (dontAskAgain). */
  onConfirm: (dontAskAgain?: boolean) => void;
  itemDescription: string;
  loading?: boolean;
  /** When true, shows delete UI (red, "Confirmar Deleção"). When false, shows neutral confirm UI (e.g. "Exibir valor"). */
  variant?: 'delete' | 'confirm';
  /** Custom title when variant is 'confirm'. */
  confirmTitle?: string;
  /** Custom subtitle when variant is 'confirm'. */
  confirmSubtitle?: string;
  /** Confirm button label when variant is 'confirm'. */
  confirmLabel?: string;
  /** Optional checkbox label (e.g. "Não perguntar novamente"). When set, onConfirm receives the checkbox value. */
  checkboxLabel?: string;
}

export function DeleteConfirmation({
  isOpen,
  onClose,
  onConfirm,
  itemDescription,
  loading = false,
  variant = 'delete',
  confirmTitle = 'Confirmar',
  confirmSubtitle = '',
  confirmLabel = 'Confirmar',
  checkboxLabel,
}: DeleteConfirmationProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    if (!isOpen) setDontAskAgain(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const isDelete = variant === 'delete';

  const handleConfirm = () => {
    if (checkboxLabel) {
      onConfirm(dontAskAgain);
    } else {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                isDelete ? 'bg-red-100' : 'bg-purple-100'
              }`}
            >
              {isDelete ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : (
                <Eye className="w-6 h-6 text-purple-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isDelete ? 'Confirmar Deleção' : confirmTitle}
              </h2>
              <p className="text-sm text-gray-600">
                {isDelete ? 'Esta ação não pode ser desfeita' : confirmSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            {isDelete
              ? 'Tem certeza de que deseja deletar este item?'
              : itemDescription}
          </p>
          {isDelete && (
            <>
              <div className="bg-gray-50 p-3 rounded-lg border">
                <p className="text-sm text-gray-600 font-medium">Item a ser deletado:</p>
                <p className="text-sm text-gray-900 mt-1 font-mono">{itemDescription}</p>
              </div>
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Atenção:</strong> Esta ação é permanente e não pode ser desfeita.
                </p>
              </div>
            </>
          )}
          {!isDelete && checkboxLabel && (
            <label className="mt-4 flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">{checkboxLabel}</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center space-x-2 ${
              isDelete
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            <span>
              {loading
                ? (isDelete ? 'Deletando...' : 'Aguarde...')
                : isDelete
                  ? 'Confirmar Deleção'
                  : confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}