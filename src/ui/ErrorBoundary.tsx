import { Component, type ErrorInfo, type ReactNode } from 'react';
import { downloadBackup } from './backupActions';

/**
 * If a screen crashes, show a recovery card instead of a blank app.
 * Data lives in IndexedDB, so offering a backup download here is always safe.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card crash" role="alert">
        <h2>Algo falló en esta pantalla</h2>
        <p className="muted">Tus datos siguen guardados. Prueba de nuevo; si se repite, descarga un respaldo antes de seguir.</p>
        <small className="muted mono">{String(this.state.error.message).slice(0, 200)}</small>
        <button className="btn primary" onClick={() => this.setState({ error: null })}>
          Reintentar
        </button>
        <button className="btn secondary" onClick={() => location.reload()}>
          Recargar la app
        </button>
        <button className="btn secondary" onClick={() => downloadBackup()}>
          Descargar respaldo
        </button>
      </section>
    );
  }
}
