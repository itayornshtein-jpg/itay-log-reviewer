import { useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? isoString : date.toLocaleString();
}

function InsightList({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="insight">
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [entries, setEntries] = useState([]);
  const [insights, setInsights] = useState(null);

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    setFile(selected || null);
    setStatus('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Please choose a log or text file first.');
      return;
    }

    setStatus('Uploading and analyzing…');
    setError('');
    setEntries([]);
    setInsights(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/logs/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Upload failed');
      }

      const payload = await response.json();
      setEntries(payload.entries || []);
      setInsights(payload.insights || null);
      setStatus('Analysis complete');
    } catch (err) {
      setError(err.message || 'An error occurred');
      setStatus('');
    }
  };

  const previewEntries = useMemo(() => entries.slice(0, 5), [entries]);

  return (
    <main className="app">
      <header className="app__header">
        <h1>Itay Log Reviewer</h1>
        <p>Upload logs, normalize entries, and extract structured issues.</p>
      </header>

      <section className="grid">
        <div className="card card--wide">
          <h2>Upload log files</h2>
          <p className="muted">
            Supported types: <code>.log</code>, <code>.txt</code>, <code>.out</code>, <code>.err</code>. The backend will normalize
            timestamps, severity, and subsystems before analysis.
          </p>
          <form className="upload" onSubmit={handleSubmit}>
            <label className="file-input">
              <span>{file ? file.name : 'Choose a file'}</span>
              <input type="file" accept=".log,.txt,.out,.err" onChange={handleFileChange} />
            </label>
            <button type="submit">Analyze</button>
          </form>
          {status && <p className="status">{status}</p>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="card">
          <h2>LLM insights</h2>
          {!insights && <p className="muted">Upload a file to see extracted errors and failures.</p>}
          {insights && (
            <div className="insights">
              <p className="muted small">Source: {insights.source === 'llm' ? 'LLM model' : 'Heuristic fallback'}</p>
              <InsightList title="Errors" items={insights.errors} />
              <InsightList title="Timeframes" items={insights.timeframes} />
              <InsightList title="Failed actions" items={insights.failed_actions} />
              <InsightList title="System failures" items={insights.system_failures} />
              <InsightList title="Agent failures" items={insights.agent_failures} />
            </div>
          )}
        </div>
      </section>

      <section className="card card--wide">
        <h2>Parsed entries</h2>
        {!entries.length && <p className="muted">We will show a preview of the first few normalized log lines here.</p>}
        {entries.length > 0 && (
          <div className="entries">
            {previewEntries.map((entry, index) => (
              <div className="entry" key={`${entry.timestamp}-${index}`}>
                <div className="entry__meta">
                  <span className={`badge badge--${entry.severity.toLowerCase()}`}>{entry.severity}</span>
                  {entry.subsystem && <span className="pill">{entry.subsystem}</span>}
                  <span className="muted small">{formatDate(entry.timestamp)}</span>
                </div>
                <p className="entry__message">{entry.message}</p>
              </div>
            ))}
            {entries.length > previewEntries.length && (
              <p className="muted small">Showing {previewEntries.length} of {entries.length} entries.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
