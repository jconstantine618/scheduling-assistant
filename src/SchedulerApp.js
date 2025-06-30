// src/SchedulerApp.js
import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useEffect,
} from 'react';
import './App.css';

// --- Time and Date Utilities ---
const TIME_SLOTS = [];
for (let i = 7; i < 22; i++) {
  TIME_SLOTS.push(`${String(i).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(i).padStart(2, '0')}:30`);
}

const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

function getWeekDates(start) {
  const week = [];
  const d = new Date(start);
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  d.setDate(d.getDate() - d.getDay());
  for (let i = 0; i < 7; i++) {
    week.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return week;
}

// --- Core Scheduling Algorithm ---
function generateDailySchedule(employees, date) {
    const schedule = new Map();
    employees.forEach(emp => schedule.set(emp.name, new Map()));

    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return schedule;

    const dateStr = date.toISOString().split('T')[0];

    // Step 1: Initialize schedule with OFF or PTO. Mark working hours as 'Available'.
    employees.forEach(emp => {
        const dailyTasks = schedule.get(emp.name);
        const hasPTO = Array.isArray(emp.ptoDates) && emp.ptoDates.includes(dateStr);
        const shiftStartMinutes = timeToMinutes(emp.shift.start);
        const shiftEndMinutes = timeToMinutes(emp.shift.end);

        TIME_SLOTS.forEach(slot => {
            if (hasPTO) {
                dailyTasks.set(slot, 'PTO');
                return;
            }
            const slotMinutes = timeToMinutes(slot);
            if (slotMinutes >= shiftStartMinutes && slotMinutes < shiftEndMinutes) {
                dailyTasks.set(slot, 'Available');
            } else {
                dailyTasks.set(slot, 'OFF');
            }
        });
    });

    // Step 2: Intelligent Lunch Assignment
    const lunchWindows = [
        { start: '11:00', end: '12:30' },
        { start: '12:00', end: '13:30' },
        { start: '12:30', end: '14:00' },
    ];
    const renoLunch = { start: '15:00', end: '16:00' };

    employees.forEach(emp => {
        if (schedule.get(emp.name)?.get(TIME_SLOTS[0]) === 'PTO') return;

        const empLunchWindows = emp.name === 'Katy' ? [renoLunch] : lunchWindows;
        let bestLunchWindow = null;
        let bestScore = -Infinity;

        // Find the best possible lunch window for this employee
        for (const window of empLunchWindows) {
            const lunchStartMinutes = timeToMinutes(window.start);
            const lunchEndMinutes = timeToMinutes(window.end);
            let isWindowViable = true;
            let windowScore = 0;

            // Check if the window is within the employee's available time
            for (let min = lunchStartMinutes; min < lunchEndMinutes; min += 30) {
                const slot = TIME_SLOTS.find(s => timeToMinutes(s) === min);
                if (!slot || schedule.get(emp.name)?.get(slot) !== 'Available') {
                    isWindowViable = false;
                    break;
                }
            }
            if (!isWindowViable) continue;

            // Calculate the impact on coverage if this lunch is taken
            for (let min = lunchStartMinutes; min < lunchEndMinutes; min += 30) {
                const slot = TIME_SLOTS.find(s => timeToMinutes(s) === min);
                const availableForSlot = employees.filter(e => {
                    const task = schedule.get(e.name).get(slot);
                    return e.name !== emp.name && task === 'Available';
                });
                const resCoverage = availableForSlot.filter(e => e.abilities.includes('Reservations')).length;
                const dispCoverage = availableForSlot.filter(e => e.abilities.includes('Dispatch')).length;

                // Penalize heavily for dropping below minimums
                if (resCoverage < 3 || dispCoverage < 1) {
                    windowScore -= 100; 
                } else {
                    windowScore += resCoverage + dispCoverage;
                }
            }

            if (windowScore > bestScore) {
                bestScore = windowScore;
                bestLunchWindow = window;
            }
        }

        // Assign the best found lunch window
        if (bestLunchWindow) {
            const start = timeToMinutes(bestLunchWindow.start);
            const end = timeToMinutes(bestLunchWindow.end);
            for (let min = start; min < end; min += 30) {
                const slot = TIME_SLOTS.find(s => timeToMinutes(s) === min);
                if(slot) schedule.get(emp.name).set(slot, 'Lunch');
            }
        }
    });

    // Step 3: Fill mandatory coverage slots
    TIME_SLOTS.forEach(slot => {
        const slotMinutes = timeToMinutes(slot);
        let neededReservations = (slotMinutes >= 480 && slotMinutes < 1020) ? 3 : (slotMinutes >= 1020 ? 2 : 0);
        let neededDispatch = (slotMinutes >= 480) ? 1 : 0;

        if (neededDispatch === 0 && neededReservations === 0) return;

        const availableForSlot = employees.filter(e => schedule.get(e.name).get(slot) === 'Available');
        
        // Assign Dispatch
        let assignedDispatch = 0;
        for(const emp of availableForSlot) {
            if (assignedDispatch < neededDispatch && emp.abilities.includes('Dispatch')) {
                schedule.get(emp.name).set(slot, 'Dispatch');
                assignedDispatch++;
            }
        }

        // Assign Reservations
        let assignedReservations = 0;
        for(const emp of availableForSlot) {
            if (schedule.get(emp.name).get(slot) === 'Available' && assignedReservations < neededReservations && emp.abilities.includes('Reservations')) {
                schedule.get(emp.name).set(slot, 'Reservations');
                assignedReservations++;
            }
        }
    });

    // Step 4: Fill remaining 'Available' slots with specialist tasks
    employees.forEach(emp => {
        TIME_SLOTS.forEach(slot => {
            if (schedule.get(emp.name).get(slot) === 'Available') {
                schedule.get(emp.name).set(slot, emp.specialistTask);
            }
        });
    });

    return schedule;
}


// --- UI Components ---
const EmployeeRow = ({ emp, dailySchedule }) => {
    const cells = [];
    let i = 0;
    while (i < TIME_SLOTS.length) {
        const currentTask = dailySchedule.get(emp.name)?.get(TIME_SLOTS[i]) || 'OFF';
        let colspan = 1;
        while (i + colspan < TIME_SLOTS.length && (dailySchedule.get(emp.name)?.get(TIME_SLOTS[i + colspan]) || 'OFF') === currentTask) {
            colspan++;
        }

        if (currentTask !== 'OFF' && currentTask !== 'Available') {
            cells.push(
                <td 
                    key={`${emp.name}-${TIME_SLOTS[i]}`} 
                    colSpan={colspan} 
                    className={`task-cell task-${currentTask.toLowerCase().replace(/[^a-z]/g, '')}`}
                >
                    {currentTask}
                </td>
            );
        } else {
             cells.push(<td key={`${emp.name}-${TIME_SLOTS[i]}`} colSpan={colspan}></td>);
        }
        i += colspan;
    }

    return (
        <tr>
            <td>{emp.name}</td>
            {cells}
        </tr>
    );
};

const SchedulerApp = forwardRef(function SchedulerApp(
  { initialEmployees = [], weekStart },
  ref
) {
  const [ptoMap, setPtoMap] = useState({});
  const [manualPto, setManualPto] = useState({});
  const weekDates = useMemo(() => getWeekDates(weekStart || new Date()), [weekStart]);
  
  useEffect(() => {
    if (!weekStart) return;
    const parsed = new Date(weekStart);
    parsed.setMinutes(parsed.getMinutes() + parsed.getTimezoneOffset());
    const startISO = parsed.toISOString();
    const end = new Date(parsed);
    end.setDate(end.getDate() + 7);
    const endISO = end.toISOString();

    fetch(`/api/pto-calendar?start=${startISO}&end=${endISO}`)
      .then(res => res.ok ? res.json() : Promise.reject(res.statusText))
      .then(data => setPtoMap(data.ptoMap || {}))
      .catch(err => {
        console.error('Fetch PTO failed:', err);
        setPtoMap({});
      });
  }, [weekStart]);

  const employees = useMemo(() => {
    return initialEmployees.map(emp => {
        const calendarDates = ptoMap[emp.name] || [];
        const manualDates = manualPto[emp.name] || [];
        return {
            ...emp,
            ptoDates: [...new Set([...calendarDates, ...manualDates])],
        };
    });
  }, [initialEmployees, ptoMap, manualPto]);


  const weeklySchedule = useMemo(() => {
    const fullSchedule = new Map();
    weekDates.forEach(date => {
        if (date.getDay() >= 1 && date.getDay() <= 5) {
            fullSchedule.set(date.toISOString().split('T')[0], generateDailySchedule(employees, date));
        }
    });
    return fullSchedule;
  }, [employees, weekDates]);

  useImperativeHandle(ref, () => ({
    clearOverrides() {
        setManualPto({});
    }
  }));
  
  const weekdays = weekDates.filter(d => d.getDay() >= 1 && d.getDay() <= 5);

  return (
    <div className="scheduler-container">
      {weekdays.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dailySchedule = weeklySchedule.get(dateStr);
        if (!dailySchedule) return null;

        return (
          <div key={dateStr} className="day-schedule">
            <h3>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {TIME_SLOTS.map(slot => (
                    <th key={slot} className={`time-slot-header ${slot.endsWith(':30') ? 'half-hour' : 'full-hour'}`}>
                      {slot.endsWith(':00') ? slot.replace(':', '') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <EmployeeRow key={emp.name} emp={emp} dailySchedule={dailySchedule} />
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  );
});

export default SchedulerApp;
