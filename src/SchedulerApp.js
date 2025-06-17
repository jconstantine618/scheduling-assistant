// src/SchedulerApp.js
// High‑level scheduling component that owns state + exposes methods
//---------------------------------------------------------------
import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

/* ———————————————————————— CONSTANTS ———————————————————————— */
export const COLORS = {
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

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const TIME_SLOTS = Array.from({ length: (22 - 7) * 2 }, (_, i) => {
  const h = 7 + Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});
const SLOT_COUNT = TIME_SLOTS.length;
const DAY_TARGET = { res: 3, disp: 1 };
const EVE_TARGET = { res: 2, disp: 1 };

/* —————————————————————— MAIN COMPONENT —————————————————————— */
const SchedulerApp = forwardRef(function SchedulerApp({ initialEmployees }, ref) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [overrides, setOverrides] = useState([]);
  const [schedule, setSchedule] = useState(() => createBlankSchedule(initialEmployees));

  // Expose methods to parent (chat layer)
  useImperativeHandle(ref, () => ({
    updateEmployeePTO(name, ptoDays) {
      setEmployees(prev => {
        const next = { ...prev };
        if (!next[name]) return prev;
        const merged = new Set(next[name].pto.map(p => p.day));
        ptoDays.forEach(d => merged.add(d));
        next[name] = { ...next[name], pto: Array.from(merged).map(day => ({ day })) };
        return next;
      });
    },
    addShiftOverride(o) {
      setOverrides(prev => [...prev, o]);
    },
    clearOverrides() {
      setOverrides([]);
    },
  }));

  /* ——— build schedule ——— */
  const buildSchedule = useCallback(() => {
    const grid = createBlankSchedule(employees);

    // 0) PTO + Lunch blocks
    DAYS.forEach(day => {
      Object.entries(employees).forEach(([name, emp]) => {
        if (emp.pto.some(p => p.day === day)) {
          grid[day][name].fill('PTO');
          return;
        }
        blockRange(grid, day, name, emp.lunch.start, emp.lunch.end, 'Lunch');
      });
    });

    // 1) Mandatory coverage targets
    DAYS.forEach(day => {
      TIME_SLOTS.forEach((time, idx) => {
        const tgt = time < '17:00' ? DAY_TARGET : EVE_TARGET;
        balanceSlot(grid, day, idx, tgt, employees);
      });
    });

    // 2) Specialist tasks
    DAYS.forEach(day => {
      Object.entries(employees).forEach(([name, emp]) => {
        if (!emp.specialistTask) return;
        TIME_SLOTS.forEach((time, idx) => {
          if (time < emp.shift.start || time >= emp.shift.end) return;
          if (grid[day][name][idx] === 'OFF') grid[day][name][idx] = emp.specialistTask;
        });
      });
    });

    // 3) Manual overrides (highest priority)
    overrides.forEach(o => blockRange(grid, o.day, o.employeeName, o.startTime, o.endTime, o.task));

    setSchedule(grid);
  }, [employees, overrides]);

  useEffect(buildSchedule, [buildSchedule]);

  if (!schedule) return null;
  return (
    <div className="overflow-x-auto p-2">
      {DAYS.map(day => (
        <div key={day} className="mb-6">
          <h3 className="font-semibold mb-1">{day}</h3>
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-100 p-1 border">Employee</th>
                {TIME_SLOTS.map(t => (
                  <th key={t} className="p-1 border">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(employees).sort().map(name => (
                <tr key={name} className="odd:bg-gray-50">
                  <td className="sticky left-0 bg-white odd:bg-gray-50 p-1 border font-medium">{name}</td>
                  {schedule[day][name].map((task, i) => (
                    <td
                      key={i}
                      className="border text-center"
                      style={{ background: COLORS[task], color: ['PTO', 'Badges/Projects'].includes(task) ? 'white' : 'black' }}
                    >
                      {task !== schedule[day][name][i - 1] ? task : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
});

export default SchedulerApp;

/* ——————————————————————— helpers ——————————————————————— */
function createBlankSchedule(empObj) {
  const out = {};
  DAYS.forEach(d => {
    out[d] = {};
    Object.keys(empObj).forEach(name => (out[d][name] = Array(SLOT_COUNT).fill('OFF')));
  });
  return out;
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
  while (count.res > tgt.res) demote(grid, day, idx, 'Reservations', count);
  while (count.disp > tgt.disp) demote(grid, day, idx, 'Dispatch', count);
  while (count.res < tgt.res && free.res.length) promote(grid, day, idx, free.res.shift(), 'Reservations', count);
  while (count.disp < tgt.disp && free.disp.length) promote(grid, day, idx, free.disp.shift(), 'Dispatch', count);
}

function demote(grid, day, idx, task, c) {
  const name = Object.keys(grid[day]).find(n => grid[day][n][idx] === task);
  if (name) {
    grid[day][name][idx] = 'OFF';
    task === 'Reservations' ? c.res-- : c.disp--;
  }
}
function promote(grid, day, idx, name, task, c) {
  grid[day][name][idx] = task;
  task === 'Reservations' ? c
