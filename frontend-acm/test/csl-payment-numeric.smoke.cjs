const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1000, height: 900 } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('http://127.0.0.1:5173/test/csl-payment-numeric-fixture.html');
    const amount = p.locator('input[name=paymentAmount]');
    await p.waitForFunction(
      () =>
        document.querySelector('[name=paymentAmount]')?.value === '1,234,567',
    );
    await amount.fill('2345678');
    assert.equal(await amount.inputValue(), '2,345,678');
    await p.getByRole('button', { name: '저장', exact: true }).click();
    await p.waitForFunction(() =>
      document.querySelector('output').textContent.includes('2345678'),
    );
    assert.equal(
      JSON.parse(await p.locator('output').innerText()).paymentAmount,
      2345678,
    );
    const dir = 'docs/report/assets/numeric-input-261008';
    fs.mkdirSync(dir, { recursive: true });
    await p.screenshot({ path: dir + '/payment.png', fullPage: true });
    await p.goto(
      'http://127.0.0.1:5173/test/csl-payment-numeric-fixture.html?counsel',
    );
    const duration = p.getByPlaceholder('분단위 자유입력');
    await duration.waitFor();
    await duration.fill('1500');
    assert.equal(await duration.inputValue(), '1,500');
    await p.getByRole('button', { name: '저장', exact: true }).click();
    await p.waitForFunction(() =>
      document.querySelector('output').textContent.includes('1500'),
    );
    assert.equal(
      JSON.parse(await p.locator('output').innerText()).classMinutes,
      1500,
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: real stage 5 payment amount display/save and stage 4 duration display/save',
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
