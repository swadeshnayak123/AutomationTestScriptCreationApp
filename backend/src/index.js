const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4000;
const EXECUTOR_URL = 'http://localhost:5000';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

app.use(cors());
app.use(express.json());

const testsDB = new Map();

console.log('Backend running with in-memory storage.');

app.get('/api/proxy', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).send('URL is required');
        }
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            responseType: 'text',
            timeout: 10000,
            httpsAgent: httpsAgent
        });
        res.send(response.data);
    } catch (error) {
        if (error.response) {
            console.error('Proxy error:', error.response.status, error.response.statusText);
            res.status(error.response.status).send(error.response.statusText);
        } else if (error.request) {
            console.error('Proxy error: No response received', error.request);
            res.status(500).send('No response received from the server.');
        } else {
            console.error('Proxy error:', error.message);
            res.status(500).send(`Error fetching URL: ${error.message}`);
        }
    }
});

app.get('/api/tests', (req, res) => {
    const allTests = Array.from(testsDB.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(allTests);
});

app.post('/api/tests', (req, res) => {
    const { name, steps, automationTool, programmingLanguage } = req.body;
    const newTest = {
        id: uuidv4(),
        name,
        steps,
        automationTool,
        programmingLanguage,
        createdAt: new Date(),
    };
    testsDB.set(newTest.id, newTest);
    console.log(`Test created: ${newTest.name} (ID: ${newTest.id})`);
    res.status(201).json(newTest);
});

app.post('/api/tests/:id/run', (req, res) => {
    const test = testsDB.get(req.params.id);
    if (!test) {
        return res.status(404).send('Test not found');
    }
    console.log(`Requesting execution for test: ${test.name}`);
    axios.post(`${EXECUTOR_URL}/execute`, { test })
        .catch(err => console.error(`Error calling executor service: ${err.message}`));
    res.status(202).json({ message: 'Test execution started', runId: uuidv4() });
});

app.post('/api/tests/generate-script', (req, res) => {
    const { test, automationTool, programmingLanguage } = req.body;
    const script = generateTestScript(test, automationTool, programmingLanguage);
    res.json({ script });
});

function generateTestScript(test, tool, language) {
    if (tool === 'selenium' && language === 'java') {
        return generateSeleniumJavaCode(test);
    }
    if (tool === 'playwright' && language === 'javascript') {
        return generatePlaywrightCode(test);
    }
    return `// Script generation for ${tool} with ${language} is not implemented yet.`;
}

function getSelector(step, language) {
    if (language === 'java') {
        switch (step.selectorType) {
            case 'id':
                return `By.id("${step.selector}")`;
            case 'name':
                return `By.name("${step.selector}")`;
            case 'linkText':
                return `By.linkText("${step.selector}")`;
            case 'partialLinkText':
                return `By.partialLinkText("${step.selector}")`;
            case 'css':
                return `By.cssSelector("${step.selector}")`;
            case 'xpath':
                return `By.xpath("${step.selector}")`;
            case 'text':
                return `By.xpath("//*[text()='${step.selector}']")`;
            default:
                return `By.cssSelector("${step.selector}")`;
        }
    }
    if (language === 'javascript') {
        return `'${step.selector}'`;
    }
}

function generateSeleniumJavaCode(test) {
    let script = `
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

public class ${test.name.replace(/\s+/g, '')} {
    public static void main(String[] args) {
        System.setProperty("webdriver.chrome.driver", "path/to/chromedriver.exe");
        WebDriver driver = new ChromeDriver();

`;

    test.steps.forEach(step => {
        switch (step.type) {
            case 'GOTO':
                script += `        driver.get("${step.value}");\n`;
                break;
            case 'CLICK':
                script += `        driver.findElement(${getSelector(step, 'java')}).click();\n`;
                break;
            case 'TYPE':
                script += `        driver.findElement(${getSelector(step, 'java')}).sendKeys("${step.value}");\n`;
                break;
            case 'TAKE_SCREENSHOT':
                script += `        // Add screenshot logic here\n`;
                break;
        }
    });

    script += `
        driver.quit();
    }
}
`;

    return script;
}

function generatePlaywrightCode(test) {
    let script = `
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

`;

    test.steps.forEach(step => {
        switch (step.type) {
            case 'GOTO':
                script += `    await page.goto('${step.value}');\n`;
                break;
            case 'CLICK':
                script += `    await page.locator(${getSelector(step, 'javascript')}).click();\n`;
                break;
            case 'TYPE':
                script += `    await page.locator(${getSelector(step, 'javascript')}).type('${step.value}');\n`;
                break;
            case 'TAKE_SCREENSHOT':
                script += `    await page.screenshot({ path: '${step.value}' });\n`;
                break;
        }
    });

    script += `
    await browser.close();
})();
`;

    return script;
}

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
