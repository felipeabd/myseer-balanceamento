import { ChatInterface } from './components/ChatInterface';
import './index.css';

// TODO: Replace with actual tenant/user context from your auth system
const mockContext = {
  tenantId: '171D7479-A8DF-4A2A-91C3-8E8759C7F093',
  userEmail: 'demo@myseer.com.br',
};

function App() {
  return <ChatInterface context={mockContext} />;
}

export default App;
