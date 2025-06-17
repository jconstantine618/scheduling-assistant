import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

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
//  MAIN SCHEDULER COMPONENT
//  ⚠️ wrapped with forwardRef so the parent (chat UI) can
//  imperatively invoke actions like PTO or shift overrides
// ———————————————————————————————————
const SchedulerApp = forwardRef(function SchedulerApp({ initialEmployees }, ref) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [schedule, setSchedule] = useState(() => createBlankSchedule(initialEmployees));
  const [overrides, setOverrides] = useState([]); // granular shift overrides
  const [errors, setErrors] = useState([]);

  // Expose mutation helpers to the parent via ref --------------------------------
  useImperativeHandle(ref, () => ({
    /**
     * PTO utility used by chat layer when it parses
     * { action:"update_employee_data", ... }
     */
    updateEmployeePTO(employeeName, ptoDays /* string[] */) {
      setEmployees(prev => {
        const cloned = { ...prev };
        if (!cloned[employeeName]) return prev;
        const merged = new Set(cloned[employeeName].pto.map(p => p.day));
        ptoDays.forEach(d => merged.add(d));
        cloned[employeeName] = {
          ...cloned[employeeName],
          pto: Array.from(merged).map(day => ({ day })),
        };
        return cloned;
      });
    },

    /**
     * Shift override ("create_shift") utility.
     */
    addShiftOverride({ employeeName, day, task, startTime, endTime }) {
      setOverrides(prev => [
        ...prev,
        { employeeName, day, task, startTime, endTime },
      ]);
    },

    /**
     * Convenience reset used by chat "Reset Chat" button.
     */
    clearOverrides() {
      setOverrides([]);
    },
  }));

  // ————————————————————————————————
  //  BUILD SCHEDULE (pure algorithm)
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
        blockRange(grid, day, name, emp.lunch.start, emp.lunch.end, 'Lunch');
      });
    });

    // Pass‑1 → Mandatory coverage (08‑17 / 17‑21)
    DAYS.forEach(day => {
      TIME_SLOTS.forEach((time, idx) => {
        const tgt = time < '17:00' ? DAY_TARGET : EVE_TARGET;
        balanceSlot(grid, day, idx, tgt, employees);
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

    // Pass‑3 → Manual overrides (highest priority)
    overrides.forEach(o => {
      blockRange(grid, o.day, o.employeeName, o.startTime, o.endTime, o.task);
    });

    setSchedule(grid);
    setErrors(validate(grid));
  }, [employees, overrides]);

  useEffect(buildSchedule, [buildSchedule]);

  // ————————————————————————————————
  //  BASIC RENDER (table + error banner)
  // ————————————————————————————————
  return (
    <div className="flex flex-col">
      {errors.length > 0 && (
        <div className="bg-red-600 text-white p-2 text-xs">
          {errors.length} coverage rule violation(s) – open chat for details.
        </div>
      )}
      {DAYS.map(day => (
        <div key={day} className="mb-6">
          <h3 className="font-bold text-lg mb-2">{day}</h3>
          <ScheduleGrid
            day={day}
            schedule={schedule[day]}
            employees={employees}
          />
        </div>
      ))}
    </div>
  );
});

export default SchedulerApp;

// ———————————————————————————————————
//  SUBCOMPONENT: Grid renderer
// ———————————————————————————————————
function ScheduleGrid({ day, schedule, employees }) {
  if (!schedule) return <p>Generating…</p>;
  return (
    <div className="overflow-x-auto shadow rounded">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="sticky left-0 bg-gray-200 z-10 p-1 text-left w-40">Employee</th>
            {TIME_SLOTS.map(t => (
              <th key={t} className="p-1 text-xs font-normal w-20 border-l">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(employees)
            .sort()
            .map(name => (
              <tr key={name} className="odd:bg-gray-50">
                <td className="sticky left-0 bg-white odd:bg-gray-50 p-1 text-sm border-r">
                  {name}
                </td>
                {schedule[name].map((task, i) => (
                  <td
                    key={i}
                    style={{
                      backgroundColor: COLORS[task],
                      color: ['Badges/Projects', 'PTO'].includes(task)
                        ? 'white'
                        : 'black',
                    }}
                    className="text-center text-[10px] border-l"
                  >
                    {task !== schedule[name][i - 1] ? task.replace(/s$/, '') : ''}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ———————————————————————————————————
//  PURE HELPERS (algorithm only)
// ———————————————————————————————————
function createBlankSchedule(empObj) {
  const schedule = {};
  DAYS.forEach(day => {
    schedule[day] = {};
    Object.keys(empObj).forEach(name => {
      schedule[day][name] = Array(SLOT_COUNT).fill('OFF');
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

  while (count.res > tgt.res) demote(grid, day, idx, 'Reservations', count);
  while (count.disp > tgt.disp) demote(grid, day, idx, 'Dispatch', count);
  while (count.res < tgt.res && free.res.length)
    promote(grid, day, idx, free.res.shift(), 'Reservations', count);
  while (count.disp < tgt.disp && free.disp.length)
    promote(grid, day, idx, free.disp.shift(), 'Dispatch', count);
}

function demote(grid, day, idx, task, countObj) {
  const victim = Object.keys(grid[day]).find(n => grid[day][n][idx] === task);
  if (!victim) return;
  grid[day][victim][idx]

