import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  page.on('dialog', async dialog => {
    console.log('DIALOG TRIGGERED:', dialog.message());
    await dialog.accept();
  });
  
  await page.goto('http://localhost:5173');
  await page.waitForSelector('#day-card-day-2', { timeout: 10000 });
  
  await page.click('#day-card-day-2 > div.cursor-pointer');
  
  await page.waitForSelector('#day-card-day-2 button', { timeout: 2000 });
  
  const initialDays = await page.evaluate(() => document.querySelectorAll('[id^=day-card-]').length);
  console.log('Initial days count:', initialDays);
  
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('- Remove Day')) {
      await btn.click();
      console.log('Clicked Remove Day button');
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  const finalDays = await page.evaluate(() => document.querySelectorAll('[id^=day-card-]').length);
  console.log('Final days count:', finalDays);
  
  await browser.close();
})();
