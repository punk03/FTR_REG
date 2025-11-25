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

// Маппинг аббревиатур на полные названия дисциплин
const DISCIPLINE_ABBREVIATIONS: Record<string, string> = {
  'СТК': 'Современный танец',
  'СЭТ': 'Эстрадный танец',
  'СТ': 'Современный танец',
  'ЭТ': 'Эстрадный танец',
  'Классика': 'Классический танец',
  'Народный': 'Народный танец',
  'Бальный': 'Бальный танец',
  'Детский': 'Детский танец',
  'Спортивный': 'Спортивный танец',
  'Акробатический': 'Акробатический танец',
  'Цирковой': 'Цирковой танец',
  'Театр': 'Театр танца',
};

// Маппинг опечаток и вариантов написания
const DISCIPLINE_VARIANTS: Record<string, string> = {
  'contemprorary': 'Contemporary',
  'contemporary': 'Contemporary',
  'contemp': 'Contemporary',
  'dance show': 'Dance Show',
  'danceshow': 'Dance Show',
};

// Функция парсинга категории из строки вида "1. Jazz Соло Бэби Beginners" или "1. СТК (свободная танцевальная категория) (начинающие) Формейшн Бэби Beginners"
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

  // Получаем номер блока из начала строки
  const blockMatch = categoryStr.match(/^(\d+)\./);
  if (blockMatch) {
    result.blockNumber = parseInt(blockMatch[1]);
  }

  // Удаляем номер блока и точки
  let cleaned = categoryStr.trim().replace(/^[\d.]+/, '').trim();
  
  // Сохраняем оригинальную строку для поиска аббревиатур
  const originalCleaned = cleaned;
  
  // Удаляем содержимое в скобках (например, "(свободная танцевальная категория)", "(начинающие)")
  cleaned = cleaned.replace(/\([^)]*\)/g, '').trim();
  
  // Удаляем лишние пробелы
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Разбиваем на слова
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);

  // Ищем дисциплину - сначала проверяем аббревиатуры
  let disciplineFound = false;
  
  // Проверяем аббревиатуры в оригинальной строке (до удаления скобок)
  for (const [abbr, fullName] of Object.entries(DISCIPLINE_ABBREVIATIONS)) {
    if (originalCleaned.includes(abbr) || cleaned.includes(abbr)) {
      const discipline = disciplines.find((d) => d.name === fullName);
      if (discipline) {
        result.disciplineName = discipline.name;
        disciplineFound = true;
        break;
      }
    }
  }
  
  // Если не нашли по аббревиатуре, ищем по словам
  if (!disciplineFound) {
    for (let i = 0; i < words.length; i++) {
      // Проверяем одно слово
      const discipline = disciplines.find((d) => d.name.toLowerCase() === words[i].toLowerCase());
      if (discipline) {
        result.disciplineName = discipline.name;
        disciplineFound = true;
        break;
      }
      
      // Проверяем комбинации из двух слов (для составных названий типа "Street dance show")
      if (i < words.length - 1) {
        const twoWords = `${words[i]} ${words[i + 1]}`;
        const discipline2 = disciplines.find((d) => d.name.toLowerCase() === twoWords.toLowerCase());
        if (discipline2) {
          result.disciplineName = discipline2.name;
          disciplineFound = true;
          break;
        }
      }
      
      // Проверяем варианты написания и опечатки
      const wordLower = words[i].toLowerCase();
      if (DISCIPLINE_VARIANTS[wordLower]) {
        const variantName = DISCIPLINE_VARIANTS[wordLower];
        const discipline = disciplines.find((d) => d.name.toLowerCase() === variantName.toLowerCase());
        if (discipline) {
          result.disciplineName = discipline.name;
          disciplineFound = true;
          break;
        }
      }
      
      // Проверяем частичное совпадение (для случаев типа "Contemporary" в "Contemprorary")
      const disciplinePartial = disciplines.find((d) => {
        const dLower = d.name.toLowerCase();
        const wLower = words[i].toLowerCase();
        // Более гибкое сравнение: первые 4-5 символов должны совпадать
        const minLen = Math.min(4, Math.min(dLower.length, wLower.length));
        if (minLen > 0) {
          return dLower.substring(0, minLen) === wLower.substring(0, minLen) ||
                 dLower.includes(wLower) || wLower.includes(dLower);
        }
        return false;
      });
      if (disciplinePartial) {
        result.disciplineName = disciplinePartial.name;
        disciplineFound = true;
        break;
      }
    }
  }

  // Ищем номинацию - проверяем каждое слово
  for (let i = 0; i < words.length; i++) {
    const nomination = nominations.find((n) => {
      const nLower = n.name.toLowerCase();
      const wordLower = words[i].toLowerCase();
      // Точное совпадение или начало слова (для "Дуэт/Пара")
      return nLower === wordLower || nLower.startsWith(wordLower) || wordLower.startsWith(nLower.split('/')[0].toLowerCase());
    });
    if (nomination) {
      result.nominationName = nomination.name;
      break;
    }
    
    // Проверяем комбинации из двух слов
    if (i < words.length - 1) {
      const twoWords = `${words[i]} ${words[i + 1]}`;
      const nomination2 = nominations.find((n) => n.name.toLowerCase() === twoWords.toLowerCase());
      if (nomination2) {
        result.nominationName = nomination2.name;
        break;
      }
    }
    
    // Проверяем частичное совпадение (для опечаток типа "Формейшн" вместо "Формейшн")
    const nominationPartial = nominations.find((n) => {
      const nLower = n.name.toLowerCase();
      const wLower = words[i].toLowerCase();
      return nLower.includes(wLower) || wLower.includes(nLower) ||
             (nLower.length > 3 && wLower.length > 3 && 
              nLower.substring(0, Math.min(4, nLower.length)) === wLower.substring(0, Math.min(4, wLower.length)));
    });
    if (nominationPartial) {
      result.nominationName = nominationPartial.name;
      break;
    }
  }

  // Ищем возраст - проверяем каждое слово
  for (let i = 0; i < words.length; i++) {
    const age = ages.find((a) => {
      const aLower = a.name.toLowerCase();
      const wordLower = words[i].toLowerCase();
      return aLower === wordLower || aLower.startsWith(wordLower) || wordLower.startsWith(aLower.split(' ')[0].toLowerCase());
    });
    if (age) {
      result.ageName = age.name;
      break;
    }
    
    // Проверяем комбинации из двух слов (для "Мини 1", "Мини 2", "Ювеналы 1", "Ювеналы 2")
    if (i < words.length - 1) {
      const twoWords = `${words[i]} ${words[i + 1]}`;
      const age2 = ages.find((a) => a.name.toLowerCase() === twoWords.toLowerCase());
      if (age2) {
        result.ageName = age2.name;
        break;
      }
    }
    
    // Проверяем частичное совпадение
    const agePartial = ages.find((a) => {
      const aLower = a.name.toLowerCase();
      const wLower = words[i].toLowerCase();
      return aLower.includes(wLower) || wLower.includes(aLower) ||
             (aLower.length > 2 && wLower.length > 2 && 
              aLower.substring(0, Math.min(3, aLower.length)) === wLower.substring(0, Math.min(3, wLower.length)));
    });
    if (agePartial) {
      result.ageName = agePartial.name;
      break;
    }
  }

  // Ищем категорию (обычно последнее слово, но может быть и в середине)
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
      // ВАЖНО: Парсим последовательно, чтобы currentCategory был синхронизирован
      let currentCategory: ParsedRow['parsed'] | null = null;
      const parsedRows: ParsedRow[] = [];
      
      // Проходим по всем строкам после заголовков ПОСЛЕДОВАТЕЛЬНО
      for (let rowIndex = headerRowIndex + 1; rowIndex <= worksheet.rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);
        const parsedRow: ParsedRow = {
          rowNumber: rowIndex,
          errors: [],
        };

        try {
          // Получаем значения ячеек - используем richText для правильного чтения длинных значений
          const categoryCell = row.getCell(1);
          const collectiveCell = row.getCell(2);
          const danceNameCell = row.getCell(3);
          const participantsCell = row.getCell(4);
          
          // Пропускаем полностью пустые строки
          if (!categoryCell.value && !collectiveCell.value && !danceNameCell.value) {
            continue;
          }

          // Вспомогательная функция для чтения значения ячейки
          const readCellValue = (cell: any): string => {
            if (!cell || !cell.value) return '';
            // Проверяем тип значения
            if (typeof cell.value === 'object' && 'richText' in cell.value) {
              return (cell.value.richText as any[]).map((rt: any) => rt.text || '').join('').trim();
            }
            return String(cell.value).trim();
          };

          // Правильно читаем значения ячеек
          const categoryValue = readCellValue(categoryCell);
          const collectiveValue = readCellValue(collectiveCell);
          const danceNameValue = readCellValue(danceNameCell);

          // Определяем, является ли строка строкой категории
          // Проверяем начало строк (первые 50 символов) вместо полного совпадения
          // Это нужно, так как Excel может обрезать длинные значения
          const categoryStart = categoryValue.substring(0, 50);
          const collectiveStart = collectiveValue.substring(0, 50);
          const danceNameStart = danceNameValue.substring(0, 50);
          
          const isCategoryRow = 
            categoryValue && 
            collectiveValue && 
            danceNameValue &&
            categoryStart === collectiveStart && 
            collectiveStart === danceNameStart &&
            /^\d+\./.test(categoryValue); // Начинается с цифры и точки

          if (isCategoryRow) {
            // Это строка категории - парсим категорию и сохраняем для следующих строк
            parsedRow.categoryString = categoryValue;
            const parsed = await parseCategoryString(
              parsedRow.categoryString,
              disciplines,
              nominations,
              ages,
              categories
            );
            
            // Поиск ID в справочниках
            const parsedData: ParsedRow['parsed'] = {};
            
            if (parsed.blockNumber) {
              parsedData.blockNumber = parsed.blockNumber;
            }
            
            if (parsed.disciplineName) {
              const discipline = disciplines.find((d: any) => d.name === parsed.disciplineName);
              if (discipline) {
                parsedData.disciplineId = discipline.id;
                parsedData.disciplineName = discipline.name;
              } else {
                console.warn(`[Excel Import] Дисциплина "${parsed.disciplineName}" не найдена в строке ${rowIndex}`);
              }
            }

            if (parsed.nominationName) {
              const nomination = nominations.find((n: any) => n.name === parsed.nominationName);
              if (nomination) {
                parsedData.nominationId = nomination.id;
                parsedData.nominationName = nomination.name;
              } else {
                console.warn(`[Excel Import] Номинация "${parsed.nominationName}" не найдена в строке ${rowIndex}`);
              }
            }

            if (parsed.ageName) {
              const age = ages.find((a: any) => a.name === parsed.ageName);
              if (age) {
                parsedData.ageId = age.id;
                parsedData.ageName = age.name;
              } else {
                console.warn(`[Excel Import] Возраст "${parsed.ageName}" не найден в строке ${rowIndex}`);
              }
            }

            if (parsed.categoryName) {
              const category = categories.find((c: any) => c.name === parsed.categoryName);
              if (category) {
                parsedData.categoryId = category.id;
                parsedData.categoryName = category.name;
              } else {
                console.warn(`[Excel Import] Категория "${parsed.categoryName}" не найдена в строке ${rowIndex}`);
              }
            }

            // Сохраняем категорию для следующих строк
            if (Object.keys(parsedData).length > 0) {
              currentCategory = parsedData;
              console.log(`[Excel Import] Строка ${rowIndex}: Найдена категория - Дисциплина: ${parsedData.disciplineName || 'не найдена'}, Номинация: ${parsedData.nominationName || 'не найдена'}, Возраст: ${parsedData.ageName || 'не найдена'}`);
            }
            
            // Не добавляем строки категорий в результат
            continue;
          }

            // Это строка с данными регистрации
          // Должна быть колонка B (коллектив)
          // Название танца может быть пустым для соло
          if (!collectiveValue) {
            continue; // Пропускаем строки без коллектива
          }

          // Используем текущую категорию, если она есть
          if (currentCategory && Object.keys(currentCategory).length > 0) {
            parsedRow.parsed = Object.assign({}, currentCategory);
          } else {
            // Если категории нет, пытаемся парсить из колонки A
            if (categoryValue && /^\d+\./.test(categoryValue)) {
              parsedRow.categoryString = categoryValue;
              const parsed = await parseCategoryString(
                parsedRow.categoryString,
                disciplines,
                nominations,
                ages,
                categories
              );
              
              const parsedData: ParsedRow['parsed'] = {};
              if (parsed.blockNumber) parsedData.blockNumber = parsed.blockNumber;
              
              if (parsed.disciplineName) {
                const discipline = disciplines.find((d: any) => d.name === parsed.disciplineName);
                if (discipline) {
                  parsedData.disciplineId = discipline.id;
                  parsedData.disciplineName = discipline.name;
                }
              }
              if (parsed.nominationName) {
                const nomination = nominations.find((n: any) => n.name === parsed.nominationName);
                if (nomination) {
                  parsedData.nominationId = nomination.id;
                  parsedData.nominationName = nomination.name;
                }
              }
              if (parsed.ageName) {
                const age = ages.find((a: any) => a.name === parsed.ageName);
                if (age) {
                  parsedData.ageId = age.id;
                  parsedData.ageName = age.name;
                }
              }
              if (parsed.categoryName) {
                const category = categories.find((c: any) => c.name === parsed.categoryName);
                if (category) {
                  parsedData.categoryId = category.id;
                  parsedData.categoryName = category.name;
                }
              }
              
              parsedRow.parsed = parsedData;
              currentCategory = parsedData;
            }
          }

          // Колонка B (2): коллектив
          parsedRow.collective = collectiveValue;

          // Колонка C (3): название танца (может быть пустым для соло)
          parsedRow.danceName = danceNameValue || collectiveValue; // Используем коллектив как fallback для соло

          // Вспомогательная функция для чтения значения ячейки
          const readCellValue = (cell: any): string => {
            if (!cell || !cell.value) return '';
            if (cell.value.richText) {
              return cell.value.richText.map((rt: any) => rt.text || '').join('').trim();
            }
            return String(cell.value).trim();
          };

          // Колонка D (4): количество участников
          if (participantsCell.value !== null && participantsCell.value !== undefined && participantsCell.value !== '') {
            const participantsValue = Number(participantsCell.value);
            if (!isNaN(participantsValue)) {
              parsedRow.participantsCount = Math.floor(participantsValue);
            }
          }

          // Колонка F (6): руководители (пропускаем пустую колонку E)
          const leadersCell = row.getCell(6);
          const leadersValue = readCellValue(leadersCell);
          if (leadersValue) {
            parsedRow.leaders = leadersValue;
          }

          // Колонка H (8): тренеры (пропускаем пустую колонку G)
          const trainersCell = row.getCell(8);
          const trainersValue = readCellValue(trainersCell);
          if (trainersValue) {
            parsedRow.trainers = trainersValue;
          }

          // Колонка J (10): школа (пропускаем пустую колонку I)
          const schoolCell = row.getCell(10);
          const schoolValue = readCellValue(schoolCell);
          if (schoolValue) {
            parsedRow.school = schoolValue;
          }

          // Колонка K (11): контакты
          const contactsCell = row.getCell(11);
          const contactsValue = readCellValue(contactsCell);
          if (contactsValue) {
            parsedRow.contacts = contactsValue;
          }

          // Колонка L (12): город
          const cityCell = row.getCell(12);
          const cityValue = readCellValue(cityCell);
          if (cityValue) {
            parsedRow.city = cityValue;
          }

          // Колонка M (13): длительность
          const durationCell = row.getCell(13);
          const durationValue = readCellValue(durationCell);
          if (durationValue) {
            parsedRow.duration = durationValue;
          }

          // Колонка O (15): ссылка (видео URL) (пропускаем колонку N - длительность с перерывами)
          const videoUrlCell = row.getCell(15);
          const videoUrlValue = readCellValue(videoUrlCell);
          if (videoUrlValue) {
            parsedRow.videoUrl = videoUrlValue;
          }

          // Колонка Q (17): ФИО на дипломы (пропускаем колонку P - примечание)
          const diplomasCell = row.getCell(17);
          const diplomasValue = readCellValue(diplomasCell);
          if (diplomasValue) {
            parsedRow.diplomasList = diplomasValue;
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
          // Название танца может быть пустым для соло - не добавляем ошибку
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

        // Добавляем только строки с данными регистрации (не категории)
        if (parsedRow.collective) {
          parsedRows.push(parsedRow);
        }
      }

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
                school: row.school,
                contacts: row.contacts,
                city: row.city,
              },
            });
          } else {
            // Обновляем данные коллектива, если они изменились
            if (row.school || row.contacts || row.city) {
              collective = await prisma.collective.update({
                where: { id: collective.id },
                data: {
                  school: row.school || collective.school,
                  contacts: row.contacts || collective.contacts,
                  city: row.city || collective.city,
                },
              });
            }
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

