import { formatRegistrationNumber } from './format';

// Ленивая загрузка pdfmake - импортируем только при вызове функции
let pdfMakeInstance: any = null;
let fontsInitialized = false;

const initializePdfMake = async () => {
  if (fontsInitialized && pdfMakeInstance) {
    return pdfMakeInstance;
  }

  try {
    // Динамический импорт для избежания ошибок при загрузке модуля
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    
    pdfMakeInstance = pdfMakeModule.default;
    const pdfFonts = pdfFontsModule.default;

    // Инициализация шрифтов
    if (pdfFonts) {
      if (pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) {
        pdfMakeInstance.vfs = pdfFonts.pdfMake.vfs;
      } else if ((pdfFonts as any).vfs) {
        pdfMakeInstance.vfs = (pdfFonts as any).vfs;
      } else if ((pdfFonts as any).pdfMake) {
        pdfMakeInstance.vfs = (pdfFonts as any).pdfMake.vfs || {};
      } else {
        pdfMakeInstance.vfs = {};
      }
    } else {
      pdfMakeInstance.vfs = {};
    }

    fontsInitialized = true;
    return pdfMakeInstance;
  } catch (error) {
    console.error('Failed to initialize pdfmake:', error);
    throw new Error('Не удалось загрузить библиотеку для создания PDF. Пожалуйста, обновите страницу.');
  }
};

interface AccountingEntry {
  id: number;
  createdAt: string;
  amount: number;
  discountAmount: number;
  method: 'CASH' | 'CARD' | 'TRANSFER';
  paidFor: 'PERFORMANCE' | 'DIPLOMAS_MEDALS';
  collective?: { name: string };
  registration?: { 
    id?: number;
    danceName?: string;
    blockNumber?: number;
    number?: number;
  };
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
  try {
    pdfMake.createPdf(docDefinition).download(`accounting_${eventId}_${Date.now()}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Ошибка при создании PDF файла. Проверьте консоль для деталей.');
  }
};

// Функция для генерации выписки по конкретной оплате (группе платежей или отдельной записи)
export const generatePaymentStatement = async (
  entries: AccountingEntry[],
  eventName: string,
  paymentGroupName?: string
): Promise<void> => {
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
      hour: '2-digit',
      minute: '2-digit',
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

  // Подсчет итогов
  const totalAmount = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalDiscount = entries
    .filter((e) => e.paidFor === 'PERFORMANCE')
    .reduce((sum, e) => sum + Number(e.discountAmount), 0);
  const totalBeforeDiscount = totalAmount + totalDiscount;

  const byMethod = {
    cash: entries.filter((e) => e.method === 'CASH').reduce((sum, e) => sum + Number(e.amount), 0),
    card: entries.filter((e) => e.method === 'CARD').reduce((sum, e) => sum + Number(e.amount), 0),
    transfer: entries.filter((e) => e.method === 'TRANSFER').reduce((sum, e) => sum + Number(e.amount), 0),
  };

  const performanceEntries = entries.filter((e) => e.paidFor === 'PERFORMANCE');
  const diplomasEntries = entries.filter((e) => e.paidFor === 'DIPLOMAS_MEDALS');

  const docDefinition: any = {
    content: [
      {
        text: 'ВЫПИСКА ПО ОПЛАТЕ',
        style: 'header',
        margin: [0, 0, 0, 10],
      },
      {
        text: `Мероприятие: ${eventName}`,
        style: 'subheader',
        margin: [0, 0, 0, 5],
      },
      {
        text: paymentGroupName 
          ? `Группа платежей: ${paymentGroupName}`
          : 'Одиночная оплата',
        style: 'subheader',
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
      // Итоговая информация
      {
        text: 'Итоговая информация',
        style: 'sectionHeader',
        margin: [0, 20, 0, 10],
      },
      {
        columns: [
          {
            width: '*',
            text: [
              { text: 'Сумма до отката: ', bold: true },
              { text: formatCurrency(totalBeforeDiscount) },
            ],
          },
          {
            width: '*',
            text: [
              { text: 'Сумма отката: ', bold: true },
              { text: formatCurrency(totalDiscount), color: totalDiscount > 0 ? 'red' : 'black' },
            ],
          },
          {
            width: '*',
            text: [
              { text: 'Итого к оплате: ', bold: true },
              { text: formatCurrency(totalAmount), fontSize: 12 },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text: 'Распределение по способам оплаты:',
        style: 'subsectionHeader',
        margin: [0, 10, 0, 5],
      },
      {
        columns: [
          {
            width: '*',
            text: `Наличные: ${formatCurrency(byMethod.cash)}`,
          },
          {
            width: '*',
            text: `Карта: ${formatCurrency(byMethod.card)}`,
          },
          {
            width: '*',
            text: `Перевод: ${formatCurrency(byMethod.transfer)}`,
          },
        ],
        margin: [0, 0, 0, 20],
      },
    ],
    styles: {
      header: {
        fontSize: 20,
        bold: true,
        alignment: 'center',
      },
      subheader: {
        fontSize: 11,
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
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: 'black',
        fillColor: '#f0f0f0',
      },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
    },
  };

  // Добавление таблицы выступлений
  if (performanceEntries.length > 0) {
    docDefinition.content.push({
      text: 'Выступления',
      style: 'sectionHeader',
      margin: [0, 20, 0, 10],
      pageBreak: 'before',
    });

    const tableBody: any[] = [
      [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Номер', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название номера', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Откат', style: 'tableHeader' },
        { text: 'Способ оплаты', style: 'tableHeader' },
      ],
    ];

    performanceEntries.forEach((entry) => {
      const reg = entry.registration as any;
      const regNumber = formatRegistrationNumber(reg || {});
      
      tableBody.push([
        formatDate(entry.createdAt),
        regNumber,
        entry.collective?.name || '-',
        reg?.danceName || '-',
        formatCurrency(entry.amount),
        formatCurrency(entry.discountAmount),
        getMethodName(entry.method),
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
  }

  // Добавление таблицы дипломов/медалей
  if (diplomasEntries.length > 0) {
    docDefinition.content.push({
      text: 'Дипломы и медали',
      style: 'sectionHeader',
      margin: [0, 20, 0, 10],
      pageBreak: performanceEntries.length > 0 ? 'before' : undefined,
    });

    const tableBody: any[] = [
      [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Номер', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название номера', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Способ оплаты', style: 'tableHeader' },
      ],
    ];

    diplomasEntries.forEach((entry) => {
      const reg = entry.registration as any;
      const regNumber = formatRegistrationNumber(reg || {});
      
      tableBody.push([
        formatDate(entry.createdAt),
        regNumber,
        entry.collective?.name || '-',
        reg?.danceName || '-',
        formatCurrency(entry.amount),
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

  // Генерация PDF
  try {
    const fileName = paymentGroupName
      ? `payment_statement_${paymentGroupName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`
      : `payment_statement_${entries[0]?.id || Date.now()}.pdf`;
    pdfMake.createPdf(docDefinition).download(fileName);
  } catch (error) {
    console.error('Error generating payment statement PDF:', error);
    throw new Error('Ошибка при создании выписки. Проверьте консоль для деталей.');
  }
};