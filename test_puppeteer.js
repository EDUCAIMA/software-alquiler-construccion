import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:5173/invoices');
  
  // Login
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  await page.waitForSelector('text=INV-001', { timeout: 10000 });
  
  // Find a PDF button next to INV-001
  console.log("clicking PDF button");
  // The structure is likely a table row
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      const title = await page.evaluate(el => el.getAttribute('title'), btn);
      if (title === 'Descargar Factura PDF') {
          console.log("Found PDF button, clicking...");
          await btn.click();
          await new Promise(r => setTimeout(r, 2000));
          break;
      }
  }

  await browser.close();
  console.log("Done");
})();
