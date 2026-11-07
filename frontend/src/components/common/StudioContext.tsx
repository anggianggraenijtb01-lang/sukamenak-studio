import React, { createContext, useContext, useState } from 'react';
import {
  INITIAL_MODELS,
  INITIAL_TEMPLATES,
  INITIAL_TRACE_LOGS,
  LlmModelConfig,
  StudioTemplate,
  GenerationTraceLog,
} from '../../services/api';
import { EncryptedPromptRecord } from '../../services/aesEncryption';

interface StudioContextValue {
  quotaRemaining: number;
  quotaMax: number;
  consumeQuota: () => void;
  resetQuota: () => void;
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
  lastEncryptedRecord: EncryptedPromptRecord;
  setLastEncryptedRecord: (rec: EncryptedPromptRecord) => void;
  totalGenerations: number;
  successRate: number;
  estimatedApiCostUsd: number;
  isAdminLoggedIn: boolean;
  adminLogin: (emailOrPass: string, pass?: string) => boolean;
  adminLogout: () => void;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [quotaRemaining, setQuotaRemaining] = useState<number>(12);
  const quotaMax = 15;

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('sukamenak_admin_auth') === 'true';
  });

  const adminLogin = (emailOrPass: string, pass?: string): boolean => {
    // Jika hanya 1 argumen (password saja)
    if (!pass) {
      if (emailOrPass === 'adminrw15' || emailOrPass === 'operator2026' || emailOrPass === 'admin') {
        setIsAdminLoggedIn(true);
        localStorage.setItem('sukamenak_admin_auth', 'true');
        return true;
      }
      return false;
    }

    // Jika 2 argumen (email dan password)
    const validEmails = [
      'admin@sukamenak.org',
      'admin.rw15@sukamenak.desa.id',
      'operator@sukamenak.desa.id',
      'admin@sukamenak.desa.id',
      'admin',
      'operator',
    ];
    const validPass = ['admin', 'admin123', 'adminrw15', 'operator2026'];

    const emailMatch = validEmails.includes(emailOrPass.trim().toLowerCase());
    const passMatch = validPass.includes(pass.trim());

    if (emailMatch && passMatch) {
      setIsAdminLoggedIn(true);
      localStorage.setItem('sukamenak_admin_auth', 'true');
      return true;
    }
    return false;
  };

  const adminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('sukamenak_admin_auth');
  };

  const [templates, setTemplates] = useState<StudioTemplate[]>(INITIAL_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<StudioTemplate>(INITIAL_TEMPLATES[0]);
  const [models, setModels] = useState<LlmModelConfig[]>(INITIAL_MODELS);
  const [traceLogs, setTraceLogs] = useState<GenerationTraceLog[]>(INITIAL_TRACE_LOGS);
  const [totalGenerations, setTotalGenerations] = useState<number>(1284);
  const [estimatedApiCostUsd, setEstimatedApiCostUsd] = useState<number>(23.14);

  const [lastEncryptedRecord, setLastEncryptedRecord] = useState<EncryptedPromptRecord>({
    cipherTextHex: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    ivHex: '4a6f7953756b616d656e616b',
    authTagHex: '8f91a2b3c4d5e6f70123456789abcdef',
    algorithm: 'AES-256-GCM',
    updatedAt: '2026-11-04T07:00:00.000Z',
    keyFingerprint: 'SHA256:9F86D081884C7D659A2FEAA0C55AD015',
  });

  const activeModel = models.find((m) => m.isDefault) || models[0];

  const consumeQuota = () => {
    setQuotaRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    setTotalGenerations((prev) => prev + 1);
    setEstimatedApiCostUsd((prev) => Number((prev + activeModel.costPerRenderUsd).toFixed(3)));
  };

  const resetQuota = () => setQuotaRemaining(12);

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
        quotaRemaining,
        quotaMax,
        consumeQuota,
        resetQuota,
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
        lastEncryptedRecord,
        setLastEncryptedRecord,
        totalGenerations,
        successRate: 99.4,
        estimatedApiCostUsd,
        isAdminLoggedIn,
        adminLogin,
        adminLogout,
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

