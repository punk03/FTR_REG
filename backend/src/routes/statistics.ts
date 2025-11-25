import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { cacheService } from '../services/cacheService';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/statistics
router.get('/', authenticateToken, requireRole('ADMIN', 'STATISTICIAN', 'ACCOUNTANT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.query.eventId as string);
    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }

    const cacheKey = `statistics:${eventId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId },
      include: {
        nomination: true,
        discipline: true,
        age: true,
        collective: true,
      },
    });

    const overview = {
      totalRegistrations: registrations.length,
      totalCollectives: new Set(registrations.map((r) => r.collectiveId)).size,
      totalParticipants: registrations.reduce((sum, r) => sum + r.participantsCount, 0),
      totalDiplomas: registrations.reduce((sum, r) => sum + r.diplomasCount, 0),
      totalMedals: registrations.reduce((sum, r) => sum + r.medalsCount, 0),
    };

    const byNomination: Record<string, number> = {};
    const byDiscipline: Record<string, number> = {};
    const byAge: Record<string, number> = {};

    for (const reg of registrations) {
      byNomination[reg.nomination.name] = (byNomination[reg.nomination.name] || 0) + 1;
      byDiscipline[reg.discipline.name] = (byDiscipline[reg.discipline.name] || 0) + 1;
      byAge[reg.age.name] = (byAge[reg.age.name] || 0) + 1;
    }

    const payments = {
      paid: registrations.filter((r) => r.paymentStatus === 'PAID').length,
      performancePaid: registrations.filter((r) => r.paymentStatus === 'PERFORMANCE_PAID').length,
      diplomasPaid: registrations.filter((r) => r.paymentStatus === 'DIPLOMAS_PAID').length,
      unpaid: registrations.filter((r) => r.paymentStatus === 'UNPAID').length,
      totalAmount: registrations.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0),
    };

    const statistics = {
      overview,
      byNomination: Object.entries(byNomination).map(([name, count]) => ({ name, count })),
      byDiscipline: Object.entries(byDiscipline).map(([name, count]) => ({ name, count })),
      byAge: Object.entries(byAge).map(([name, count]) => ({ name, count })),
      payments,
    };

    await cacheService.set(cacheKey, statistics, 300); // Cache for 5 minutes
    res.json(statistics);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/statistics/export/excel
router.get(
  '/export/excel',
  authenticateToken,
  requireRole('ADMIN', 'STATISTICIAN', 'ACCOUNTANT'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const eventId = parseInt(req.query.eventId as string);
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      const registrations = await prisma.registration.findMany({
        where: { eventId },
        include: {
          nomination: true,
          discipline: true,
          age: true,
          category: true,
          collective: true,
        },
      });

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Статистика');

      // Set column widths
      worksheet.columns = [
        { width: 10 }, // №
        { width: 25 }, // Коллектив
        { width: 30 }, // Название
        { width: 15 }, // Дисциплина
        { width: 15 }, // Номинация
        { width: 15 }, // Возраст
        { width: 15 }, // Категория
        { width: 12 }, // Участники
        { width: 12 }, // Фед. участники
        { width: 12 }, // Дипломы
        { width: 12 }, // Медали
        { width: 15 }, // Статус оплаты
      ];

      // Header row
      worksheet.addRow([
        '№',
        'Коллектив',
        'Название',
        'Дисциплина',
        'Номинация',
        'Возраст',
        'Категория',
        'Участники',
        'Фед. участники',
        'Дипломы',
        'Медали',
        'Статус оплаты',
      ]);

      // Style header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      for (const reg of registrations) {
        const paymentStatus =
          reg.paymentStatus === 'PAID'
            ? 'Оплачено'
            : reg.paymentStatus === 'PERFORMANCE_PAID'
            ? 'Оплачено выступление'
            : reg.paymentStatus === 'DIPLOMAS_PAID'
            ? 'Оплачены дипломы'
            : 'Не оплачено';

        worksheet.addRow([
          reg.number || '',
          reg.collective?.name || '',
          reg.danceName || '',
          reg.discipline?.name || '',
          reg.nomination?.name || '',
          reg.age?.name || '',
          reg.category?.name || '',
          reg.participantsCount,
          reg.federationParticipantsCount,
          reg.diplomasCount,
          reg.medalsCount,
          paymentStatus,
        ]);
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=statistics_${eventId}_${Date.now()}.xlsx`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// GET /api/statistics/export/csv
router.get(
  '/export/csv',
  authenticateToken,
  requireRole('ADMIN', 'STATISTICIAN', 'ACCOUNTANT'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const eventId = parseInt(req.query.eventId as string);
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }

      const registrations = await prisma.registration.findMany({
        where: { eventId },
        include: {
          nomination: true,
          discipline: true,
          age: true,
          category: true,
          collective: true,
        },
      });

      // CSV header
      const csvRows: string[] = [];
      csvRows.push('№,Коллектив,Название,Дисциплина,Номинация,Возраст,Категория,Участники,Фед. участники,Дипломы,Медали,Статус оплаты');

      // Add data rows
      for (const reg of registrations) {
        const paymentStatus =
          reg.paymentStatus === 'PAID'
            ? 'Оплачено'
            : reg.paymentStatus === 'PERFORMANCE_PAID'
            ? 'Оплачено выступление'
            : reg.paymentStatus === 'DIPLOMAS_PAID'
            ? 'Оплачены дипломы'
            : 'Не оплачено';

        const collective = (reg.collective?.name || '').replace(/,/g, ';');
        const danceName = (reg.danceName || '').replace(/,/g, ';');

        csvRows.push(
          `${reg.number || ''},${collective},${danceName},${reg.discipline?.name || ''},${reg.nomination?.name || ''},${reg.age?.name || ''},${reg.category?.name || ''},${reg.participantsCount},${reg.federationParticipantsCount},${reg.diplomasCount},${reg.medalsCount},${paymentStatus}`
        );
      }

      const csvContent = csvRows.join('\n');
      const csvBuffer = Buffer.from('\ufeff' + csvContent, 'utf8'); // BOM for Excel UTF-8 support

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=statistics_${eventId}_${Date.now()}.csv`);
      res.send(csvBuffer);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// GET /api/statistics/export/pdf
router.get(
  '/export/pdf',
  authenticateToken,
  requireRole('ADMIN', 'STATISTICIAN', 'ACCOUNTANT'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const eventId = parseInt(req.query.eventId as string);
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      const registrations = await prisma.registration.findMany({
        where: { eventId },
        include: {
          nomination: true,
          discipline: true,
          age: true,
          category: true,
          collective: true,
        },
      });

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=statistics_${eventId}_${Date.now()}.pdf`);

      // Pipe PDF to response
      doc.pipe(res);

      // Header
      doc.fontSize(18).text(`Статистика: ${event.name}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Дата формирования: ${new Date().toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`, { align: 'center' });
      doc.moveDown(2);

      // Overview statistics
      const totalRegistrations = registrations.length;
      const totalCollectives = new Set(registrations.map((r) => r.collectiveId)).size;
      const totalParticipants = registrations.reduce((sum, r) => sum + r.participantsCount, 0);
      const totalDiplomas = registrations.reduce((sum, r) => sum + r.diplomasCount, 0);
      const totalMedals = registrations.reduce((sum, r) => sum + r.medalsCount, 0);

      doc.fontSize(14).text('Общая статистика', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Всего регистраций: ${totalRegistrations}`);
      doc.text(`Всего коллективов: ${totalCollectives}`);
      doc.text(`Всего участников: ${totalParticipants}`);
      doc.text(`Всего дипломов: ${totalDiplomas}`);
      doc.text(`Всего медалей: ${totalMedals}`);
      doc.moveDown(2);

      // Payment statistics
      const paid = registrations.filter((r) => r.paymentStatus === 'PAID').length;
      const performancePaid = registrations.filter((r) => r.paymentStatus === 'PERFORMANCE_PAID').length;
      const diplomasPaid = registrations.filter((r) => r.paymentStatus === 'DIPLOMAS_PAID').length;
      const unpaid = registrations.filter((r) => r.paymentStatus === 'UNPAID').length;
      const totalAmount = registrations.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);

      doc.fontSize(14).text('Статистика по оплатам', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Полностью оплачено: ${paid}`);
      doc.text(`Оплачено выступление: ${performancePaid}`);
      doc.text(`Оплачены дипломы: ${diplomasPaid}`);
      doc.text(`Не оплачено: ${unpaid}`);
      doc.text(`Общая сумма оплат: ${totalAmount.toFixed(2)} ₽`);
      doc.moveDown(2);

      // Statistics by nomination
      const byNomination: Record<string, number> = {};
      registrations.forEach((r) => {
        byNomination[r.nomination.name] = (byNomination[r.nomination.name] || 0) + 1;
      });

      doc.fontSize(14).text('Статистика по номинациям', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      Object.entries(byNomination)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, count]) => {
          doc.text(`${name}: ${count}`);
        });
      doc.moveDown(2);

      // Statistics by discipline
      const byDiscipline: Record<string, number> = {};
      registrations.forEach((r) => {
        byDiscipline[r.discipline.name] = (byDiscipline[r.discipline.name] || 0) + 1;
      });

      doc.fontSize(14).text('Статистика по дисциплинам', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      Object.entries(byDiscipline)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, count]) => {
          doc.text(`${name}: ${count}`);
        });
      doc.moveDown(2);

      // Statistics by age
      const byAge: Record<string, number> = {};
      registrations.forEach((r) => {
        byAge[r.age.name] = (byAge[r.age.name] || 0) + 1;
      });

      doc.fontSize(14).text('Статистика по возрастам', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      Object.entries(byAge)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, count]) => {
          doc.text(`${name}: ${count}`);
        });

      // Finalize PDF
      doc.end();
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

export default router;

