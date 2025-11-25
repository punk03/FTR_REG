// @ts-ignore - pdfmake types
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore - pdfmake types
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Инициализация шрифтов
try {
  if (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) {
    pdfMake.vfs = pdfFonts.pdfMake.vfs;
  } else if (pdfFonts && (pdfFonts as any).vfs) {
    pdfMake.vfs = (pdfFonts as any).vfs;
  }
} catch (error) {
  console.warn('Failed to initialize pdfmake fonts:', error);
  // Create empty vfs if fonts fail to load
  if (!pdfMake.vfs) {
    pdfMake.vfs = {};
  }
}

interface AccountingEntry {
  id: number;
  createdAt: string;
  amount: number;
  discountAmount: number;
  method: 'CASH' | 'CARD' | 'TRANSFER';
  paidFor: 'PERFORMANCE' | 'DIPLOMAS_MEDALS';
  collective?: { name: string };
  registration?: { danceName?: string };
  paymentGroupName?: string;
}

interface AccountingData {
  summary: {
    totalAmount: number;
    totalDiscount: number;
    grandTotal: number;
    performance: {
      cash: number;
      card: number;
      transfer: number;
    };
    diplomasMedals: {
      cash: number;
      card: number;
      transfer: number;
    };
  };
  grouped: Record<string, AccountingEntry[]>;
  ungrouped: AccountingEntry[];
}

