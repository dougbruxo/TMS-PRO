import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('pageerror', err => {
        console.log('--- PAGE ERROR ---');
        console.log(err.message);
        console.log(err.stack);
    });
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('--- CONSOLE ERROR ---');
            console.log(msg.text());
        }
    });

    try {
        await page.goto('http://localhost:3000/login');
        await page.fill('input[name="username"]', 'douglas');
        await page.fill('input[name="password"]', '123456');
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
        await page.goto('http://localhost:3000/quotes');
        await page.waitForTimeout(3000);
    } catch(e) {
        console.log("Puppeteer script error:", e);
    } finally {
        await browser.close();
    }
})();
