// src/App.js
import React, { useRef, useState } from 'react';
import SchedulerApp from './SchedulerApp.js';
import EmployeeEditor from './EmployeeEditor.js'; // Import the new editor
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

  // --- NEW: Employee state management ---
  const [employees, setEmployees] = useState(initialEmployeesArray);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setIsModalOpen(true);
  };

  const handleAddNewEmployee = () => {
    setEditingEmployee({}); // Pass an empty object for a new employee
    setIsModalOpen(true);
  };
  
  const handleSaveEmployee = (employeeData) => {
    setEmployees(prev => {
        const existing = prev.find(e => e.name === employeeData.name);
        if (existing) {
            // Update existing employee
            return prev.map(e => e.name === employeeData.name ? employeeData : e);
        } else {
            // Add new employee
            return [...prev, employeeData];
        }
    });
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleRemoveEmployee = (employeeName) => {
      if (window.confirm(`Are you sure you want to remove ${employeeName}?`)) {
          setEmployees(prev => prev.filter(e => e.name !== employeeName));
      }
  };


  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - today.getDay());
    return today.toISOString().split('T')[0];
  });

  const clearOverrides = () => {
    schedulerRef.current.clearOverrides();
  };

  const handleExportToPdf = async () => {
    setIsExporting(true);
    const schedulerPanel = document.querySelector('.scheduler-panel');
    const daySchedules = schedulerPanel.querySelectorAll('.day-schedule');
    
    const pdf = new jsPDF('landscape', 'in', 'letter');
    const page_width = 11;
    const margin = 0.25;

    for (let i = 0; i < daySchedules.length; i += 2) {
      const chunk = [daySchedules[i]];
      if (daySchedules[i+1]) chunk.push(daySchedules[i+1]);

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      chunk.forEach(el => tempContainer.appendChild(el.cloneNode(true)));
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, { scale: 2, useCORS: true, logging: false });
      document.body.removeChild(tempContainer);
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = page_width - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
    }

    pdf.save(`schedule-week-of-${weekStart}.pdf`);
    setIsExporting(false);
  };

  return (
    <div className="app-container">
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <button className="collapse-btn" onClick={() => setSidebarCollapsed(c => !c)}>
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
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
            </section>
            <section>
              <h3>Add Override</h3>
              <button onClick={clearOverrides} className="danger">Clear Overrides</button>
            </section>
            
            <section className="employee-management">
                <h3>Manage Employees</h3>
                <ul className="employee-list">
                    {employees.map(emp => (
                        <li key={emp.name}>
                            <span>{emp.name}</span>
                            <div>
                                <button className="edit-btn" onClick={() => handleEditEmployee(emp)}>Edit</button>
                                <button className="remove-btn" onClick={() => handleRemoveEmployee(emp.name)}>Remove</button>
                            </div>
                        </li>
                    ))}
                </ul>
                <button onClick={handleAddNewEmployee}>Add New Employee</button>
            </section>

          </div>
        )}
      </aside>

      <main className="scheduler-panel">
        <SchedulerApp
          ref={schedulerRef}
          initialEmployees={employees}
          weekStart={weekStart}
        />
      </main>

      {isModalOpen && <EmployeeEditor employee={editingEmployee} onSave={handleSaveEmployee} onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

