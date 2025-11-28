import { test, expect } from '@playwright/test';

/**
 * Базовый E2E-сценарий авторизации и навигации для FTR Registration System.
 *
 * Требования для запуска:
 * - Backend запущен и доступен по VITE_API_URL, настроенному для фронтенда.
 * - Frontend запущен (по умолчанию http://localhost:5173).
 * - В базе есть демо-пользователь ADMIN: admin@ftr.ru / admin123 (создаётся seed-скриптом).
 */

test.describe('Auth and basic navigation', () => {
  test('admin can log in and see dashboard', async ({ page }) => {
    await page.goto('/');

    // Ожидаем страницу логина.
    await expect(page).toHaveURL(/.*login/i);

    // Заполняем форму логина демо-аккаунтом администратора.
    await page.getByLabel(/email/i).fill('admin@ftr.ru');
    await page.getByLabel(/пароль/i).fill('admin123');

    await page.getByRole('button', { name: /войти/i }).click();

    // После успешного входа ожидаем редирект на основную страницу (дешборд/регистрации).
    await expect(page).not.toHaveURL(/login/i);

    // Проверяем наличие основных элементов навигации.
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByText(/регистрации/i)).toBeVisible();
    await expect(page.getByText(/бухгалтерия/i)).toBeVisible();
    await expect(page.getByText(/статистика/i)).toBeVisible();
  });

  test('admin can navigate to registrations list from main navigation', async ({ page }) => {
    await page.goto('/');

    // Логинимся администратором.
    await expect(page).toHaveURL(/.*login/i);
    await page.getByLabel(/email/i).fill('admin@ftr.ru');
    await page.getByLabel(/пароль/i).fill('admin123');
    await page.getByRole('button', { name: /войти/i }).click();

    // Ожидаем, что попали на защищённый layout.
    await expect(page.getByRole('navigation')).toBeVisible();

    // Переходим в раздел "Регистрации".
    const registrationsText = page.getByText(/регистрации/i);
    await registrationsText.click();

    // Проверяем, что маршрут сменился и страница загрузилась.
    await expect(page).toHaveURL(/.*registrations/i);

    // Ожидаем таблицу или заголовок списка регистраций (в зависимости от реализации UI).
    await expect(
      page.getByRole('heading', { name: /регистрации/i }).or(page.getByText(/список регистраций/i))
    ).toBeVisible({ timeout: 10_000 });
  });
});


