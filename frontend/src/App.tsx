import { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { BuilderLayout } from './components/builder/BuilderLayout';
import './index.css';

// TODO: Replace with actual tenant/user context from your auth system
const mockContext = {
  tenantId: '7489598B-A6AC-4AB3-B1BB-5221DBC8EAB5',
  userEmail: 'demo@myseer.com.br',
};

function App() {
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (route.startsWith('/builder')) {
    return <BuilderLayout userEmail={mockContext.userEmail} onExit={() => navigate('/')} />;
  }

  return <ChatInterface context={mockContext} />;
}

/** Simple navigation without react-router */
export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default App;
