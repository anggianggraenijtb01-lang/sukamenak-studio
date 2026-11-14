import React, { createContext, useContext, useState } from 'react';
import {
  INITIAL_MODELS,
  INITIAL_TEMPLATES,
  INITIAL_TRACE_LOGS,
  LlmModelConfig,
  StudioTemplate,
  GenerationTraceLog,
} from '../../services/api';

interface StudioContextValue {
  templates: StudioTemplate[];
  addTemplate: (tpl: Omit<StudioTemplate, 'id' | 'usageCount'>) => void;
  deleteTemplate: (id: string) => void;
  selectedTemplate: StudioTemplate;
  setSelectedTemplate: (tpl: StudioTemplate) => void;
  models: LlmModelConfig[];
  activeModel: LlmModelConfig;
  switchDefaultModel: (modelId: string) => void;
  traceLogs: GenerationTraceLog[];
  appendTraceLog: (log: Omit<GenerationTraceLog, 'id' | 'timestamp'>) => void;
  totalGenerations: number;
  successRate: number;
  estimatedApiCostUsd: number;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

// D4: this whole context (and services/api.ts) is mock data. D2 (creator) and D3 (admin) replace what they use with
// the real API in src/api; D4 deletes this file. Login state lives in src/auth (useAuth), quota in useMe().
export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [templates, setTemplates] = useState<StudioTemplate[]>(INITIAL_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<StudioTemplate>(INITIAL_TEMPLATES[0]);
  const [models, setModels] = useState<LlmModelConfig[]>(INITIAL_MODELS);
  const [traceLogs, setTraceLogs] = useState<GenerationTraceLog[]>(INITIAL_TRACE_LOGS);
  const totalGenerations = 1284;
  const estimatedApiCostUsd = 23.14;

  const activeModel = models.find((m) => m.isDefault) || models[0];

  const addTemplate = (tpl: Omit<StudioTemplate, 'id' | 'usageCount'>) => {
    const newTpl: StudioTemplate = {
      ...tpl,
      id: `tpl-custom-${Date.now().toString(36)}`,
      usageCount: 1,
    };
    setTemplates((prev) => [newTpl, ...prev]);
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const switchDefaultModel = (modelId: string) => {
    setModels((prev) =>
      prev.map((m) => ({
        ...m,
        isDefault: m.id === modelId,
      }))
    );
  };

  const appendTraceLog = (log: Omit<GenerationTraceLog, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timestamp = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;
    const newEntry: GenerationTraceLog = {
      ...log,
      id: `TRC-${Math.floor(9042 + Math.random() * 900)}`,
      timestamp,
    };
    setTraceLogs((prev) => [newEntry, ...prev]);
  };

  return (
    <StudioContext.Provider
      value={{
        templates,
        addTemplate,
        deleteTemplate,
        selectedTemplate,
        setSelectedTemplate,
        models,
        activeModel,
        switchDefaultModel,
        traceLogs,
        appendTraceLog,
        totalGenerations,
        successRate: 99.4,
        estimatedApiCostUsd,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio harus digunakan di dalam StudioProvider');
  }
  return ctx;
}

