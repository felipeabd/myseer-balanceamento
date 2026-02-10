import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-red-50">
          <div className="max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Erro!</h1>
            <p className="text-gray-700 mb-4">
              Ocorreu um erro ao carregar a aplicação.
            </p>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
