import { createContext, useContext } from 'react';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/usePoll.js';

const WorkspaceContext = createContext(null);

// One /api/workspace poll (15 s) feeds the status pill, the nav badge, Today and the checklist.
export function WorkspaceProvider({ children }) {
  const poll = usePoll((signal) => api('/api/workspace', { signal }), 15000, 'workspace');
  return <WorkspaceContext.Provider value={poll}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
