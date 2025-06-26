// src/SchedulerApp.js
import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import './App.css';

/**
 * Given any ISO date string (or Date), returns an array of
 * Date objects for Sunday→Saturday of that week.
 */
function getWeekDates(start) {
  const week = [];
  const d = new Date(start);
  d.setDate(d.getDate() - d.getDay()); // back up to Sunday
  for (let i = 0; i < 7; i++) {
    week.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return week;
}

const SchedulerApp = forwardRef(function SchedulerApp(
  { initialEmployees = [], weekStart },
  ref
) {
  // _employees_ is always an array
  const [employees, setEmployees] = useState(initialEmployees);
  // compute our 7 headers once, and whenever weekStart changes
  const [weekDates, setWeekDates] = useState(
    getWeekDates(weekStart || new Date())
  );

  useEffect(() => {
    const parsed = weekStart ? new Date(weekStart) : new Date();
    setWeekDates(getWeekDates(parsed));

    // build ISO strings for the API call
    const startISO = parsed.toISOString().split('T')[0];
    const end = new Date(parsed);
    end.setDate(end.getDate() + 6);
    const endISO = end.toISOString().split('T')[0];

    fetch(`/api/pto-calendar?start=${startISO}&end=${endISO}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(({ ptoMap }) => {
        setEmployees((curr) =>
          curr.map((emp) => ({
            ...emp,
            ptoDates: Array.isArray(ptoMap[emp.name])
              ? ptoMap[emp.name]
              : [],
          }))
        );
      })
      .catch((err) => console.error('Fetch PTO failed:', err));
  }, [weekStart]);

  // expose these two methods to the parent via ref
  useImperativeHandle(ref, () => ({
    updateEmployeePTOs(ptoMap) {
      setEmployees((curr) =>
        curr.map((emp) => ({
          ...emp,
          ptoDates: Array.isArray(ptoMap[emp.name])
            ? ptoMap[emp.name]
            : [],
        }))
      );
    },
    clearOverrides() {
      setEmployees(initialEmployees);
    },
  }));

  return (
    <div className="scheduler-panel">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            {weekDates.map((d) => (
              <th key={d.toDateString()}>
                {d.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'numeric',
                  day: 'numeric',
                })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.name}>
              <td>{emp.name}</td>
              {weekDates.map((d) => {
                const dateStr = d.toISOString().split('T')[0];
                const hasPTO =
                  Array.isArray(emp.ptoDates) &&
                  emp.ptoDates.includes(dateStr);
                return <td key={dateStr}>{hasPTO ? 'PTO' : ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default SchedulerApp;
