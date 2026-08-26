import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('Rendering input') || msg.text().includes('opDef')) {
            console.log(`BROWSER LOG: ${msg.text()}`);
        }
    });

    await page.goto('http://localhost:12002');

    await page.waitForTimeout(5000);

    await browser.close();
})();
