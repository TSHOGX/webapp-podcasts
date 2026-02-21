/**
 * Test mode configuration module
 * Provides utilities for checking and using test mode
 */

export const TEST_USER_ID = process.env.NEXT_PUBLIC_TEST_USER_ID || "00000000-0000-0000-0000-000000000000";
export const TEST_USER_EMAIL = process.env.NEXT_PUBLIC_TEST_USER_EMAIL || "test@example.com";

/**
 * Check if test mode is enabled
 */
export function isTestMode(): boolean {
  return process.env.NEXT_PUBLIC_TEST_MODE === "true";
}

/**
 * Get the test user object
 */
export function getTestUser() {
  return {
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
  };
}

/**
 * Log a message with test mode prefix
 */
export function logTestMode(message: string): void {
  if (isTestMode()) {
    console.log(`[Test Mode] ${message}`);
  }
}
