import express, { Request, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { importRateLimiter } from '../middleware/rateLimit';
import { parseParticipants } from '../services/registrationService';

const router = express.Router();
const prisma = new PrismaClient();

// Настройка multer для загрузки файлов
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files are allowed.'));
    }
  },
});

interface ParsedRow {
  rowNumber: number;
  categoryString?: string;
  collective?: string;
  danceName?: string;
  participantsCount?: number;
  leaders?: string;
  trainers?: string;
  school?: string;
  contacts?: string;
  city?: string;
  duration?: string;
  videoUrl?: string;
  diplomasList?: string;
  medalsCount?: number;
  errors: string[];
  parsed?: {
    blockNumber?: number;
    disciplineId?: number;
    disciplineName?: string;
    nominationId?: number;
    nominationName?: string;
    ageId?: number;
    ageName?: string;
    categoryId?: number;
    categoryName?: string;
  };
}

// Функция парсинга категории из строки вида "1. Jazz Соло Бэби Beginners"
async function parseCategoryString(
  categoryStr: string,
  disciplines: any[],
  nominations: any[],
  ages: any[],
  categories: any[]
): Promise<{
  blockNumber?: number;
  disciplineName?: string;
  nominationName?: string;
  ageName?: string;
  categoryName?: string;
}> {
  const result: any = {};

  if (!categoryStr || typeof categoryStr !== 'string') {
    return result;
  }

  // Удаляем точки и лишние пробелы
  const cleaned = categoryStr.trim().replace(/^[\d.]+/, '').trim();

  // Получаем номер блока из начала строки
  const blockMatch = categoryStr.match(/^(\d+)\./);
  if (blockMatch) {
    result.blockNumber = parseInt(blockMatch[1]);
  }

  // Разбиваем на слова
  const words = cleaned.split(/\s+/);

  // Ищем дисциплину (обычно первое слово после номера)
  for (const word of words) {
    const discipline = disciplines.find((d) => d.name.toLowerCase() === word.toLowerCase());
    if (discipline) {
      result.disciplineName = discipline.name;
      break;
    }
  }

  // Ищем номинацию
  for (const word of words) {
    const nomination = nominations.find((n) => n.name.toLowerCase() === word.toLowerCase());
    if (nomination) {
      result.nominationName = nomination.name;
      break;
    }
  }

  // Ищем возраст
  for (const word of words) {
    const age = ages.find((a) => a.name.toLowerCase() === word.toLowerCase());
    if (age) {
      result.ageName = age.name;
      break;
    }
  }

  // Ищем категорию (обычно последнее слово)
  for (let i = words.length - 1; i >= 0; i--) {
    const category = categories.find((c) => c.name.toLowerCase() === words[i].toLowerCase());
    if (category) {
      result.categoryName = category.name;
      break;
    }
  }

  return result;
}

