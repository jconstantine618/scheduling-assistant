import React, { useState, useEffect, useCallback } from 'react';

// --- Helper Functions & Initial Data ---

const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(229, 231, 235, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const COLORS = {
    'Reservations': '#4A90E2', 'Dispatch': '#F5A623', 'Journey Desk': '#50E3C2',
    'Network': '#E04F5F', 'Marketing': '#BD10E0', 'Security': '#7ED321', 'Sales': '#9013FE',
    'Scheduling': '#F8E71C', 'Badges/Projects': '#000000', 'Lunch': '#D8D8D8',
    'PTO': '#9B9B9B', 'OFF': '#FFFFFF'
};

const ALL_ABILITIES = [
    'Reservations', 'Dispatch', 'Journey Desk', 'Network', 
    'Marketing', 'Security', 'Sales', 'Scheduling', 'Badges/Projects'
];

const INITIAL_EMPLOYEES = {
    'Antje': { shift: { start: '07:30', end: '13:30' }, hours: 30, lunch: { start: '', end: '' }, abilities: ['Journey Desk'], specialistTask: 'Journey Desk', specialistTarget: 30, pto: [] },
    'Adam': { shift: { start: '07:30', end: '17:00' }, hours: 40, lunch: { start: '12:30', end: '14:00' }, abilities: ['Reservations', 'Dispatch', 'Network'], specialistTask: 'Network', specialistTarget: 2, pto: [] },
    'Heather': { shift: { start: '07:00', end: '16:30' }, hours: 40, lunch: { start: '11:00', end: '12:30' }, abilities: ['Reservations', 'Dispatch', 'Network'], specialistTask: 'Network', specialistTarget: 15, pto: [] },
    'Sheridan': { shift: { start: '07:30', end: '17:00' }, hours: 40, lunch: { start: '12:00', end: '13:30' }, abilities: ['Reservations', 'Dispatch', 'Network'], specialistTask: 'Network', specialistTarget: 5, pto: [] },
    'Katy': { shift: { start: '12:00', end: '21:00' }, hours: 40, lunch: { start: '15:00', end: '16:00' }, abilities: ['Reservations', 'Dispatch', 'Badges/Projects'], specialistTask: 'Badges/Projects', specialistTarget: 2, pto: [] },
    'SydPo': { shift: { start: '11:30', end: '21:00' }, hours: 40, lunch: { start: '16:00', end: '17:30' }, abilities: ['Reservations', 'Dispatch', 'Scheduling'], specialistTask: 'Scheduling', specialistTarget: 5, pto: [] },
    'Elliott': { shift: { start: '07:30', end: '17:00' }, hours: 40, lunch: { start: '12:00', end: '13:30' }, abilities: ['Reservations', 'Dispatch', 'Marketing'], specialistTask: 'Marketing', specialistTarget: 2, pto: [] },
    'Brian Adie': { shift: { start: '07:30', end: '17:00' }, hours: 40, lunch: { start: '12:30', end: '14:00' }, abilities: ['Reservations', 'Dispatch', 'Journey Desk'], specialistTask: 'Journey Desk', specialistTarget: 15, pto: [] },
    'Paul': { shift: { start: '07:30', end: '17:00' }, hours: 40, lunch: { start: '12:30', end: '14:00' }, abilities: ['Reservations', 'Dispatch', 'Security'], specialistTask: 'Security', specialistTarget: 25, pto: [] },
    'Shelby': { shift: { start: '07:30', end: '17:00' }, hours: 40, lunch: { start: '12:30', end: '14:00' }, abilities: ['Reservations', 'Dispatch', 'Journey Desk'], specialistTask: 'Journey Desk', specialistTarget: 8, pto: [] },
    'SydMo': { shift: { start: '07:30', end: '17:00' }, hours: 40, lunch: { start: '12:00', end: '13:30' }, abilities: ['Reservations', 'Dispatch', 'Sales'], specialistTask: 'Sales', specialistTarget: 5, pto: [] },
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = Array.from({ length: (22 - 7) * 2 }, (_, i) => {
    const h = 7 + Math.floor(i / 2);
    const m = (i % 2) * 30;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

const getInitialMessage = () => ([{ sender: 'assistant', text: 'Hello! Please enter your Gemini API key to begin. It will be stored securely in your browser.' }]);


// --- Child Components ---

const EmployeeForm = ({ employee, employeeName, onUpdate, onRemove }) => {
    const [formData, setFormData] = useState(employee);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        const [field, subfield] = name.split('.');
        
        if (subfield) {
            setFormData(prev => ({ ...prev, [field]: { ...prev[field], [subfield]: value } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
        }
    };

    const handleAbilityChange = (ability) => {
        const newAbilities = formData.abilities.includes(ability)
            ? formData.abilities.filter(a => a !== ability)
            : [...formData.abilities, ability];
        setFormData(prev => ({ ...prev, abilities: newAbilities }));
    };

    const handleUpdate = () => {
        onUpdate(employeeName, formData);
    };

    return (
        <div className="p-4 border rounded-lg bg-white mb-4">
            <h4 className="font-bold text-lg mb-2">{employeeName}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <input type="number" name="hours" value={formData.hours} onChange={handleChange} className="p-2 border rounded" placeholder="Weekly Hours" />
                <input type="text" name="specialistTask" value={formData.specialistTask} onChange={handleChange} className="p-2 border rounded" placeholder="Specialist Task" />
                <input type="text" name="shift.start" value={formData.shift.start} onChange={handleChange} className="p-2 border rounded" placeholder="Shift Start (HH:MM)" />
                <input type="text" name="shift.end" value={formData.shift.end} onChange={handleChange} className="p-2 border rounded" placeholder="Shift End (HH:MM)" />
                <input type="text" name="lunch.start" value={formData.lunch.start} onChange={handleChange} className="p-2 border rounded" placeholder="Lunch Start (HH:MM)" />
                <input type="text" name="lunch.end" value={formData.lunch.end} onChange={handleChange} className="p-2 border rounded" placeholder="Lunch End (HH:MM)" />
            </div>
            <div className="mt-4">
                <h5 className="font-semibold mb-2 text-sm">Abilities</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {ALL_ABILITIES.map(ability => (
                        <label key={ability} className="flex items-center space-x-2">
                            <input type="checkbox" checked={formData.abilities.includes(ability)} onChange={() => handleAbilityChange(ability)} />
                            <span>{ability}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="mt-4 flex space-x-2">
                <button onClick={handleUpdate} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Update</button>
                <button onClick={() => onRemove(employeeName)} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Remove</button>
            </div>
        </div>
    );
};


// --- Main App Component ---

export default function App() {
    const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
    const [schedule, setSchedule] = useState(null);
    const [chatHistory, setChatHistory] = useState(getInitialMessage());
    const [userInput, setUserInput] = useState('');
    const [activeView, setActiveView] = useState('chat');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
    const [isThinking, setIsThinking] = useState(false);
    const fileInputRef = React.useRef(null);
    const [overrides, setOverrides] = useState([]); // NEW: State for granular shifts

    useEffect(() => {
        if (apiKey) {
            localStorage.setItem('geminiApiKey', apiKey);
        }
    }, [apiKey]);

    const addMessage = (sender, text) => {
        setChatHistory(prev => [...prev, { sender, text }]);
    };
    
    // --- NEW SCHEDULING ENGINE (Deterministic Solver) ---
    const generateSchedule = useCallback(() => {
        const newSchedule = {};
        const employeeNames = Object.keys(employees);

        DAYS.forEach(day => {
            newSchedule[day] = {};
            employeeNames.forEach(name => {
                newSchedule[day][name] = Array(TIME_SLOTS.length).fill('OFF');
            });

            // Pass 0: Mark PTO days first
            employeeNames.forEach(name => {
                if (employees[name].pto.some(p => p.day === day)) {
                    newSchedule[day][name].fill('PTO');
                }
            });

            // Helper to find available employees for a task at a specific time
            const getAvailableEmployees = (timeIndex, task) => {
                return employeeNames.filter(name => {
                    const emp = employees[name];
                    const slot = newSchedule[day][name][timeIndex];
                    const time = TIME_SLOTS[timeIndex];
                    return slot !== 'PTO' && time >= emp.shift.start && time < emp.shift.end && slot === 'OFF' && emp.abilities.includes(task);
                });
            };

            // Pass 1: Fill mandatory coverage (Res & Disp)
            TIME_SLOTS.forEach((time, i) => {
                if (time >= '08:00' && time < '17:00') {
                    // Assign Dispatch
                    let dispatchCount = employeeNames.filter(name => newSchedule[day][name][i] === 'Dispatch').length;
                    if (dispatchCount < 1) {
                        const available = getAvailableEmployees(i, 'Dispatch');
                        if (available.length > 0) newSchedule[day][available[0]][i] = 'Dispatch';
                    }
                    
                    // Assign Reservations
                    let resCount = employeeNames.filter(name => newSchedule[day][name][i] === 'Reservations').length;
                    const neededRes = 3 - resCount;
                    if (neededRes > 0) {
                        const available = getAvailableEmployees(i, 'Reservations');
                        available.slice(0, neededRes).forEach(name => {
                             newSchedule[day][name][i] = 'Reservations';
                        });
                    }
                }
            });

            // Pass 2: Schedule Lunches
            employeeNames.forEach(name => {
                const emp = employees[name];
                if (emp.lunch && emp.lunch.start) {
                     TIME_SLOTS.forEach((time, i) => {
                        if(time >= emp.lunch.start && time < emp.lunch.end && newSchedule[day][name][i] !== 'PTO') {
                            newSchedule[day][name][i] = 'Lunch';
                        }
                     });
                }
            });

            // Pass 3: Fill Specialist Tasks in remaining time
            employeeNames.forEach(name => {
                const emp = employees[name];
                if (emp.specialistTask) {
                    TIME_SLOTS.forEach((time, i) => {
                         if (time >= emp.shift.start && time < emp.shift.end && newSchedule[day][name][i] === 'OFF') {
                            newSchedule[day][name][i] = emp.specialistTask;
                         }
                    });
                }
            });

            // NEW: Pass 4 - Apply granular overrides
            overrides.forEach(override => {
                if (override.day === day) {
                    TIME_SLOTS.forEach((time, i) => {
                        if (time >= override.startTime && time < override.endTime) {
                            newSchedule[day][override.employeeName][i] = override.task;
                        }
                    });
                }
            });
        });

        setSchedule(newSchedule);
    }, [employees, overrides]); // Added overrides to dependency array
    
    // This crucial effect ensures the calendar always reflects the latest employee data.
    useEffect(() => {
        generateSchedule();
    }, [employees, overrides, generateSchedule]);

    const handlePtoUpload = (event) => { /* ... existing code ... */ };

    // --- NEW AND REWRITTEN LOGIC ---
    const handleUserInput = async () => {
        if (!userInput.trim() || isThinking || !apiKey) {
            if (!apiKey) addMessage('assistant', 'Please enter your API key.');
            return;
        }

        const newHistory = [...chatHistory, { sender: 'user', text: userInput }];
        setChatHistory(newHistory);
        setIsThinking(true);
        setUserInput('');
        
        const apiHistory = newHistory.map(msg => ({
            role: msg.sender === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

        const intentSystemInstruction = `You are an intent classifier... Respond ONLY with the classification in all caps.`;
        let userIntent = 'ASK_QUESTION';
        try {
            const intentPayload = { contents: [ { role: 'user', parts: [{ text: intentSystemInstruction }] }, { role: 'model', parts: [{ text: "Understood." }] }, ...apiHistory ] };
            const intentResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(intentPayload) });
            const intentResult = await intentResponse.json();
            userIntent = intentResult.candidates[0].content.parts[0].text.trim();
        } catch (error) {
            console.error("Intent classification failed:", error);
            addMessage('assistant', 'Sorry, I had trouble understanding your request.');
            setIsThinking(false);
            return;
        }
        
        // UPDATED: Added create_shift tool
        const actionSystemInstruction = `You are a scheduling assistant...
Valid actions are:
1. "update_employee_data": Modifies base data (specialistTask, PTO).
2. "create_shift": Adds a specific, granular shift override.

Example for update_employee_data: { "action": "update_employee_data", "data": { "employeeName": "Elliott", "updates": { "ptoDays": ["Monday"] } } }
Example for create_shift: { "action": "create_shift", "data": { "employeeName": "Brian Adie", "day": "Monday", "task": "Reservations", "startTime": "12:00", "endTime": "12:30" } }

Current Data:
- Employees: ${JSON.stringify(employees, null, 2)}
- Current Schedule: ${JSON.stringify(schedule, null, 2)}
Chat History for Context:`;

        const actionPayload = {
            contents: [ { role: 'user', parts: [{ text: actionSystemInstruction }] }, { role: 'model', parts: [{ text: "Understood." }] }, ...apiHistory ],
            ...(userIntent === 'CONFIRM_ACTION' && { generationConfig: { responseMimeType: "application/json" } })
        };

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actionPayload) });
            if (!response.ok) throw new Error('API request failed');
            const result = await response.json();
            const textResponse = result.candidates[0].content.parts[0].text;
            
            if (userIntent === 'CONFIRM_ACTION') {
                const responseObject = JSON.parse(textResponse);
                if (responseObject.action && responseObject.data) {
                    switch(responseObject.action) {
                        case 'update_employee_data':
                            const { employeeName, updates } = responseObject.data;
                            setEmployees(prev => {
                                const newEmployees = { ...prev };
                                if (newEmployees[employeeName]) {
                                    const newPto = new Set(newEmployees[employeeName].pto.map(p => p.day));
                                    if (updates.ptoDays) {
                                        updates.ptoDays.forEach(day => newPto.add(day));
                                    }
                                    newEmployees[employeeName] = { ...newEmployees[employeeName], ...updates, pto: Array.from(newPto).map(day => ({ day })) };
                                }
                                return newEmployees;
                            });
                            addMessage('assistant', 'I have updated the employee data as requested.');
                            break;
                        case 'create_shift': // NEW: Handle the new tool
                            setOverrides(prev => [...prev, responseObject.data]);
                            addMessage('assistant', 'I have added the specific shift to the schedule.');
                            break;
                        default:
                            addMessage('assistant', "I couldn't determine the exact action. Please try again.");
                    }
                } else {
                     addMessage('assistant', "I received an invalid action. Please clarify.");
                }
            } else {
                addMessage('assistant', textResponse);
            }

        } catch (error) {
            console.error(error);
            addMessage('assistant', `Sorry, there was an error. Please check the console.`);
        } finally {
            setIsThinking(false);
        }
    };

    const handleResetChat = () => {
        setChatHistory(getInitialMessage());
        setOverrides([]); // Also reset overrides
    };

    const handleUpdateEmployee = (name, updatedData) => {
        setEmployees(prev => ({...prev, [name]: updatedData}));
        addMessage('assistant', `Updated settings for ${name}. Regenerating schedule.`);
    };

    const handleRemoveEmployee = (name) => {
        setEmployees(prev => {
            const newState = {...prev};
            delete newState[name];
            return newState;
        });
        addMessage('assistant', `Removed ${name}. Regenerating schedule.`);
    };

    const handleAddEmployee = () => {
        const newName = `New Employee ${Object.keys(employees).length + 1}`;
        setEmployees(prev => ({
            ...prev,
            [newName]: {
                shift: { start: '09:00', end: '17:00' }, hours: 40, lunch: { start: '12:00', end: '13:00' },
                abilities: ['Reservations'], specialistTask: '', specialistTarget: 0, pto: []
            }
        }));
        addMessage('assistant', `Added ${newName}. Please update their details.`);
    };
    
    const renderScheduleGrid = (day) => {
        if (!schedule || !schedule[day]) return <div className="p-4 text-center">Generating...</div>;
        return (
            <div className="overflow-x-auto shadow-md rounded-lg">
                <table className="min-w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-200"><th className="sticky left-0 bg-gray-200 z-10 p-2 border-r text-left w-40">Employee</th>{TIME_SLOTS.map(t => <th key={t} className="p-1 border-b border-gray-300 text-xs w-20 font-normal">{t}</th>)}</tr>
                    </thead>
                    <tbody>
                        {Object.keys(employees).sort().map(name => (
                            <tr key={name} className="[&:nth-child(even)]:bg-gray-50">
                                <td className="sticky left-0 bg-white [&:nth-child(even)]:bg-gray-50 z-10 p-2 border-r font-medium text-sm whitespace-nowrap">{name}</td>
                                {schedule[day][name].map((task, i) => (
                                    <td key={i} style={{backgroundColor: hexToRgba(COLORS[task], 0.8), color:['Badges/Projects','PTO'].includes(task)?'white':'black', border:`1px solid ${hexToRgba(COLORS[task],0.5)}`}} className="text-center text-xs p-1 font-semibold">{task !== schedule[day][name][i-1] ? task.replace(/s$/, '') : ''}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <div className="w-1/3 max-w-md flex flex-col h-full border-r bg-white shadow-lg">
                <div className="p-4 border-b bg-gray-50">
                    <h1 className="text-2xl font-bold text-gray-800">Scheduling Assistant</h1>
                    <div className="flex mt-2 border border-gray-300 rounded-lg">
                        <button onClick={() => setActiveView('chat')} className={`w-1/2 p-2 rounded-l-lg ${activeView === 'chat' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-200'}`}>Chat & Controls</button>
                        <button onClick={() => setActiveView('employees')} className={`w-1/2 p-2 rounded-r-lg ${activeView === 'employees' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-200'}`}>Manage Employees</button>
                    </div>
                </div>

                {activeView === 'chat' && (
                    <div className="flex-grow flex flex-col">
                        <div className="p-4 border-b">
                            <label htmlFor="api-key" className="text-sm font-medium text-gray-700">Gemini API Key</label>
                            <input
                                id="api-key"
                                type="password"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                className="w-full p-2 mt-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter your API key here"
                            />
                        </div>
                        <div className="p-4 border-b flex space-x-2">
                           <button onClick={() => fileInputRef.current.click()} className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Upload PTO</button>
                           <input type="file" ref={fileInputRef} onChange={handlePtoUpload} accept="image/*" className="hidden" />
                           <button onClick={handleResetChat} className="w-1/2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Reset Chat</button>
                        </div>
                        <div className="flex-grow p-4 overflow-y-auto bg-gray-50">{chatHistory.map((msg, i) => <div key={i} className={`mb-4 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-xs p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-white border'}`}><p className="text-sm" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }}></p></div></div>)} {isThinking && <div className="mb-4 flex justify-start"><div className="max-w-xs p-3 rounded-2xl bg-white border"><p className="text-sm text-gray-500 animate-pulse">Assistant is thinking...</p></div></div>}</div>
                        <div className="p-4 border-t bg-white flex"><input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleUserInput()} className="flex-grow p-2 border rounded-l-lg" placeholder="Type request..." disabled={isThinking} /><button onClick={handleUserInput} className="bg-blue-600 text-white p-2 rounded-r-lg" disabled={isThinking}>Send</button></div>
                    </div>
                )}
                
                {activeView === 'employees' && (
                     <div className="flex-grow flex flex-col">
                        <div className="p-4 border-b"><button onClick={handleAddEmployee} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Add New Employee</button></div>
                        <div className="flex-grow p-4 overflow-y-auto bg-gray-50">
                            {Object.entries(employees).map(([name, data]) => (
                                <EmployeeForm key={name} employeeName={name} employee={data} onUpdate={handleUpdateEmployee} onRemove={handleRemoveEmployee} />
                            ))}
                        </div>
                    </div>
                )}

            </div>

            <div className="flex-grow flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b bg-white"><h2 className="text-xl font-semibold text-gray-700">Weekly Schedule</h2></div>
                <div className="flex-grow overflow-auto p-4 bg-gray-100">{DAYS.map(day => <div key={day} className="mb-8"><h3 className="text-lg font-bold mb-2 text-gray-800">{day}</h3>{renderScheduleGrid(day)}</div>)}</div>
            </div>
        </div>
    );
}
