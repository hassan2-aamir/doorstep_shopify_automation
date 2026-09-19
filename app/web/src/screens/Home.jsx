import { Navigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { Skeleton } from '../components/ui.jsx';

// The "/" resolver from the App flow doc: a new workspace meets the welcome page, a half-set-up one resumes
// setup, everything else lands on Today. If the API is unreachable there is no state to route on, so Today.
export function Home() {
  const { data: ws, loading } = useWorkspace();
  if (loading && !ws) return <Skeleton className="h-40" />;
  if (ws?.state === 'new') return <Navigate to="/welcome" replace />;
  if (ws?.state === 'connecting') return <Navigate to="/setup" replace />;
  return <Navigate to="/today" replace />;
}
