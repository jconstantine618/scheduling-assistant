import React, { useState, useEffect, useCallback } from 'react';

// ———————————————————————————————————
//  HELPER CONSTANTS & UTILITIES
// ———————————————————————————————————
const COLORS = {
  Reservations: '#4A90E2',
  Dispatch: '#F5A623',
  'Journey Desk': '#50E3C2',
  Network: '#E04F5F',
  Marketing: '#BD10E0',
  Security: '#7ED321',
  Sales: '#9013FE',
  Scheduling: '#F8E71C',
  'Badges/Projects': '#000000',
  Lunch: '#D8D8D8',
  PTO: '#9B9B9B',
  OFF: '#FFFFFF',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = Array.from({ length: (22 - 7) * 2 }, (_, i) => {
  const h = 7 + Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

const SLOT_COUNT = TIME_SLOTS.length;

// Coverage targets
const DAY_TARGET = { res: 3, disp: 1 };
const EVE_TARGET = { res: 2, disp: 1, resGoal: 3 };

// ———————————————————————————————————
//  CORE STATE SHAPES
// ———————————————————————————————————
export default function SchedulerApp({ initialEmployees }) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [schedule, setSchedule] = useState(createBlankSchedule(initialEmployees));
  const [overrides, setOverrides] = useState([]); // granular shift overrides
  const [errors, setErrors] = useState([]); // validation errors fed to chat layer

  // ————————————————————————————————
  //  MAIN SCHEDULER
  // ————————————————————————————————
  const buildSchedule = useCallback(() => {
    const grid = createBlankSchedule(employees);

    // Pass‑0 → PTO + Lunch blocks
    DAYS.forEach(day => {
      Object.entries(employees).forEach(([name, emp]) => {
        if (emp.pto.some(p => p.day === day)) {
          grid[day][name].fill('PTO');
          return;
        }
        // lunch blocks (immutable)
        blockRange(grid, day, name, emp.lunch.start, emp.lunch.end, 'Lunch');
      });
    });

    // Pass‑1 → Mandatory coverage (08‑17)
    DAYS.forEach(day => {
      TIME_SLOTS.forEach((time, idx) => {
        const target = time < '17:00' ? DAY_TARGET : EVE_TARGET;
        balanceSlot(grid, day, idx, target, employees);
      });
    });

    // Pass‑2 → Specialist fill
    DAYS.forEach(day => {
      Object.entries(employees).forEach(([name, emp]) => {
        if (!emp.specialistTask) return;
        TIME_SLOTS.forEach((time, idx) => {
          if (time < emp.shift.start || time >= emp.shift.end) return;
          if (grid[day][name][idx] === 'OFF') grid[day][name][idx] = emp.specialistTask;
        });
      });
    });

    // Pass‑3 → Apply overrides (highest priority)
    overrides.forEach(o => {
      blockRange(grid, o.day, o.employeeName, o.startTime, o.endTime, o.task);
    });

    setSchedule(grid);
    setErrors(validate(grid));
  }, [employees, overrides]);

  useEffect(buildSchedule, [buildSchedule]);

  // ————————————————————————————————
  //  RENDERING HELPERS (omitted here for brevity)
  // ————————————————————————————————
  return <div>{/* render schedule & error list */}</div>;
}

// ———————————————————————————————————
//  PURE FUNCTIONS (no React)
// ———————————————————————————————————
function createBlankSchedule(empObj) {
  const schedule = {};
  DAYS.forEach(day => {
    schedule[day] = {};
    Object.keys(empObj).forEach(name => {
      schedule[day][name] = new Array(SLOT_COUNT).fill('OFF');
    });
  });
  return schedule;
}

function blockRange(grid, day, name, start, end, task) {
  if (!start || !end) return;
  const s = TIME_SLOTS.findIndex(t => t >= start);
  const e = TIME_SLOTS.findLastIndex(t => t < end);
  if (s === -1 || e === -1) return;
  for (let i = s; i <= e; i++) grid[day][name][i] = task;
}

function balanceSlot(grid, day, idx, tgt, emps) {
  const count = { res: 0, disp: 0 };
  const free = { res: [], disp: [] };

  Object.entries(emps).forEach(([name, emp]) => {
    const slot = grid[day][name][idx];
    if (slot === 'Reservations') count.res++;
    else if (slot === 'Dispatch') count.disp++;
    else if (slot === 'OFF' && inShift(emp, idx)) {
      if (emp.abilities.includes('Reservations')) free.res.push(name);
      if (emp.abilities.includes('Dispatch')) free.disp.push(name);
    }
  });

  // Demote if over‑allocated
  while (count.res > tgt.res) demote(grid, day, idx, 'Reservations', count);
  while (count.disp > tgt.disp) demote(grid, day, idx, 'Dispatch', count);

  // Promote if under‑staffed
  while (count.res < tgt.res && free.res.length) promote(grid, day, idx, free.res.shift(), 'Reservations', count);
  while (count.disp < tgt.disp && free.disp.length) promote(grid, day, idx, free.disp.shift(), 'Dispatch', count);
}

function demote(grid, day, idx, task, countObj) {
  const victim = Object.keys(grid[day]).find(n => grid[day][n][idx] === task);
  if (!victim) return;
  grid[day][victim][idx] = 'OFF';
  if (task === 'Reservations') countObj.res--; else countObj.disp--;
}

function promote(grid, day, idx, name, task, countObj) {
  grid[day][name][idx] = task;
  if (task === 'Reservations') countObj.res++; else countObj.disp++;
}

function inShift(emp, idx) {
  const time = TIME_SLOTS[idx];
  return time >= emp.shift.start && time < emp.shift.end && !emp.pto?.some(p => p.day === emp.day);
}

function validate(grid) {
  const errs = [];
  DAYS.forEach(day => {
    TIME_SLOTS.forEach((time, idx) => {
      const res = [], disp = [];
      Object.entries(grid[day]).forEach(([name, slots]) => {
        if (slots[idx] === 'Reservations') res.push(name);
        if (slots[idx] === 'Dispatch') disp.push(name);
      });
      const isDay = time < '17:00';
      const tgt = isDay ? DAY_TARGET : EVE_TARGET;
      if (res.length !== tgt.res || disp.length !== tgt.disp)
        errs.push({ day, time, res: res.length, disp: disp.length });
    });
  });
  return errs;
}
