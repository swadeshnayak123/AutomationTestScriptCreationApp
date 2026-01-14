import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import LocatorHelper from './LocatorHelper';

const StepCard = ({ step }) => {
    const getStepColor = (type) => {
        switch (type) {
            case 'GOTO': return 'bg-blue-100 border-blue-400';
            case 'CLICK': return 'bg-green-100 border-green-400';
            case 'TYPE': return 'bg-yellow-100 border-yellow-400';
            case 'TAKE_SCREENSHOT': return 'bg-indigo-100 border-indigo-400';
            default: return 'bg-slate-100 border-slate-400';
        }
    };

    return (
        <div className={`p-4 border-l-4 ${getStepColor(step.type)} rounded-lg bg-white mb-3 shadow-sm hover:shadow-lg transition-shadow duration-300`}>
            <div className="flex justify-between items-center">
                <strong className="font-mono text-xs font-bold text-gray-700 uppercase tracking-wider">{step.type}</strong>
                <span className="text-xs font-medium text-gray-400">Drag to reorder</span>
            </div>
            <p className="text-base text-gray-800 mt-2">{step.name}</p>
            {step.selector && <p className="text-sm font-mono text-gray-600 mt-2">Selector: <code className="bg-slate-200 text-slate-800 px-2 py-1 rounded-md">{step.selector}</code></p>}
            {step.value && <p className="text-sm font-mono text-gray-600 mt-1">Value: <code className="bg-slate-200 text-slate-800 px-2 py-1 rounded-md">{step.value}</code></p>}
        </div>
    );
};