// POST /api/excel-import
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN'),
  importRateLimiter,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const eventId = parseInt(req.body.eventId);
      const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;

      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }

      // Проверка существования события
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      // Парсинг Excel файла
      const workbook = new ExcelJS.Workbook();
      // Convert buffer to proper Buffer type for ExcelJS
      // @ts-expect-error - ExcelJS accepts Buffer but TypeScript sees different Buffer type
      await workbook.xlsx.load(req.file.buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        res.status(400).json({ error: 'Excel file is empty' });
        return;
      }

      const parsedRows: ParsedRow[] = [];

      // Загружаем справочники один раз
      const [disciplines, nominations, ages, categories] = await Promise.all([
        prisma.discipline.findMany(),
        prisma.nomination.findMany(),
        prisma.age.findMany(),
        prisma.category.findMany(),
      ]);

      // Определяем строку с заголовками (ищем строку с "Наименование коллектива" или "№")
      let headerRowIndex = 1;
      for (let i = 1; i <= Math.min(10, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        const cellB = row.getCell(2);
        const cellA = row.getCell(1);
        if (
          (cellB.value && String(cellB.value).includes('коллектив')) ||
          (cellA.value && String(cellA.value).trim() === '№')
        ) {
          headerRowIndex = i;
          break;
        }
      }

      // Парсинг строк (начиная после строки с заголовками)
      let rowNumber = headerRowIndex + 1;
      const parsePromises: Promise<void>[] = [];
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex <= headerRowIndex) return; // Пропускаем заголовки и пустые строки до них

        const parsePromise = (async () => {
          const parsedRow: ParsedRow = {
            rowNumber,
            errors: [],
          };

          try {
          // Колонка A: номер (категория)
          const categoryCell = row.getCell(1);
          if (categoryCell.value) {
            parsedRow.categoryString = String(categoryCell.value);
            const parsed = await parseCategoryString(
              parsedRow.categoryString,
              disciplines,
              nominations,
              ages,
              categories
            );
            parsedRow.parsed = parsed;

            // Поиск ID в справочниках
            if (parsed.disciplineName) {
              const discipline = disciplines.find((d) => d.name === parsed.disciplineName);
              if (discipline) {
                parsedRow.parsed.disciplineId = discipline.id;
              } else {
                parsedRow.errors.push(`Дисциплина "${parsed.disciplineName}" не найдена`);
              }
            }

            if (parsed.nominationName) {
              const nomination = nominations.find((n) => n.name === parsed.nominationName);
              if (nomination) {
                parsedRow.parsed.nominationId = nomination.id;
              } else {
                parsedRow.errors.push(`Номинация "${parsed.nominationName}" не найдена`);
              }
            }

            if (parsed.ageName) {
              const age = ages.find((a) => a.name === parsed.ageName);
              if (age) {
                parsedRow.parsed.ageId = age.id;
              } else {
                parsedRow.errors.push(`Возраст "${parsed.ageName}" не найден`);
              }
            }

            if (parsed.categoryName) {
              const category = categories.find((c) => c.name === parsed.categoryName);
              if (category) {
                parsedRow.parsed.categoryId = category.id;
              } else {
                parsedRow.errors.push(`Категория "${parsed.categoryName}" не найдена`);
              }
            }
          }

          // Колонка B: коллектив
          const collectiveCell = row.getCell(2);
          if (collectiveCell.value) {
            parsedRow.collective = String(collectiveCell.value).trim();
          }

          // Колонка C: название танца
          const danceNameCell = row.getCell(3);
          if (danceNameCell.value) {
            parsedRow.danceName = String(danceNameCell.value).trim();
          }

          // Колонка D (4): количество участников
          const participantsCell = row.getCell(4);
          if (participantsCell.value !== null && participantsCell.value !== undefined && participantsCell.value !== '') {
            const participantsValue = Number(participantsCell.value);
            if (!isNaN(participantsValue)) {
              parsedRow.participantsCount = Math.floor(participantsValue);
            }
          }

          // Колонка F (6): руководители (пропускаем пустую колонку E)
          const leadersCell = row.getCell(6);
          if (leadersCell.value && String(leadersCell.value).trim()) {
            parsedRow.leaders = String(leadersCell.value).trim();
          }

          // Колонка H (8): тренеры (пропускаем пустую колонку G)
          const trainersCell = row.getCell(8);
          if (trainersCell.value && String(trainersCell.value).trim()) {
            parsedRow.trainers = String(trainersCell.value).trim();
          }

          // Колонка J (10): школа (пропускаем пустую колонку I)
          const schoolCell = row.getCell(10);
          if (schoolCell.value && String(schoolCell.value).trim()) {
            parsedRow.school = String(schoolCell.value).trim();
          }

          // Колонка K (11): контакты
          const contactsCell = row.getCell(11);
          if (contactsCell.value && String(contactsCell.value).trim()) {
            parsedRow.contacts = String(contactsCell.value).trim();
          }

          // Колонка L (12): город
          const cityCell = row.getCell(12);
          if (cityCell.value && String(cityCell.value).trim()) {
            parsedRow.city = String(cityCell.value).trim();
          }

          // Колонка M (13): длительность
          const durationCell = row.getCell(13);
          if (durationCell.value && String(durationCell.value).trim()) {
            parsedRow.duration = String(durationCell.value).trim();
          }

          // Колонка O (15): ссылка (видео URL) (пропускаем колонку N - длительность с перерывами)
          const videoUrlCell = row.getCell(15);
          if (videoUrlCell.value && String(videoUrlCell.value).trim()) {
            parsedRow.videoUrl = String(videoUrlCell.value).trim();
          }

          // Колонка Q (17): ФИО на дипломы (пропускаем колонку P - примечание)
          const diplomasCell = row.getCell(17);
          if (diplomasCell.value && String(diplomasCell.value).trim()) {
            parsedRow.diplomasList = String(diplomasCell.value).trim();
          }

          // Колонка R (18): количество медалей
          const medalsCell = row.getCell(18);
          if (medalsCell.value !== null && medalsCell.value !== undefined && medalsCell.value !== '') {
            const medalsValue = Number(medalsCell.value);
            if (!isNaN(medalsValue)) {
              parsedRow.medalsCount = Math.floor(medalsValue);
            }
          }

          // Валидация обязательных полей
          if (!parsedRow.collective) {
            parsedRow.errors.push('Не указан коллектив');
          }
          if (!parsedRow.danceName) {
            parsedRow.errors.push('Не указано название танца');
          }
          if (!parsedRow.parsed?.disciplineId) {
            parsedRow.errors.push('Не удалось определить дисциплину');
          }
          if (!parsedRow.parsed?.nominationId) {
            parsedRow.errors.push('Не удалось определить номинацию');
          }
          if (!parsedRow.parsed?.ageId) {
            parsedRow.errors.push('Не удалось определить возраст');
          }
          } catch (error: any) {
            parsedRow.errors.push(`Ошибка парсинга строки: ${error.message}`);
          }

          // Добавляем только непустые строки
          if (parsedRow.collective || parsedRow.categoryString) {
            parsedRows.push(parsedRow);
          }
          rowNumber++;
        })();

        parsePromises.push(parsePromise);
      });

      await Promise.all(parsePromises);

      // В dryRun режиме возвращаем предпросмотр
      if (dryRun) {
        res.json({
          success: true,
          dryRun: true,
          totalRows: parsedRows.length,
          preview: parsedRows.slice(0, 100), // Первые 100 строк для предпросмотра
          errors: parsedRows.filter((r) => r.errors.length > 0).length,
        });
        return;
      }

      // Реальный импорт
      let imported = 0;
      let skipped = 0;
      const importErrors: Array<{ row: number; error: string }> = [];

      // Удаляем старые регистрации события (если указано)
      const deleteExisting = req.body.deleteExisting === 'true' || req.body.deleteExisting === true;
      if (deleteExisting) {
        await prisma.registration.deleteMany({
          where: { eventId },
        });
      }

      // Импорт регистраций
      for (const row of parsedRows) {
        if (row.errors.length > 0) {
          skipped++;
          importErrors.push({
            row: row.rowNumber,
            error: row.errors.join('; '),
          });
          continue;
        }

        try {
          // Поиск или создание коллектива
          let collective = await prisma.collective.findFirst({
            where: { name: { equals: row.collective, mode: 'insensitive' } },
          });

          if (!collective) {
            collective = await prisma.collective.create({
              data: {
                name: row.collective!,
              },
            });
          }

          // Парсинг участников из diplomasList
          const participantsResult = row.diplomasList ? parseParticipants(row.diplomasList) : { participants: [], count: 0 };

          // Создание регистрации
          const registration = await prisma.registration.create({
            data: {
              userId: (req as any).user.id,
              eventId,
              collectiveId: collective.id,
              disciplineId: row.parsed!.disciplineId!,
              nominationId: row.parsed!.nominationId!,
              ageId: row.parsed!.ageId!,
              categoryId: row.parsed?.categoryId,
              danceName: row.danceName,
              participantsCount: row.participantsCount || participantsResult.count || 0,
              federationParticipantsCount: 0,
              diplomasCount: participantsResult.count,
              medalsCount: row.medalsCount || 0,
              diplomasList: row.diplomasList,
              duration: row.duration,
              videoUrl: row.videoUrl,
              blockNumber: row.parsed?.blockNumber,
              agreement: true,
              agreement2: true,
              status: 'APPROVED',
            },
          });

          // Добавление руководителей и тренеров
          if (row.leaders) {
            const leaderNames = row.leaders.split(',').map((n) => n.trim());
            for (const name of leaderNames) {
              if (name) {
                let person = await prisma.person.findFirst({
                  where: { 
                    fullName: { equals: name, mode: 'insensitive' },
                    role: 'LEADER'
                  },
                });

                if (!person) {
                  person = await prisma.person.create({
                    data: { fullName: name, role: 'LEADER' },
                  });
                }

                await prisma.registrationLeader.upsert({
                  where: {
                    registrationId_personId: {
                      registrationId: registration.id,
                      personId: person.id,
                    },
                  },
                  update: {},
                  create: {
                    registrationId: registration.id,
                    personId: person.id,
                  },
                });
              }
            }
          }

          if (row.trainers) {
            const trainerNames = row.trainers.split(',').map((n) => n.trim());
            for (const name of trainerNames) {
              if (name) {
                let person = await prisma.person.findFirst({
                  where: { 
                    fullName: { equals: name, mode: 'insensitive' },
                    role: 'TRAINER'
                  },
                });

                if (!person) {
                  person = await prisma.person.create({
                    data: { fullName: name, role: 'TRAINER' },
                  });
                }

                await prisma.registrationTrainer.upsert({
                  where: {
                    registrationId_personId: {
                      registrationId: registration.id,
                      personId: person.id,
                    },
                  },
                  update: {},
                  create: {
                    registrationId: registration.id,
                    personId: person.id,
                  },
                });
              }
            }
          }

          imported++;
        } catch (error: any) {
          skipped++;
          importErrors.push({
            row: row.rowNumber,
            error: error.message || 'Ошибка создания регистрации',
          });
        }
      }

      res.json({
        success: true,
        imported,
        skipped,
        errors: importErrors,
        totalRows: parsedRows.length,
      });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

export default router;

