import './App.css';

function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1>Itay Log Reviewer</h1>
        <p>Review and act on log data with a simple starter stack.</p>
      </header>
      <section className="app__body">
        <div className="card">
          <h2>Backend</h2>
          <p>FastAPI server with a ready-to-use health endpoint.</p>
        </div>
        <div className="card">
          <h2>Frontend</h2>
          <p>React + Vite scaffold with linting and formatting.</p>
        </div>
      </section>
    </main>
  );
}

export default App;
