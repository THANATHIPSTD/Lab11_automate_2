import { expect, type Page } from '@playwright/test';

export const USER = process.env.TEST_USER!;
export const PASS = process.env.TEST_PASS!;

export async function signIn(page: Page, email = USER, password = PASS): Promise<void> {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInAndExpectBooks(page: Page): Promise<void> {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Books' })).toBeVisible();
}

export function book(page: Page, title: string) {
  return page.getByRole('article', { name: title, exact: true });
}

export async function addToCart(page: Page, title: string): Promise<void> {
  await book(page, title).getByRole('button', { name: 'Add to cart' }).click();
}
