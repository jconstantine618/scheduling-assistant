// src/App.js
import React, { useRef, useState } from 'react';
import SchedulerApp from './SchedulerApp.js';
import { INITIAL_EMPLOYEES } from './data/initialEmployees.js';
import './App.css';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Convert the initial employees object into an array of objects
const initialEmployeesArray = Object.entries(INITIAL_EMPLOYEES).map(([name, details]) => ({
    name,
    ...details,
}));


export default function App() {
  const schedulerRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 1️⃣ track which week to display (ISO date string)
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    // back up to most recent Sunday
    today.setDate(today.getDate() - today.getDay());
    return today.toISOString().split('T')[0];
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = e => {
    setSelectedFile(e.target.files[0]);
    setError('');
  };

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
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || res.statusText);
      }
      const { pto } = await res.json();
      schedulerRef.current.updateEmployeePTOs(pto);
    } catch (err) {
      setError(err.message);
    }
  };

  const clearOverrides = () => {
    schedulerRef.current.clearOverrides();
  };

  const handleExportToPdf = async () => {
    setIsExporting(true);
    const schedulerPanel = document.querySelector('.scheduler-panel');
    const daySchedules = schedulerPanel.querySelectorAll('.day-schedule');
    
    // A4 paper in landscape is 297mm wide x 210mm high. Use inches for US standard. 11x8.5
    const pdf = new jsPDF('landscape', 'in', 'letter');
    const page_width = 11;
    const page_height = 8.5;
    const margin = 0.25;

    for (let i = 0; i < daySchedules.length; i += 2) {
      const chunk = [daySchedules[i]];
      if (daySchedules[i+1]) {
        chunk.push(daySchedules[i+1]);
      }

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      chunk.forEach(el => tempContainer.appendChild(el.cloneNode(true)));
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        scale: 2, // Increase resolution for better quality
        useCORS: true,
        logging: false,
      });

      document.body.removeChild(tempContainer);
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = page_width - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (i > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
    }

    pdf.save(`schedule-week-of-${weekStart}.pdf`);
    setIsExporting(false);
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
                <button onClick={handleExportToPdf} disabled={isExporting}>
                    {isExporting ? 'Exporting...' : 'Export to PDF'}
                </button>
            </section>
            
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
              <h3>Add Override</h3>
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
          initialEmployees={initialEmployeesArray}
          weekStart={weekStart}
        />
      </main>
    </div>
  );
}

