// src/EmployeeEditor.js
import React, { useState, useEffect } from 'react';
import './App.css'; // We'll share the same CSS file

const ALL_ABILITIES = [
  'Reservations', 'Dispatch', 'Journey Desk', 'Network', 
  'Marketing', 'Security', 'Sales', 'Scheduling', 'Badges/Projects'
];

export default function EmployeeEditor({ employee, onSave, onClose }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    // When the component loads or the employee prop changes, populate the form
    setFormData(employee || {
      name: '',
      shift: { start: '09:00', end: '17:00' },
      lunch: { start: '12:00', end: '13:30' },
      hours: 40,
      abilities: [],
      specialistTask: '',
    });
  }, [employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAbilityChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => {
      const newAbilities = checked
        ? [...prev.abilities, name]
        : prev.abilities.filter(ability => ability !== name);
      return { ...prev, abilities: newAbilities };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  // The modal should not render if there's no employee data to edit/create
  if (!employee) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{formData.name ? 'Edit Employee' : 'Add New Employee'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required disabled={!!employee.name} />
          </div>
          <div className="form-group-inline">
            <div className="form-group">
                <label>Shift Start</label>
                <input type="time" name="shift.start" value={formData.shift?.start || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
                <label>Shift End</label>
                <input type="time" name="shift.end" value={formData.shift?.end || ''} onChange={handleChange} />
            </div>
          </div>
           <div className="form-group-inline">
            <div className="form-group">
                <label>Lunch Start</label>
                <input type="time" name="lunch.start" value={formData.lunch?.start || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
                <label>Lunch End</label>
                <input type="time" name="lunch.end" value={formData.lunch?.end || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>Specialist Task</label>
            <input type="text" name="specialistTask" value={formData.specialistTask || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Abilities</label>
            <div className="checkbox-group">
              {ALL_ABILITIES.map(ability => (
                <label key={ability}>
                  <input
                    type="checkbox"
                    name={ability}
                    checked={formData.abilities?.includes(ability) || false}
                    onChange={handleAbilityChange}
                  /> {ability}
                </label>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="primary">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