function TestFlowDesigner() {
    const [steps, setSteps] = useState([]);
    const [testName, setTestName] = useState('My New E2E Test');
    const [selectedFile, setSelectedFile] = useState(null);
    const [showLocatorHelper, setShowLocatorHelper] = useState(false);
    const [automationTool, setAutomationTool] = useState('selenium');
    const [programmingLanguage, setProgrammingLanguage] = useState('java');
    const [generatedScript, setGeneratedScript] = useState('');
    const [scenario, setScenario] = useState('');

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            parseFile(file);
        }
    };

    const parseFile = (file) => {
        const reader = new FileReader();
        if (file.name.endsWith('.csv')) {
            reader.onload = (e) => {
                Papa.parse(e.target.result, {
                    header: true,
                    complete: (result) => {
                        const scenarioText = result.data.map(row => `${row.type} ${row.selectorType}="${row.selector}" with value "${row.value}"`).join('\n');
                        setScenario(scenarioText);
                    }
                });
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                const scenarioText = json.map(row => `${row.type} ${row.selectorType}="${row.selector}" with value "${row.value}"`).join('\n');
                setScenario(scenarioText);
            };
            reader.readAsArrayBuffer(file);
        } else if (file.name.endsWith('.docx')) {
            reader.onload = (e) => {
                mammoth.extractRawText({ arrayBuffer: e.target.result })
                    .then(result => {
                        setScenario(result.value);
                    })
                    .catch(err => {
                        console.error("Error parsing .docx file:", err);
                        alert('Error parsing .docx file. See console for details.');
                    });
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert('Unsupported file type. Please upload a CSV, XLSX or DOCX file.');
        }
    };

    const handleOnDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(steps);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setSteps(items);
    };

    const addScreenshotStep = () => {
        const newStep = {
            id: uuidv4(),
            type: 'TAKE_SCREENSHOT',
            name: 'Capture screenshot of the current page',
            value: `screenshot-${Date.now()}.png`
        };
        setSteps([...steps, newStep]);
    };

    const saveAndRunTest = async () => {
        if (!testName.trim()) {
            alert("Please enter a test name.");
            return;
        }
        if (steps.length === 0) {
            alert("Please add at least one step to the test.");
            return;
        }
        try {
            const response = await fetch('http://localhost:4000/api/tests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: testName, 
                    steps, 
                    automationTool, 
                    programmingLanguage 
                }),
            });
            if (!response.ok) throw new Error('Failed to save the test.');
            const savedTest = await response.json();

            await fetch(`http://localhost:4000/api/tests/${savedTest.id}/run`, { method: 'POST' });
            alert(`Test "${savedTest.name}" saved and execution started!`);
        } catch (error) {
            console.error('Failed to save or run test:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const generateScript = async () => {
        if (!testName.trim()) {
            alert("Please enter a test name.");
            return;
        }
        if (steps.length === 0) {
            alert("Please add at least one step to the test.");
            return;
        }
        try {
            const response = await fetch('http://localhost:4000/api/tests/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test: { name: testName, steps },
                    automationTool,
                    programmingLanguage,
                }),
            });
            if (!response.ok) throw new Error('Failed to generate script.');
            const { script } = await response.json();
            setGeneratedScript(script);
        } catch (error) {
            console.error('Failed to generate script:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const generateStepsFromScenario = () => {
        const scenarioLines = scenario.split('\n').filter(line => line.trim() !== '');
        const newSteps = scenarioLines.map(line => {
            const parts = line.match(/(?<type>\w+)\s+(?:(?<selectorType>\w+)=)?(?<selector>"(?:\\"|[^"])*"|\S+)\s*(?:with\s+value\s+(?<value>.+))?/);
            if (parts && parts.groups) {
                const { type, selectorType, selector, value } = parts.groups;
                return {
                    id: uuidv4(),
                    type: type.toUpperCase(),
                    name: line,
                    selector: selector.replace(/"/g, ''),
                    selectorType: selectorType,
                    value: value ? value.replace(/"/g, '') : ''
                };
            }
            return null;
        }).filter(Boolean);
        setSteps(newSteps);
    };

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <div className="p-6 max-w-6xl mx-auto">
                <header className="bg-white shadow-lg rounded-xl p-6 mb-8">
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700 tracking-tighter">AutoPilot QA</h1>
                    <p className="text-xl text-gray-600 mt-2">Your E2E Test Design Studio</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Test Flow</h2>
                        <input
                            type="text"
                            value={testName}
                            onChange={(e) => setTestName(e.target.value)}
                            className="w-full p-4 bg-gray-50 border-2 border-gray-300 rounded-lg mb-6 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow shadow-sm"
                            placeholder="Enter Your Test Name (e.g., 'Login Flow')"
                        />
                        <DragDropContext onDragEnd={handleOnDragEnd}>
                            <Droppable droppableId="steps">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="min-h-[200px] bg-gray-50 p-4 rounded-lg border-dashed border-2 border-gray-300">
                                        {steps.length > 0 ? steps.map((step, index) => (
                                            <Draggable key={step.id} draggableId={step.id} index={index}>
                                                {(provided) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                        <StepCard step={step} />
                                                    </div>
                                                )}
                                            </Draggable>
                                        )) : (
                                            <div className="text-center text-gray-500 py-10">
                                                <p className="text-lg">Your test steps will appear here.</p>
                                                <p className="text-sm">Drag and drop to reorder.</p>
                                            </div>
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-lg">
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Test Scenario</h3>
                            <textarea
                                value={scenario}
                                onChange={(e) => setScenario(e.target.value)}
                                className="w-full p-4 bg-gray-50 border-2 border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow shadow-sm"
                                placeholder={`Example:\nGOTO https://www.flipkart.com\nTYPE css="._3704LK" with value mobile\nCLICK css=".L0Z3Pu"`}
                                rows="5"
                            />
                            <input
                                type="file"
                                id="file-upload"
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".csv,.xlsx,.docx"
                            />
                            <label htmlFor="file-upload" className="w-full cursor-pointer bg-gray-200 text-gray-700 p-3 text-center rounded-lg hover:bg-gray-300 transition-colors duration-300 block border-2 border-dashed border-gray-400 hover:border-gray-500 mb-4">
                                {selectedFile ? `Selected: ${selectedFile.name}` : 'Upload a Test File'}
                            </label>
                            <button
                                onClick={generateStepsFromScenario}
                                className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                Generate Steps
                            </button>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-lg">
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Test Configuration</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Automation Tool</label>
                                    <select
                                        value={automationTool}
                                        onChange={(e) => setAutomationTool(e.target.value)}
                                        className="w-full p-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="selenium">Selenium</option>
                                        <option value="playwright">Playwright</option>
                                        <option value="cypress">Cypress</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Programming Language</label>
                                    <select
                                        value={programmingLanguage}
                                        onChange={(e) => setProgrammingLanguage(e.target.value)}
                                        className="w-full p-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500"
                                    >
                                        <option value="java">Java</option>
                                        <option value="javascript">JavaScript</option>
                                        <option value="python">Python</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-lg">
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Controls</h3>
                            <div className="space-y-3">
                                <button onClick={addScreenshotStep} className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                    Add Screenshot
                                </button>
                                <button onClick={() => setShowLocatorHelper(!showLocatorHelper)} className="w-full bg-gray-700 text-white p-3 rounded-lg hover:bg-gray-800 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                                    {showLocatorHelper ? 'Hide' : 'Show'} Locator Helper
                                </button>
                                <button
                                    onClick={generateScript}
                                    className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                >
                                    Generate Script
                                </button>
                            </div>
                        </div>
                        
                        {showLocatorHelper && <div className="bg-white rounded-lg shadow-lg"><LocatorHelper /></div>}

                        {generatedScript && (
                            <div className="bg-white p-6 rounded-lg shadow-lg">
                                <h3 className="text-xl font-bold text-gray-800 mb-3">Generated Script</h3>
                                <pre className="bg-gray-800 text-white p-4 rounded-lg font-mono text-sm overflow-x-auto shadow-inner">
                                    {generatedScript}
                                </pre>
                            </div>
                        )}

                        <div className="mt-6">
                            <button
                                onClick={saveAndRunTest}
                                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-lg text-lg font-bold hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                            >
                                Save & Run Test
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TestFlowDesigner;