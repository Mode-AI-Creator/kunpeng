/**
 * Promise bridge between the agent and the decision-card UI.
 *
 * Requests are queued instead of overwriting the active question. Snoozing
 * keeps the tool promise alive so users can inspect the workspace and answer
 * later without losing the task.
 */

import { create } from 'zustand';
import type { ActiveView } from './chatStore';

export interface AskUserOption {
  id?: string;
  label: string;
  description?: string;
  recommended?: boolean;
  badge?: string;
  disabled?: boolean;
}

export interface AskUserQuestion {
  id?: string;
  question: string;
  header?: string;
  context?: string;
  options: AskUserOption[];
  multiSelect: boolean;
  allowCustom?: boolean;
  required?: boolean;
  defaultOptionId?: string;
  submitLabel?: string;
}

export interface AskUserAnswer {
  questionId?: string;
  selected: string[];
  selectedOptionIds?: string[];
  freeText?: string;
}

export interface AskUserRequest {
  id: string;
  questions: AskUserQuestion[];
  createdAt: number;
  sourceLabel?: string;
  sourceView: ActiveView;
  sourceSessionId: string | null;
}

interface PendingAsk extends AskUserRequest {
  resolve: (answers: AskUserAnswer[] | null) => void;
}

export interface AskUserRecord extends AskUserRequest {
  answers: AskUserAnswer[] | null;
  status: 'answered' | 'cancelled';
  resolvedAt: number;
}

interface AskMeta {
  sourceLabel?: string;
  sourceView: ActiveView;
  sourceSessionId: string | null;
}

interface AskUserState {
  pending: PendingAsk | null;
  queue: PendingAsk[];
  history: AskUserRecord[];
  snoozed: boolean;
  ask: (questions: AskUserQuestion[], meta: AskMeta, signal?: AbortSignal) => Promise<AskUserAnswer[] | null>;
  submit: (requestId: string, answers: AskUserAnswer[] | null) => void;
  cancel: (requestId: string) => void;
  snooze: (requestId: string) => void;
  resume: (requestId: string) => void;
}

function requestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAskUserStore = create<AskUserState>((set, get) => ({
  pending: null,
  queue: [],
  history: [],
  snoozed: false,

  ask: (questions, meta, signal) => new Promise<AskUserAnswer[] | null>((resolve) => {
    if (signal?.aborted) { resolve(null); return; }
    const id = requestId();
    const onAbort = () => get().cancel(id);
    const request: PendingAsk = {
      id,
      questions,
      resolve: (answers) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(answers);
      },
      createdAt: Date.now(),
      sourceLabel: meta.sourceLabel,
      sourceView: meta.sourceView,
      sourceSessionId: meta.sourceSessionId,
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    set((state) => state.pending
      ? { queue: [...state.queue, request] }
      : { pending: request, snoozed: false });
    if (signal?.aborted) onAbort();
  }),

  submit: (requestId, answers) => {
    const { pending, queue, history } = get();
    if (!pending || pending.id !== requestId) return;
    const [next, ...rest] = queue;
    const { resolve: _resolve, ...request } = pending;
    const record: AskUserRecord = {
      ...request,
      answers,
      status: answers ? 'answered' : 'cancelled',
      resolvedAt: Date.now(),
    };
    set({
      pending: next ?? null,
      queue: rest,
      history: [...history, record].slice(-40),
      snoozed: false,
    });
    pending.resolve(answers);
  },

  cancel: (requestId) => {
    const { pending, queue, history } = get();
    if (pending?.id === requestId) { get().submit(requestId, null); return; }
    const request = queue.find(item => item.id === requestId);
    if (!request) return;
    const { resolve, ...record } = request;
    set({ queue: queue.filter(item => item.id !== requestId),
      history: [...history, { ...record, answers: null, status: 'cancelled' as const, resolvedAt: Date.now() }].slice(-40) });
    resolve(null);
  },

  snooze: (requestId) => {
    if (get().pending?.id === requestId) set({ snoozed: true });
  },

  resume: (requestId) => {
    if (get().pending?.id === requestId) set({ snoozed: false });
  },
}));
