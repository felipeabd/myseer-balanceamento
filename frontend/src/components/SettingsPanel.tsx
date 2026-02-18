import { useState, useEffect } from 'react';
import { ApiService } from '../services/api';

interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge: string;
}

interface SettingsPanelProps {
  apiService: ApiService;
  onClose: () => void;
}

export function SettingsPanel({ apiService, onClose }: SettingsPanelProps) {
  const [currentModelId, setCurrentModelId] = useState<string>('');
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.getConfig().then(data => {
      setCurrentModelId(data.modelId);
      setSelected(data.modelId);
      setModels(data.models ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (selected === currentModelId) return;
    setSaving(true);
    try {
      await apiService.updateConfig(selected);
      setCurrentModelId(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to update config:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-base font-semibold" style={{ color: '#272154' }}>Configurações</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Modelo de IA</h3>
          <p className="text-xs text-gray-400 mb-4">
            O modelo escolhido será usado em todas as conversas desta empresa.
          </p>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
          ) : (
            <div className="space-y-3">
              {models.map(m => {
                const isSelected = selected === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m.id)}
                    className="w-full text-left rounded-xl border-2 p-4 transition-all"
                    style={
                      isSelected
                        ? { borderColor: '#2A81B8', background: 'linear-gradient(135deg, #e8f7fa 0%, #eceaf8 100%)' }
                        : { borderColor: '#e5e7eb', background: 'white' }
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold" style={{ color: '#272154' }}>{m.name}</span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={
                              m.badge === 'Recomendado'
                                ? { background: '#e8f7fa', color: '#2A81B8' }
                                : { background: '#f3f4f6', color: '#6b7280' }
                            }
                          >
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{m.description}</p>
                      </div>
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={
                          isSelected
                            ? { borderColor: '#2A81B8', background: '#2A81B8' }
                            : { borderColor: '#d1d5db', background: 'white' }
                        }
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {saved ? '✓ Salvo com sucesso' : selected !== currentModelId ? 'Alteração pendente' : 'Sem alterações'}
          </p>
          <button
            onClick={handleSave}
            disabled={selected === currentModelId || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #2A81B8 50%, #494495 100%)' }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
