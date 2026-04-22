import { test, expect } from '@playwright/test';

test.describe('Portal Home', () => {
  test('should load home page with brand elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Trinity Academy/);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('TRINITY')).toBeVisible();
  });

  test('should navigate to About page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/about"]');
    await expect(page).toHaveURL('/about');
  });

  test('should navigate to Programs page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/programs"]');
    await expect(page).toHaveURL('/programs');
  });
});

test.describe('Portal Navigation', () => {
  test('should show login link in header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('학부모 로그인')).toBeVisible();
  });

  test('should navigate to parent login', async ({ page }) => {
    await page.goto('/login/parent');
    await expect(page.getByText('학부모 로그인')).toBeVisible();
    await expect(page.getByPlaceholder(/휴대폰/)).toBeVisible();
  });
});

test.describe('Admin Login', () => {
  test('should show admin login form', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/올바르지 않습니다/)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Contact Page', () => {
  test('should show consultation form', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByText(/상담/)).toBeVisible();
  });
});
