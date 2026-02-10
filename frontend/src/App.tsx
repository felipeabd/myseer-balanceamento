import { ChatInterface } from './components/ChatInterface';
import './index.css';

// TODO: Replace with actual tenant/user context from your auth system
const mockContext = {
  tenantId: '8C56B7A6-BD17-49F8-817B-CF4EA3C08384',
  userEmail: 'demo@myseer.com.br',
};

function App() {
  return <ChatInterface context={mockContext} />;
}

export default App;
