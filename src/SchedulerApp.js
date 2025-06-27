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

  // Step 1: Initialize schedule with OFF, PTO, and Lunch
  employees.forEach(emp => {
    const dailyTasks = schedule.get(emp.name);
    const hasPTO = Array.isArray(emp.ptoDates) && emp.ptoDates.includes(dateStr);

    if (hasPTO) {
        TIME_SLOTS.forEach(slot => dailyTasks.set(slot, 'PTO'));
        return; 
    }
    
    const shiftStartMinutes = timeToMinutes(emp.shift.start);
    const shiftEndMinutes = timeToMinutes(emp.shift.end);
    const lunchStartMinutes = timeToMinutes(emp.lunch.start);
    const lunchEndMinutes = timeToMinutes(emp.lunch.end);

    TIME_SLOTS.forEach(slot => {
      const slotMinutes = timeToMinutes(slot);
      if (slotMinutes >= shiftStartMinutes && slotMinutes < shiftEndMinutes) {
        if (emp.lunch.start && slotMinutes >= lunchStartMinutes && slotMinutes < lunchEndMinutes) {
          dailyTasks.set(slot, 'Lunch');
        } else {
          if (emp.name === 'Antje') {
            dailyTasks.set(slot, 'Journey Desk');
          } else {
            dailyTasks.set(slot, 'Available');
          }
        }
      } else {
        dailyTasks.set(slot, 'OFF');
      }
    });
  });

  // Step 2: Fill mandatory coverage slots based on time of day
  TIME_SLOTS.forEach(slot => {
    const slotMinutes = timeToMinutes(slot);
    let neededReservations = 0;
    let neededDispatch = 0;

    if (slotMinutes >= 480 && slotMinutes < 1020) { // 08:00 - 17:00
      neededReservations = 3;
      neededDispatch = 1;
    } else if (slotMinutes >= 1020) { // 17:00+
      neededReservations = 2;
      neededDispatch = 1;
    } else {
      return;
    }

    let dispatchCount = 0;
    let reservationsCount = 0;
    
    const availableEmployees = employees.filter(emp => schedule.get(emp.name)?.get(slot) === 'Available');

    employees.forEach(emp => {
        const task = schedule.get(emp.name)?.get(slot);
        if (task === 'Dispatch') dispatchCount++;
        if (task === 'Reservations') reservationsCount++;
    });

    for (const emp of availableEmployees) {
      if (dispatchCount < neededDispatch && emp.abilities.includes('Dispatch')) {
        schedule.get(emp.name).set(slot, 'Dispatch');
        dispatchCount++;
      }
    }
    
    for (const emp of availableEmployees) {
      if (schedule.get(emp.name)?.get(slot) === 'Available') {
        if (reservationsCount < neededReservations && emp.abilities.includes('Reservations')) {
          schedule.get(emp.name).set(slot, 'Reservations');
          reservationsCount++;
        }
      }
    }
  });

  // Step 3: Fill remaining 'Available' slots with specialist tasks
  employees.forEach(emp => {
    const dailyTasks = schedule.get(emp.name);
    TIME_SLOTS.forEach(slot => {
      if (dailyTasks.get(slot) === 'Available') {
        dailyTasks.set(slot, emp.specialistTask);
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
        if (date.getDay() >= 1 && date.getDay() <= 5) { // Only for Mon-Fri
            fullSchedule.set(date.toISOString().split('T')[0], generateDailySchedule(employees, date));
        }
    });
    return fullSchedule;
  }, [employees, weekDates]);

  useImperativeHandle(ref, () => ({
    updateEmployeePTOs(newPtoMap) {
        setManualPto(currentManualPto => {
            const updated = { ...currentManualPto };
            for (const name in newPtoMap) {
                updated[name] = [...new Set([...(updated[name] || []), ...newPtoMap[name]])];
            }
            return updated;
        });
    },
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
