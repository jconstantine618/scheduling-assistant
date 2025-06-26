// src/App.js
import React, { useRef, useState } from 'react';
import SchedulerApp from './SchedulerApp.js';
import { INITIAL_EMPLOYEES as initialEmployees } from './data/initialEmployees.js';
import './App.css';

export default function App() {
  const schedulerRef = useRef(null);

  // 1️⃣ track which week to display (ISO date string)
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    // back up to most recent Sunday
    today.setDate(today.getDate() - today.getDay());
    return today.toISOString().split('T')[0];
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleFileChange = e => {
    setSelectedFile(e.target.files[0]);
    setError('');
  };

  // 2️⃣ use the dev‐server proxy so we hit :5001 under the hood
  const runOcrAndApply = async () => {
    if (!selectedFile) {
      setError('Please choose a file first.');
      return;
    }
    const form = new FormData();
    form.append('file', selectedFile);
    try {
      const res = await fetch('/api/parse-pto', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      const { pto } = await res.json();
      schedulerRef.current.updateEmployeePTOs(pto);
    } catch (err) {
      setError(err.message);
    }
  };

  const clearOverrides = () => {
    schedulerRef.current.clearOverrides();
  };

  return (
    <div className="app-container">
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <button
          className="collapse-btn"
          onClick={() => setSidebarCollapsed(c => !c)}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {!sidebarCollapsed && (
          <div className="controls">
            <h2>Controls</h2>

            <section>
              <h3>Week Starting</h3>
              <input
                type="date"
                value={weekStart}
                onChange={e => setWeekStart(e.target.value)}
              />
            </section>

            <section>
              <h3>Import PTO</h3>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
              <button onClick={runOcrAndApply}>
                Run OCR &amp; Apply
              </button>
              {error && <p className="error">Error: {error}</p>}
            </section>

            <section>
              <h3>Update PTO Manually</h3>
              {/* your manual PTO inputs */}
            </section>

            <section>
              <h3>Add Override</h3>
              {/* your override inputs */}
              <button
                onClick={clearOverrides}
                className="danger"
              >
                Clear Overrides
              </button>
            </section>
          </div>
        )}
      </aside>

      <main className="scheduler-panel">
        <SchedulerApp
          ref={schedulerRef}
          initialEmployees={initialEmployees}
          weekStart={weekStart}
        />
      </main>
    </div>
  );
}
