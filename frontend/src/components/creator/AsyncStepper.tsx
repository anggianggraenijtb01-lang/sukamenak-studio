import React from 'react';
import { CheckCircle2, Loader2, Circle, Eye, Lock, Wand2, Type } from 'lucide-react';
import { StepperStageId } from '../../workers/bullmqQueue';

export interface StepState {
  id: StepperStageId;
  title: string;
  subtitle: string;
  status: 'idle' | 'running' | 'completed';
}

interface AsyncStepperProps {
  steps: StepState[];
  modeLabel?: 'i2i' | 't2i';
}

export const AsyncStepper: React.FC<AsyncStepperProps> = ({ steps, modeLabel = 'i2i' }) => {
  const getStepIcon = (id: StepperStageId) => {
    switch (id) {
      case 1:
        return Eye;
      case 2:
        return Lock;
      case 3:
        return Wand2;
      case 4:
        return Type;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
          Status Pipeline Async
        </span>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#DBEAFE]">
          BullMQ Worker • {modeLabel.toUpperCase()}
        </span>
      </div>

      <div className="space-y-2.5">
        {steps.map((step) => {
          const IconComponent = getStepIcon(step.id);
          const isRunning = step.status === 'running';
          const isCompleted = step.status === 'completed';

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all ${
                isRunning
                  ? 'bg-[#EFF6FF] border-[#2563EB] shadow-xs'
                  : isCompleted
                    ? 'bg-[#F8FAFC] border-[#CBD5E1]'
                    : 'bg-white border-[#E2E8F0] opacity-75'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCompleted ? (
                  <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                ) : isRunning ? (
                  <div className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-[#64748B] flex items-center justify-center">
                    <Circle className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-bold ${
                      isRunning
                        ? 'text-[#2563EB]'
                        : isCompleted
                          ? 'text-[#0F172A]'
                          : 'text-[#475569]'
                    }`}
                  >
                    {step.title}
                  </span>
                  <IconComponent
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isRunning || isCompleted ? 'text-[#2563EB]' : 'text-[#94A3B8]'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[#64748B] truncate mt-0.5">{step.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

