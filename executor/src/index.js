const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)){
    fs.mkdirSync(screenshotsDir);
}

async function runTest(test) {
    if (test.automationTool === 'playwright') {
        return runPlaywrightTest(test);
    }
    // Handle other tools here
    console.log(`Execution for ${test.automationTool} is not implemented yet.`);
}

async function runPlaywrightTest(test) {
    console.log(`Executing test: ${test.name}`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        for (const step of test.steps) {
            console.log(`  - Executing step: ${step.name} (${step.type})`);
            let locator;
            if (step.selectorType) {
                locator = page.locator(`${step.selectorType}=${step.selector}`);
            } else {
                locator = page.locator(step.selector);
            }

            switch (step.type) {
                case 'GOTO':
                    await page.goto(step.value);
                    break;
                case 'CLICK':
                    await locator.first().click();
                    break;
                case 'TYPE':
                    await locator.first().type(step.value);
                    break;
                case 'ASSERT_TEXT':
                    const elementText = await locator.innerText();
                    if (!elementText.includes(step.value)) {
                        throw new Error(`Assertion failed! Expected text "${step.value}" not found in selector "${step.selector}".`);
                    }
                    break;
                case 'TAKE_SCREENSHOT':
                    const screenshotPath = path.join(screenshotsDir, step.value || `screenshot-${Date.now()}.png`);
                    await page.screenshot({ path: screenshotPath });
                    console.log(`    Screenshot saved to ${screenshotPath}`);
                    break;
                default:
                    console.warn(`Unknown step type: ${step.type}`);
            }
        }
        console.log(`Test "${test.name}" PASSED.`);
    } catch (error) {
        console.error(`Test "${test.name}" FAILED:`, error.message);
        const errorScreenshotPath = path.join(screenshotsDir, `error-${Date.now()}.png`);
        await page.screenshot({ path: errorScreenshotPath });
        console.log(`    Error screenshot saved to ${errorScreenshotPath}`);
    } finally {
        await browser.close();
    }
}

app.post('/execute', (req, res) => {
    const { test } = req.body;
    if (!test) {
        return res.status(400).send('No test definition provided.');
    }
    runTest(test).catch(err => console.error("An unexpected error occurred during test execution:", err));
    res.status(200).send('Execution acknowledged.');
});

app.listen(PORT, () => console.log(`Executor service listening on port ${PORT}`));
