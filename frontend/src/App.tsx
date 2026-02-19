import { ChatInterface } from './components/ChatInterface';
import './index.css';

// TODO: Replace with actual tenant/user context from your auth system
const mockContext = {
  tenantId: '7489598B-A6AC-4AB3-B1BB-5221DBC8EAB5',
  userEmail: 'demo@myseer.com.br',
};

function App() {
  return <ChatInterface context={mockContext} />;
}

export default App;
