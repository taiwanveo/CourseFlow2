import { test, expect } from "@playwright/test";

test.describe("CourseFlow smoke", () => {
  test("首頁顯示 CourseFlow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "CourseFlow" })).toBeVisible();
  });

  test("登入頁", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /登入 CourseFlow/ })).toBeVisible();
  });
});
