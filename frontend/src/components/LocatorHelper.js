import React, { useState, useRef, useEffect } from 'react';

function LocatorHelper() {
    const [url, setUrl] = useState('https://www.google.com');
    const [locator, setLocator] = useState('');
    const [error, setError] = useState('');
    const iframeRef = useRef(null);
    const [selectedLocatorType, setSelectedLocatorType] = useState('css');
    const [selectedXpathType, setSelectedXpathType] = useState('relative');
    const [lastElement, setLastElement] = useState(null);

    const handleLoadUrl = async () => {
        if (!url) {
            setError('Please enter a valid URL.');
            return;
        }
        setError('');
        try {
            const response = await fetch(`http://localhost:4000/api/proxy?url=${encodeURIComponent(url)}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.statusText}`);
            }
            const html = await response.text();
            const iframeDocument = iframeRef.current.contentDocument;
            if (iframeDocument) {
                iframeDocument.open();
                iframeDocument.write(html);
                iframeDocument.close();
            } else {
                setError("Could not write to iframe.");
            }
        } catch (e) {
            setError(`Error loading site: ${e.message}`);
            console.error(e);
        }
    };

    const handleIframeLoad = () => {
        try {
            const iframeDocument = iframeRef.current.contentDocument;
            if (!iframeDocument) {
                setError("Could not access iframe content. This might be due to CORS policy.");
                return;
            }
            iframeDocument.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setLastElement(e.target);
            }, true);
        } catch (e) {
            setError(`Error accessing iframe content: ${e.message}. Try a different URL or check browser console.`);
            console.error(e);
        }
    };

    useEffect(() => {
        if (lastElement) {
            const generatedLocator = generateLocator(lastElement, selectedLocatorType, selectedXpathType);
            setLocator(generatedLocator);
        }
    }, [lastElement, selectedLocatorType, selectedXpathType]);

    const generateLocator = (element, type, xpathType) => {
        switch (type) {
            case 'id':
                return element.id ? element.id : 'No ID found';
            case 'name':
                return element.name ? element.name : 'No name found';
            case 'linkText':
                return element.tagName === 'A' && element.textContent ? element.textContent : 'Not a link or no text';
            case 'partialLinkText':
                return element.tagName === 'A' && element.textContent ? element.textContent.split(' ')[0] : 'Not a link or no text';
            case 'css':
                return generateCssSelector(element);
            case 'xpath':
                return generateXPath(element, xpathType);
            case 'text':
                return element.textContent ? element.textContent : 'No text content';
            default:
                return 'Invalid locator type';
        }
    };

    const generateCssSelector = (element) => {
        if (element.id) return `#${element.id}`;
        let path = '';
        let current = element;
        while (current.parentElement) {
            let siblingIndex = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
                if (sibling.tagName === current.tagName) {
                    siblingIndex++;
                }
                sibling = sibling.previousElementSibling;
            }
            const tagName = current.tagName.toLowerCase();
            const nthChild = `:nth-child(${siblingIndex})`;
            path = ` > ${tagName}${nthChild}` + path;
            current = current.parentElement;
            if (current.tagName.toLowerCase() === 'body') break;
        }
        return `body${path}`.trim();
    };

    const generateXPath = (element, type) => {
        if (type === 'absolute') {
            return generateAbsoluteXPath(element);
        }
        return generateRelativeXPath(element);
    };

    const generateRelativeXPath = (element) => {
        if (element.id) return `//*[@id='${element.id}']`;
        let path = '';
        let current = element;
        while (current.parentElement) {
            let siblingIndex = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
                if (sibling.tagName === current.tagName) {
                    siblingIndex++;
                }
                sibling = sibling.previousElementSibling;
            }
            const tagName = current.tagName.toLowerCase();
            path = `/${tagName}[${siblingIndex}]` + path;
            current = current.parentElement;
        }
        return `/html/body${path}`;
    };

    const generateAbsoluteXPath = (element) => {
        let path = '';
        let current = element;
        while (current) {
            let siblingIndex = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
                if (sibling.tagName === current.tagName) {
                    siblingIndex++;
                }
                sibling = sibling.previousElementSibling;
            }
            const tagName = current.tagName.toLowerCase();
            path = `/${tagName}[${siblingIndex}]` + path;
            current = current.parentElement;
        }
        return path;
    };

    const copyToClipboard = (text) => {
        if (text) {
            navigator.clipboard.writeText(text)
                .then(() => alert('Locator copied to clipboard!'))
                .catch(err => console.error('Failed to copy: ', err));
        }
    };

    return (
        <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-6 rounded-2xl shadow-2xl border-l-4 border-purple-400">
            <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-6 tracking-tight">
                Advanced Locator Helper
            </h3>
            <div className="flex items-center gap-3 mb-4">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-grow p-3 border-2 border-gray-300 rounded-lg focus:ring-4 focus:ring-purple-300 focus:border-purple-500 transition-all duration-300 shadow-inner"
                    placeholder="Enter URL to inspect"
                />
                <button
                    onClick={handleLoadUrl}
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold p-3 rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    Load Site
                </button>
            </div>

            {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-sm mb-4 border border-red-300">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Locator Type</label>
                    <select
                        value={selectedLocatorType}
                        onChange={(e) => setSelectedLocatorType(e.target.value)}
                        className="w-full p-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="css">CSS Selector</option>
                        <option value="xpath">XPath</option>
                        <option value="id">ID</option>
                        <option value="name">Name</option>
                        <option value="linkText">Link Text</option>
                        <option value="partialLinkText">Partial Link Text</option>
                        <option value="text">Text</option>
                    </select>
                </div>
                {selectedLocatorType === 'xpath' && (
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">XPath Type</label>
                        <select
                            value={selectedXpathType}
                            onChange={(e) => setSelectedXpathType(e.target.value)}
                            className="w-full p-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500"
                        >
                            <option value="relative">Relative</option>
                            <option value="absolute">Absolute</option>
                        </select>
                    </div>
                )}
            </div>

            {locator && (
                <div className="mb-4">
                    <label className="block text-md font-semibold text-gray-800 mb-2">Generated Locator:</label>
                    <div className="flex items-center gap-2">
                        <pre className="flex-grow bg-gray-800 text-white p-4 rounded-lg font-mono text-sm overflow-x-auto shadow-inner">
                            {locator}
                        </pre>
                        <button
                            onClick={() => copyToClipboard(locator)}
                            className="bg-gray-700 text-white p-3 rounded-lg hover:bg-gray-800 transition-colors shadow-md"
                            title="Copy to clipboard"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2H6zm8 2H6v11h8V5z" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <div className="w-full h-96 border-4 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white shadow-inner">
                <iframe
                    ref={iframeRef}
                    onLoad={handleIframeLoad}
                    className="w-full h-full border-0"
                    title="Locator Helper Inspection Frame"
                    sandbox="allow-scripts allow-same-origin"
                ></iframe>
            </div>
            <p className="text-xs text-gray-600 mt-3 text-center">
                Click on any element in the frame above to generate its locator based on your selection.
            </p>
        </div>
    );
}

export default LocatorHelper;
