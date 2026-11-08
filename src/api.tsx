import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../shared/models';

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    if (response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.json() as { error?: { message?: string } };
      message = result.error?.message ?? message;
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('The API returned an unexpected response. Make sure the backend is running.');
  const result = await response.json() as { data: T };
  return result.data;
}

interface WorkspaceContext {
  state: AppState | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  notice: string | null;
  dismiss: () => void;
  reload: () => Promise<void>;
  mutate: (path: string, method: string, body?: unknown, message?: string) => Promise<boolean>;
}
const Workspace = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    const next = await request<AppState>('/state');
    if (sequence.current === current) setState(next);
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { await load(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to load workspace'); }
    finally { setLoading(false); }
  }, [load]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const mutate = async (path: string, method: string, body?: unknown, message = 'Changes saved') => {
    setPendingCount(count => count + 1);
    setError(null);
    setNotice(null);
    let saved = false;
    try {
      await request(path, method, body);
      saved = true;
      await load();
      setNotice(message);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Something went wrong';
      setError(saved ? `Your change was saved, but refreshing failed: ${reason}. Refresh before retrying.` : reason);
      return false;
    } finally { setPendingCount(count => count - 1); }
  };
  return <Workspace.Provider value={{
    state, loading, pending: pendingCount > 0, error, notice, reload, mutate,
    dismiss: () => { setError(null); setNotice(null); },
  }}>{children}</Workspace.Provider>;
}

export function useWorkspace() {
  const context = useContext(Workspace);
  if (!context) throw new Error('Workspace provider is missing');
  return context;
}
