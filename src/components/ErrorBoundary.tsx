import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : "Something went wrong." };
  }

  render() {
    if (this.state.message) {
      return (
        <main className="shell">
          <h1>Graph Sonification hit a problem</h1>
          <p>The page stopped on an unexpected error. Your place in the tutorial may still be stored in this browser.</p>
          <p>{this.state.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