export const exportAccountingToPDF = async (
  data: AccountingData,
  eventName: string,
  eventId: number
): Promise<void> => {
  // Инициализируем pdfmake при первом вызове
  const pdfMake = await initializePdfMake();
  
  if (!pdfMake.vfs || Object.keys(pdfMake.vfs).length === 0) {
    console.error('PDF fonts not loaded. Cannot generate PDF.');
    throw new Error('Шрифты для PDF не загружены. Пожалуйста, обновите страницу.');
  }
  const formatCurrency = (amount: number): string => {
    return `${amount.toFixed(2)} ₽`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getMethodName = (method: string): string => {
    switch (method) {
      case 'CASH':
        return 'Наличные';
      case 'CARD':
        return 'Карта';
      case 'TRANSFER':
        return 'Перевод';
      default:
        return method;
    }
  };

  const getPaidForName = (paidFor: string): string => {
    return paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы/Медали';
  };

  const docDefinition: any = {
    content: [
      {
        text: `Бухгалтерский отчет: ${eventName}`,
        style: 'header',
        margin: [0, 0, 0, 20],
      },
      {
        text: `Дата формирования: ${new Date().toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        style: 'subheader',
        margin: [0, 0, 0, 20],
      },
      // Сводная информация
      {
        text: 'Сводная информация',
        style: 'sectionHeader',
        margin: [0, 20, 0, 10],
      },
      {
        columns: [
          {
            width: '*',
            text: [
              { text: 'Общая сумма: ', bold: true },
              { text: formatCurrency(data.summary.totalAmount) },
            ],
          },
          {
            width: '*',
            text: [
              { text: 'Откаты: ', bold: true },
              { text: formatCurrency(data.summary.totalDiscount) },
            ],
          },
          {
            width: '*',
            text: [
              { text: 'После откатов: ', bold: true },
              { text: formatCurrency(data.summary.grandTotal) },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text: 'Выступления:',
        style: 'subsectionHeader',
        margin: [0, 10, 0, 5],
      },
      {
        columns: [
          {
            width: '*',
            text: `Наличные: ${formatCurrency(data.summary.performance.cash)}`,
          },
          {
            width: '*',
            text: `Карта: ${formatCurrency(data.summary.performance.card)}`,
          },
          {
            width: '*',
            text: `Перевод: ${formatCurrency(data.summary.performance.transfer)}`,
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text: 'Дипломы/Медали:',
        style: 'subsectionHeader',
        margin: [0, 10, 0, 5],
      },
      {
        columns: [
          {
            width: '*',
            text: `Наличные: ${formatCurrency(data.summary.diplomasMedals.cash)}`,
          },
          {
            width: '*',
            text: `Карта: ${formatCurrency(data.summary.diplomasMedals.card)}`,
          },
          {
            width: '*',
            text: `Перевод: ${formatCurrency(data.summary.diplomasMedals.transfer)}`,
          },
        ],
        margin: [0, 0, 0, 20],
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        alignment: 'center',
      },
      subheader: {
        fontSize: 10,
        alignment: 'center',
        color: '#666',
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5],
      },
      subsectionHeader: {
        fontSize: 12,
        bold: true,
        margin: [0, 5, 0, 3],
      },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
    },
  };

  // Добавление объединенных платежей
  const groupedEntries = Object.entries(data.grouped);
  if (groupedEntries.length > 0) {
    docDefinition.content.push({
      text: 'Объединенные платежи',
      style: 'sectionHeader',
      margin: [0, 20, 0, 10],
      pageBreak: 'before',
    });

    groupedEntries.forEach(([groupId, entries]) => {
      const groupEntries = Array.isArray(entries) ? entries : [];
      const totalAmount = groupEntries.reduce((sum, e) => sum + Number(e.amount), 0);
      const totalDiscount = groupEntries
        .filter((e) => e.paidFor === 'PERFORMANCE')
        .reduce((sum, e) => sum + Number(e.discountAmount), 0);

      docDefinition.content.push({
        text: `Группа: ${groupEntries[0]?.paymentGroupName || groupId.slice(0, 8)}`,
        style: 'subsectionHeader',
        margin: [0, 10, 0, 5],
      });

      docDefinition.content.push({
        text: `Всего: ${formatCurrency(totalAmount)} | Откат: ${formatCurrency(totalDiscount)}`,
        margin: [0, 0, 0, 5],
      });

      // Таблица записей группы
      const tableBody: any[] = [
        [
          { text: 'Дата', style: 'tableHeader' },
          { text: 'Коллектив', style: 'tableHeader' },
          { text: 'Название', style: 'tableHeader' },
          { text: 'Сумма', style: 'tableHeader' },
          { text: 'Откат', style: 'tableHeader' },
          { text: 'Способ', style: 'tableHeader' },
          { text: 'Категория', style: 'tableHeader' },
        ],
      ];

      groupEntries.forEach((entry) => {
        tableBody.push([
          formatDate(entry.createdAt),
          entry.collective?.name || '-',
          entry.registration?.danceName || '-',
          formatCurrency(entry.amount),
          formatCurrency(entry.discountAmount),
          getMethodName(entry.method),
          getPaidForName(entry.paidFor),
        ]);
      });

      docDefinition.content.push({
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*', '*', '*'],
          body: tableBody,
        },
        margin: [0, 0, 0, 15],
      });
    });
  }

  // Добавление одиночных выступлений
  const performanceEntries = data.ungrouped.filter((e) => e.paidFor === 'PERFORMANCE');
  if (performanceEntries.length > 0) {
    docDefinition.content.push({
      text: 'Одиночные выступления',
      style: 'sectionHeader',
      margin: [0, 20, 0, 10],
      pageBreak: groupedEntries.length > 0 ? 'before' : undefined,
    });

    const tableBody: any[] = [
      [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Откат', style: 'tableHeader' },
        { text: 'Способ', style: 'tableHeader' },
      ],
    ];

    performanceEntries.forEach((entry) => {
      tableBody.push([
        formatDate(entry.createdAt),
        entry.collective?.name || '-',
        entry.registration?.danceName || '-',
        formatCurrency(entry.amount),
        formatCurrency(entry.discountAmount),
        getMethodName(entry.method),
      ]);
    });

    docDefinition.content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*', '*', '*'],
        body: tableBody,
      },
      margin: [0, 0, 0, 15],
    });
  }

  // Добавление одиночных дипломов/медалей
  const diplomasEntries = data.ungrouped.filter((e) => e.paidFor === 'DIPLOMAS_MEDALS');
  if (diplomasEntries.length > 0) {
    docDefinition.content.push({
      text: 'Одиночные дипломы/медали',
      style: 'sectionHeader',
      margin: [0, 20, 0, 10],
      pageBreak: performanceEntries.length > 0 ? 'before' : undefined,
    });

    const tableBody: any[] = [
      [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Способ', style: 'tableHeader' },
      ],
    ];

    diplomasEntries.forEach((entry) => {
      tableBody.push([
        formatDate(entry.createdAt),
        entry.collective?.name || '-',
        entry.registration?.danceName || '-',
        formatCurrency(entry.amount),
        getMethodName(entry.method),
      ]);
    });

    docDefinition.content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*', '*'],
        body: tableBody,
      },
      margin: [0, 0, 0, 15],
    });
  }

  // Генерация PDF
  pdfMake.createPdf(docDefinition).download(`accounting_${eventId}_${Date.now()}.pdf`);
};


