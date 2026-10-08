const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('http://127.0.0.1:5173/test/numeric-input-fixture.html');
    const amount = p.getByLabel('amount', { exact: true }),
      quantity = p.getByLabel('quantity', { exact: true }),
      decimal = p.getByLabel('decimal', { exact: true });
    await amount.fill('1234567');
    assert.equal(await amount.inputValue(), '1,234,567');
    await quantity.fill('2345');
    assert.equal(await quantity.inputValue(), '2,345');
    await decimal.fill('-12345.67');
    assert.equal(await decimal.inputValue(), '-12,345.67');
    await p.getByRole('button', { name: '저장', exact: true }).click();
    await p.waitForFunction(() =>
      document.querySelector('output').textContent.includes('1234567'),
    );
    assert.deepEqual(JSON.parse(await p.locator('output').innerText()), {
      amount: '1234567',
      quantity: 2345,
    });
    await amount.fill('50000001');
    assert.equal(await amount.evaluate((e) => e.checkValidity()), false);
    await amount.fill('-10');
    assert.equal(await amount.evaluate((e) => e.checkValidity()), false);
    await amount.fill('');
    assert.equal(await amount.evaluate((e) => e.checkValidity()), false);
    await p.getByRole('button', { name: '초기화' }).click();
    await p.waitForFunction(
      () => document.querySelector('[aria-label=amount]').value === '7,654,321',
    );
    assert.equal(await quantity.inputValue(), '1,234');
    await quantity.fill('1.5');
    assert.equal(await quantity.evaluate((e) => e.checkValidity()), false);
    await quantity.fill('');
    assert.equal(await quantity.inputValue(), '');
    await amount.fill('1234');
    await amount.evaluate((e) => e.setSelectionRange(2, 2));
    await amount.press('Backspace');
    assert.equal(await amount.inputValue(), '234');
    await amount.fill('12,345');
    assert.equal(await amount.inputValue(), '12,345');
    await amount.fill('1234');
    await amount.evaluate((e) => e.setSelectionRange(2, 2));
    await amount.press('9');
    assert.equal(await amount.inputValue(), '19,234');
    await decimal.fill('-');
    assert.equal(await decimal.inputValue(), '-');
    assert.equal(await decimal.evaluate((e) => e.checkValidity()), false);
    await decimal.press('1');
    await decimal.press('.');
    await decimal.press('2');
    assert.equal(await decimal.inputValue(), '-1.2');
    await p.getByRole('button', { name: '포커스' }).click();
    await p.waitForFunction(
      () =>
        document.activeElement ===
        document.querySelector('[aria-label=amount]'),
    );
    assert.equal(
      await amount.evaluate((e) => document.activeElement === e),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: grouping, raw submit, numeric type, decimals, signs, min/max/step/required, reset, caret, paste and focus',
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
