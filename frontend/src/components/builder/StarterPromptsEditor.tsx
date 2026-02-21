import { useState } from 'react';

interface StarterPrompt {
  icon: string;
  title: string;
  prompt: string;
}

interface StarterPromptsEditorProps {
  prompts: StarterPrompt[];
  onChange: (prompts: StarterPrompt[]) => void;
}

export function StarterPromptsEditor({ prompts, onChange }: StarterPromptsEditorProps) {
  const addPrompt = () => {
    onChange([...prompts, { icon: '', title: '', prompt: '' }]);
  };

  const removePrompt = (index: number) => {
    onChange(prompts.filter((_, i) => i !== index));
  };

  const updatePrompt = (index: number, updates: Partial<StarterPrompt>) => {
    const updated = prompts.map((p, i) => i === index ? { ...p, ...updates } : p);
    onChange(updated);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...prompts];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const moveDown = (index: number) => {
    if (index === prompts.length - 1) return;
    const updated = [...prompts];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Perguntas rapidas exibidas ao usuario na tela inicial do chat.
        </p>
        <button
          onClick={addPrompt}
          className="px-3 py-1.5 text-sm rounded-lg text-white font-medium"
          style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
        >
          + Adicionar Pergunta
        </button>
      </div>

      {prompts.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          Nenhuma pergunta configurada. Clique em "+ Adicionar Pergunta" para comecar.
        </div>
      )}

      {prompts.map((p, index) => (
        <div key={index} className="border border-gray-200 rounded-lg bg-white p-4 space-y-3">
          {/* Header with order controls and remove */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Pergunta {index + 1}
              </span>
              <div className="flex gap-0.5">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs px-1"
                  title="Mover para cima"
                >
                  &#9650;
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === prompts.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs px-1"
                  title="Mover para baixo"
                >
                  &#9660;
                </button>
              </div>
            </div>
            <button
              onClick={() => removePrompt(index)}
              className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
              title="Remover pergunta"
            >
              &times;
            </button>
          </div>

          {/* Icon + Title row */}
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Icone</label>
              <input
                type="text"
                value={p.icon}
                onChange={(e) => updatePrompt(index, { icon: e.target.value })}
                placeholder="⚠️"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Titulo</label>
              <input
                type="text"
                value={p.title}
                onChange={(e) => updatePrompt(index, { title: e.target.value })}
                placeholder="Ex: Risco de Ruptura"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          {/* Prompt textarea */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Prompt</label>
            <textarea
              value={p.prompt}
              onChange={(e) => updatePrompt(index, { prompt: e.target.value })}
              rows={3}
              placeholder="Ex: Quais produtos estão com risco de ruptura nas próximas semanas?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Preview */}
          {p.icon && p.title && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-400">Preview:</span>
              <span className="text-sm">{p.icon} {p.title}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
