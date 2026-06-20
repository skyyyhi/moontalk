import { test, expect, request as apiRequest } from '@playwright/test';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'test';
const API = 'http://localhost:3000';

async function createRoom(api) {
  const res = await api.post(`${API}/api/rooms`, {
    headers: { 'x-admin-secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
    data: { name: 'E2E Test Room', person_a_name: 'Alice', person_b_name: 'Bob' },
  });
  return res.json();
}

test.describe('Fragen-Flow', () => {
  let room;

  test.beforeAll(async () => {
    const api = await apiRequest.newContext();
    room = await createRoom(api);
    await api.dispose();
  });

  test('Join-Seite zeigt Willkommenstext', async ({ page }) => {
    const token = room.person_a.url.split('/join/')[1];
    await page.goto(`/join/${token}`);
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('Frage hinzufügen und in Liste sehen', async ({ page }) => {
    const token = room.person_a.url.split('/join/')[1];
    await page.goto(`/join/${token}`);

    // Join durchführen
    await page.getByRole('button', { name: /Los geht/i }).click();
    await page.waitForURL('**/questions');

    // FAB öffnen
    await page.getByRole('button', { name: /Frage hinzufügen/i }).click();

    // Frage eingeben und absenden
    await page.getByPlaceholder(/Was möchtest du fragen/i).fill('Was ist deine liebste Kindheitserinnerung?');
    await page.getByRole('button', { name: /Hinzufügen/i }).click();

    await expect(page.getByText('Was ist deine liebste Kindheitserinnerung?')).toBeVisible();
  });

  test('Karte ziehen zeigt die Frage', async ({ page }) => {
    // Bob fügt eine Frage hinzu
    const bobToken = room.person_b.url.split('/join/')[1];
    await page.goto(`/join/${bobToken}`);
    await page.getByRole('button', { name: /Los geht/i }).click();
    await page.waitForURL('**/questions');
    await page.getByRole('button', { name: /Frage hinzufügen/i }).click();
    await page.getByPlaceholder(/Was möchtest du fragen/i).fill('Wohin würdest du gerne reisen?');
    await page.getByRole('button', { name: /Hinzufügen/i }).click();

    // Alice zieht eine Karte
    const aliceToken = room.person_a.url.split('/join/')[1];
    await page.goto(`/join/${aliceToken}`);
    await page.getByRole('button', { name: /Los geht/i }).click();
    await page.goto('/draw');

    await page.getByRole('button', { name: /Tippen zum Ziehen|Karte ziehen/i }).click();

    // Irgendeine Frage wird angezeigt
    await expect(page.locator('.animate-card-reveal')).toBeVisible();
  });
});

test.describe('Admin-Flow', () => {
  let room;

  test.beforeAll(async () => {
    const api = await apiRequest.newContext();
    room = await createRoom(api);
    await api.dispose();
  });

  test('Admin-Seite lädt und zeigt Statistiken', async ({ page }) => {
    const adminToken = room.admin_url.split('/admin/')[1];
    await page.goto(`/admin/${adminToken}`);

    await expect(page.getByText('Admin')).toBeVisible();
    await expect(page.getByText('Gesamt')).toBeVisible();
    await expect(page.getByText('Kategorien')).toBeVisible();
  });

  test('Kategorie erstellen und togglen', async ({ page }) => {
    const adminToken = room.admin_url.split('/admin/')[1];
    await page.goto(`/admin/${adminToken}`);

    // Neue Kategorie anlegen
    await page.getByPlaceholder('Neue Kategorie…').fill('Kindheit');
    await page.getByRole('button', { name: /\+/i }).last().click();

    await expect(page.getByText('Kindheit')).toBeVisible();

    // Toggle (deaktivieren)
    await page.getByText('Kindheit').click();
    await expect(page.getByText('aus')).toBeVisible();

    // Toggle (reaktivieren)
    await page.getByText('Kindheit').click();
    await expect(page.getByText('aus')).not.toBeVisible();
  });
});
