import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="shell">
          <h1>Audiograph needs a fresh start</h1>
          <p>Something on the page got stuck. You did not do anything wrong. Press the button to reload, and the tutorial will speak again.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
