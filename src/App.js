// src/App.js – thin wrapper around SchedulerApp
//-------------------------------------------------
import React from 'react';
import SchedulerApp from './SchedulerApp';

// Import your initial employee seed. You can inline the object here if you prefer.
import { INITIAL_EMPLOYEES } from './data/initialEmployees';

export default function App() {
  return <SchedulerApp initialEmployees={INITIAL_EMPLOYEES} />;
}
