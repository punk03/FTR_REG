import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../index';

/**
 * Integration tests for Excel import endpoint.
 *
 * NOTE:
 * - Uses in-memory workbook via ExcelJS and multer memoryStorage.
 * - Relies on seeded reference data and eventId=1.
 */

describe('Excel import API', () => {
  const adminCredentials = {
    email: 'admin@ftr.ru',
    password: 'admin123',
  };

  async function loginAndGetToken(): Promise<string> {
    const res = await request(app).post('/api/auth/login').send(adminCredentials);
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  async function createBasicWorkbook(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Импорт');

    // Header row (примерно как в ТЗ: колонка A - №, B - коллектив, C - название танца и т.д.)
    sheet.addRow(['№', 'Коллектив', 'Название танца', 'Кол-во', 'E', 'Руководители', 'G', 'Тренеры', 'I', 'Школа', 'Контакты', 'Город', 'Длительность', 'N', 'Видео', 'P', 'ФИО на дипломы', 'Медали']);

    // Category row: "1. Современный танец Формейшн Бэби Beginners"
    sheet.addRow(['1. Современный танец Формейшн Бэби Beginners', '1. Современный танец Формейшн Бэби Beginners', '1. Современный танец Формейшн Бэби Beginners']);

    // Registration row
    sheet.addRow([
      '', // A
      'Коллектив 1', // B collective
      'Номер 1', // C dance name
      10, // D participantsCount
      '', // E
      'Иванов И.И.', // F leaders
      '', // G
      'Петров П.П.', // H trainers
      '', // I
      'Школа 1', // J school
      '+7 999 000-00-00', // K contacts
      'Москва', // L city
      '03:30', // M duration
      '', // N
      'https://example.com/video', // O video
      '', // P
      'Фамилия1 Имя1\nФамилия2 Имя2', // Q diplomas list
      2, // R medals
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  it('returns detailed preview in dryRun mode and reports parsing errors correctly', async () => {
    const token = await loginAndGetToken();
    const fileBuffer = await createBasicWorkbook();

    const res = await request(app)
      .post('/api/excel-import')
      .set('Authorization', `Bearer ${token}`)
      .field('eventId', '1')
      .field('dryRun', 'true')
      .attach('file', fileBuffer, {
        filename: 'import-test.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('dryRun', true);
    expect(res.body).toHaveProperty('totalRows');
    expect(res.body).toHaveProperty('preview');

    // preview should contain at least one parsed row with our collective name
    const preview = res.body.preview as any[];
    const parsedRow = preview.find((row) => row.collective === 'Коллектив 1');
    expect(parsedRow).toBeDefined();

    // parsed metadata should include discipline/nomination/age (если найдены)
    expect(parsedRow.parsed).toBeDefined();
    // Даже если какие-то поля не распознаны, errors должен содержать понятные сообщения
    expect(Array.isArray(parsedRow.errors)).toBe(true);
  });

  it('rejects request without file with clear error message', async () => {
    const token = await loginAndGetToken();

    const res = await request(app)
      .post('/api/excel-import')
      .set('Authorization', `Bearer ${token}`)
      .field('eventId', '1')
      .field('dryRun', 'true');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'No file uploaded');
  });
});


