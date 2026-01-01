import { useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? isoString : date.toLocaleString();
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!text) return null;

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Received malformed JSON response from the server.');
    }
  }

  return text;
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
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [entries, setEntries] = useState([]);
  const [insights, setInsights] = useState(null);
  const [coralogixFilters, setCoralogixFilters] = useState({
    system: '',
    subsystem: '',
    query: '',
  });
  const [coralogixPage, setCoralogixPage] = useState(1);
  const [coralogixPageSize, setCoralogixPageSize] = useState(25);
  const [coralogixStatus, setCoralogixStatus] = useState('');
  const [coralogixError, setCoralogixError] = useState('');
  const [coralogixResults, setCoralogixResults] = useState({ entries: [], total: 0 });

  const addFiles = (selectedFiles = []) => {
    if (!selectedFiles.length) return;

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...prev];

      selectedFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existingKeys.has(key)) {
          next.push(file);
          existingKeys.add(key);
        }
      });

      return next;
    });

    setStatus('');
    setError('');
  };

  const handleFileChange = (event) => {
    const selected = Array.from(event.target.files || []);
    addFiles(selected);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    addFiles(droppedFiles);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!files.length) {
      setError('Please choose at least one log file, folder, or .zip archive first.');
      return;
    }

    setStatus('Uploading and analyzing…');
    setError('');
    setEntries([]);
    setInsights(null);

    const formData = new FormData();
    files.forEach((file) => {
      const path = file.webkitRelativePath || file.name;
      formData.append('files', file, path);
    });

    try {
      const response = await fetch(`${API_BASE}/logs/upload`, {
        method: 'POST',
        body: formData,
      });

      const payload = await parseResponsePayload(response);

      if (!response.ok) {
        const detail =
          (payload && typeof payload === 'object' && 'detail' in payload && payload.detail) ||
          (typeof payload === 'string' ? payload : null);
        throw new Error(detail || 'Upload failed');
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Unexpected response format from the server.');
      }

      setEntries(payload.entries || []);
      setInsights(payload.insights || null);
      setStatus('Analysis complete');
    } catch (err) {
      setError(err.message || 'An error occurred');
      setStatus('');
    }
  };

  const previewEntries = useMemo(() => entries.slice(0, 5), [entries]);

  const removeFile = (name, size, lastModified) => {
    setFiles((prev) =>
      prev.filter(
        (file) => file.name !== name || file.size !== size || file.lastModified !== lastModified,
      ),
    );
  };

  const combinedTimeline = useMemo(() => {
    const errors = insights?.errors || [];
    const timeframes = insights?.timeframes || [];
    if (!errors.length && !timeframes.length) return [];
    return [...errors.map((item) => `Error: ${item}`), ...timeframes.map((item) => `Timeline: ${item}`)];
  }, [insights]);

  const handleCoralogixFilterChange = (event) => {
    const { name, value } = event.target;
    setCoralogixFilters((prev) => ({ ...prev, [name]: value }));
  };

  const fetchCoralogixLogs = async (page = 1) => {
    setCoralogixStatus('Querying Coralogix…');
    setCoralogixError('');

    const params = new URLSearchParams({ page: String(page), page_size: String(coralogixPageSize) });
    if (coralogixFilters.system) params.append('system', coralogixFilters.system);
    if (coralogixFilters.subsystem) params.append('subsystem', coralogixFilters.subsystem);
    if (coralogixFilters.query) params.append('query', coralogixFilters.query);

    try {
      const response = await fetch(`${API_BASE}/coralogix/logs?${params.toString()}`);
      const payload = await parseResponsePayload(response);

      if (!response.ok) {
        const detail =
          (payload && typeof payload === 'object' && 'detail' in payload && payload.detail) ||
          (typeof payload === 'string' ? payload : null);
        throw new Error(detail || 'Failed to fetch Coralogix logs');
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Unexpected response format from the server.');
      }

      setCoralogixResults({
        entries: payload.entries || [],
        total: payload.total ?? 0,
        webhook_url: payload.webhook_url,
      });
      setCoralogixPage(payload.page || page);
      setCoralogixStatus('Results loaded');
    } catch (err) {
      setCoralogixError(err.message || 'An error occurred while querying Coralogix');
      setCoralogixStatus('');
    }
  };

  const handleCoralogixSubmit = (event) => {
    event.preventDefault();
    setCoralogixPage(1);
    fetchCoralogixLogs(1);
  };

  const totalPages = Math.max(1, Math.ceil((coralogixResults.total || 0) / coralogixPageSize));

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setCoralogixPage(nextPage);
    fetchCoralogixLogs(nextPage);
  };

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
            Supported types: <code>.log</code>, <code>.txt</code>, <code>.out</code>, <code>.err</code>, and <code>.zip</code> archives.
            You can also pick an entire folder; the backend will normalize timestamps, severity, and subsystems before analysis.
          </p>
          <form className="upload" onSubmit={handleSubmit}>
            <div
              className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <p className="dropzone__title">Drop log files, folders, or .zip archives here</p>
              <p className="muted small">We will analyze everything right after you click Analyze.</p>
              <label className="file-input">
                <span>{files.length ? `${files.length} item${files.length > 1 ? 's' : ''} selected` : 'Or browse to choose files or folders'}</span>
                <input
                  type="file"
                  accept=".log,.txt,.out,.err,.zip"
                  multiple
                  webkitdirectory="true"
                  onChange={handleFileChange}
                />
              </label>
            </div>
              {files.length > 0 && (
                <ul className="file-list">
                  {files.map((file) => {
                    const label = file.webkitRelativePath || file.name;
                    return (
                      <li key={`${label}-${file.lastModified}`}>
                        <span className="file-name">{label}</span>
                        <button
                          type="button"
                          className="file-remove"
                          onClick={() => removeFile(file.name, file.size, file.lastModified)}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
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
        <h2>Analysis outputs</h2>
        <div className="outputs">
          <div className="output-box">
            <h3>Errors & timelines</h3>
            {combinedTimeline.length ? (
              <ul>
                {combinedTimeline.map((item, index) => (
                  <li key={`timeline-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Upload a file to see extracted errors and timing details.</p>
            )}
          </div>
          <div className="output-box">
            <h3>Last actions</h3>
            {insights?.failed_actions?.length ? (
              <ul>
                {insights.failed_actions.map((action, index) => (
                  <li key={`action-${index}`}>{action}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">We will summarize the final actions once analysis finishes.</p>
            )}
          </div>
          <div className="output-box">
            <h3>Suggested next steps</h3>
            {insights?.system_failures?.length || insights?.agent_failures?.length ? (
              <ul>
                {(insights.system_failures || []).map((item, index) => (
                  <li key={`system-${index}`}>System: {item}</li>
                ))}
                {(insights.agent_failures || []).map((item, index) => (
                  <li key={`agent-${index}`}>Agent: {item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Actionable next steps will appear here after processing.</p>
            )}
          </div>
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

      <section className="card card--wide">
        <div className="coralogix__header">
          <div>
            <h2>Coralogix search</h2>
            <p className="muted small">Filter by system, subsystem, or search text to pull recent results.</p>
          </div>
          {coralogixResults.webhook_url && (
            <span className="pill">Webhook: {coralogixResults.webhook_url}</span>
          )}
        </div>

        <form className="coralogix__filters" onSubmit={handleCoralogixSubmit}>
          <label>
            <span className="muted small">System</span>
            <input
              type="text"
              name="system"
              value={coralogixFilters.system}
              onChange={handleCoralogixFilterChange}
              placeholder="e.g. payments"
            />
          </label>
          <label>
            <span className="muted small">Subsystem</span>
            <input
              type="text"
              name="subsystem"
              value={coralogixFilters.subsystem}
              onChange={handleCoralogixFilterChange}
              placeholder="e.g. webhook-worker"
            />
          </label>
          <label className="coralogix__query">
            <span className="muted small">Free-text</span>
            <input
              type="text"
              name="query"
              value={coralogixFilters.query}
              onChange={handleCoralogixFilterChange}
              placeholder="Search message text"
            />
          </label>
          <label className="coralogix__page-size">
            <span className="muted small">Page size</span>
            <input
              type="number"
              min="1"
              max="100"
              value={coralogixPageSize}
              onChange={(event) => setCoralogixPageSize(Number(event.target.value) || 1)}
            />
          </label>
          <button type="submit">Query Coralogix</button>
        </form>

        {coralogixStatus && <p className="status">{coralogixStatus}</p>}
        {coralogixError && <p className="error">{coralogixError}</p>}

        {coralogixResults.entries.length > 0 ? (
          <div className="coralogix__entries">
            {coralogixResults.entries.map((entry, index) => (
              <div className="entry" key={`${entry.timestamp}-${index}`}>
                <div className="entry__meta">
                  <span className="pill">{entry.system || 'Unknown system'}</span>
                  {entry.subsystem && <span className="pill">{entry.subsystem}</span>}
                  {entry.severity && (
                    <span className={`badge badge--${entry.severity.toLowerCase()}`}>{entry.severity}</span>
                  )}
                  <span className="muted small">{formatDate(entry.timestamp)}</span>
                </div>
                <p className="entry__message">{entry.message || 'No message reported'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Use the filters above to search Coralogix logs.</p>
        )}

        <div className="coralogix__pagination">
          <button type="button" onClick={() => goToPage(coralogixPage - 1)} disabled={coralogixPage <= 1}>
            Previous
          </button>
          <span className="muted small">
            Page {coralogixPage} of {Number.isFinite(totalPages) ? totalPages : 1}
          </span>
          <button
            type="button"
            onClick={() => goToPage(coralogixPage + 1)}
            disabled={coralogixPage >= totalPages}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
