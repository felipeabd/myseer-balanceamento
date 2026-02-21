import { useState, useEffect, useCallback } from 'react';
import { BuilderApiService, type TableInfo, type ColumnInfo } from '../../services/builder-api';

interface AgentTableConfig {
  tabela: string;
  alias: string;
  colunas: string[];
  filtroObrigatorio: string;
}

interface TableSelectorProps {
  tabelas: AgentTableConfig[];
  onChange: (tabelas: AgentTableConfig[]) => void;
  api: BuilderApiService;
}

export function TableSelector({ tabelas, onChange, api }: TableSelectorProps) {
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([]);
  const [columnsByTable, setColumnsByTable] = useState<Record<string, ColumnInfo[]>>({});
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [errorColumns, setErrorColumns] = useState<Record<string, string>>({});

  // Load available tables on mount
  useEffect(() => {
    api.listTables().then(tables => {
      setAvailableTables(tables);
      setLoadingTables(false);
    }).catch((err) => {
      console.error('[TableSelector] Failed to list tables:', err);
      setLoadingTables(false);
    });
  }, [api]);

  const loadColumns = useCallback(async (tableName: string) => {
    if (!tableName) return;

    setLoadingColumns(prev => new Set(prev).add(tableName));
    setErrorColumns(prev => { const next = { ...prev }; delete next[tableName]; return next; });

    try {
      const cols = await api.describeTable(tableName);
      setColumnsByTable(prev => ({ ...prev, [tableName]: cols }));
    } catch (err) {
      console.error(`[TableSelector] Failed to describe table ${tableName}:`, err);
      setErrorColumns(prev => ({ ...prev, [tableName]: 'Erro ao carregar colunas' }));
    }

    setLoadingColumns(prev => {
      const next = new Set(prev);
      next.delete(tableName);
      return next;
    });
  }, [api]);

  // Load columns for tables that are already configured on mount
  useEffect(() => {
    tabelas.forEach(t => {
      if (t.tabela && !columnsByTable[t.tabela] && !loadingColumns.has(t.tabela)) {
        loadColumns(t.tabela);
      }
    });
  }, [tabelas, loadColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTable = () => {
    onChange([...tabelas, { tabela: '', alias: '', colunas: [], filtroObrigatorio: '' }]);
  };

  const removeTable = (index: number) => {
    onChange(tabelas.filter((_, i) => i !== index));
  };

  const updateTable = (index: number, updates: Partial<AgentTableConfig>) => {
    const updated = tabelas.map((t, i) => i === index ? { ...t, ...updates } : t);
    onChange(updated);
  };

  const handleTableSelect = (index: number, tableName: string) => {
    updateTable(index, { tabela: tableName, colunas: [] });
    if (tableName && !columnsByTable[tableName]) {
      loadColumns(tableName);
    }
  };

  const toggleColumn = (index: number, colName: string) => {
    const current = tabelas[index].colunas;
    const updated = current.includes(colName)
      ? current.filter(c => c !== colName)
      : [...current, colName];
    updateTable(index, { colunas: updated });
  };

  const selectAllColumns = (index: number) => {
    const cols = columnsByTable[tabelas[index].tabela];
    if (!cols) return;
    const allNames = cols.map(c => c.name);
    const allSelected = allNames.every(n => tabelas[index].colunas.includes(n));
    updateTable(index, { colunas: allSelected ? [] : allNames });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Tabelas e colunas que o agente pode acessar via consulta SQL.
        </p>
        <button
          onClick={addTable}
          className="px-3 py-1.5 text-sm rounded-lg text-white font-medium"
          style={{ background: 'linear-gradient(135deg, #28B8CE 0%, #494495 100%)' }}
        >
          + Adicionar Tabela
        </button>
      </div>

      {loadingTables && (
        <p className="text-sm text-gray-400">Carregando tabelas...</p>
      )}

      {tabelas.length === 0 && !loadingTables && (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          Nenhuma tabela configurada. Clique em "+ Adicionar Tabela" para comecar.
        </div>
      )}

      {tabelas.map((t, index) => {
        const cols = columnsByTable[t.tabela] || [];
        const isLoadingCols = loadingColumns.has(t.tabela);
        const colError = errorColumns[t.tabela];

        return (
          <div key={index} className="border border-gray-200 rounded-lg bg-white p-4 space-y-3">
            {/* Header with remove button */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Tabela {index + 1}
              </span>
              <button
                onClick={() => removeTable(index)}
                className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                title="Remover tabela"
              >
                &times;
              </button>
            </div>

            {/* Table dropdown + alias */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tabela</label>
                <select
                  value={t.tabela}
                  onChange={(e) => handleTableSelect(index, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">Selecione uma tabela...</option>
                  {availableTables.map(at => (
                    <option key={at.name} value={at.name}>
                      {at.name} ({at.totalRows} rows)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Alias</label>
                <input
                  type="text"
                  value={t.alias}
                  onChange={(e) => updateTable(index, { alias: e.target.value })}
                  placeholder="Ex: balanceamento"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>

            {/* Columns section */}
            {t.tabela && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500">
                    Colunas {cols.length > 0 && `(${t.colunas.length} de ${cols.length} selecionadas)`}
                  </label>
                  <div className="flex items-center gap-2">
                    {cols.length > 0 && (
                      <button
                        onClick={() => selectAllColumns(index)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        {cols.every(c => t.colunas.includes(c.name)) ? 'Desmarcar todas' : 'Selecionar todas'}
                      </button>
                    )}
                    {!isLoadingCols && cols.length === 0 && !colError && (
                      <button
                        onClick={() => loadColumns(t.tabela)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Carregar colunas
                      </button>
                    )}
                  </div>
                </div>

                {isLoadingCols && (
                  <div className="text-xs text-gray-400 py-3 text-center border border-gray-100 rounded-lg">
                    Carregando colunas de {t.tabela}...
                  </div>
                )}

                {colError && (
                  <div className="text-xs text-red-500 py-3 text-center border border-red-100 rounded-lg bg-red-50">
                    {colError}
                    <button
                      onClick={() => loadColumns(t.tabela)}
                      className="ml-2 text-blue-500 hover:text-blue-700 underline"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}

                {!isLoadingCols && !colError && cols.length > 0 && (
                  <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg p-2 grid grid-cols-2 gap-1">
                    {cols.map(col => (
                      <label
                        key={col.name}
                        className={`flex items-center gap-2 text-xs py-1 px-2 rounded cursor-pointer transition-colors ${
                          t.colunas.includes(col.name) ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={t.colunas.includes(col.name)}
                          onChange={() => toggleColumn(index, col.name)}
                          className="rounded border-gray-300 text-blue-500 focus:ring-blue-300"
                        />
                        <span className="text-gray-700 font-medium">{col.name}</span>
                        <span className="text-gray-400 text-[10px]">{col.type}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Filtro obrigatorio */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Filtro obrigatorio</label>
              <input
                type="text"
                value={t.filtroObrigatorio}
                onChange={(e) => updateTable(index, { filtroObrigatorio: e.target.value })}
                placeholder="Ex: tenant_id = '{tenant}'"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
