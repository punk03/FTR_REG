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
    
    pdfMakeInstance = pdfMakeModule.default || pdfMakeModule;
    const pdfFonts = pdfFontsModule.default || pdfFontsModule;

    // Инициализация шрифтов - проверяем различные варианты структуры
    let vfs: any = null;
    
    if (pdfFonts) {
      // Вариант 1: pdfFonts.pdfMake.vfs (стандартный способ)
      if (pdfFonts.pdfMake?.vfs) {
        vfs = pdfFonts.pdfMake.vfs;
      }
      // Вариант 2: pdfFonts.vfs напрямую
      else if (pdfFonts.vfs) {
        vfs = pdfFonts.vfs;
      }
      // Вариант 3: весь pdfFonts это vfs объект
      else if (typeof pdfFonts === 'object' && pdfFonts !== null && !pdfFonts.pdfMake && !pdfFonts.vfs) {
        // Проверяем, является ли это объектом vfs (содержит ключи типа 'Roboto-Regular.ttf')
        const keys = Object.keys(pdfFonts);
        if (keys.length > 0 && keys.some(key => key.includes('.ttf') || key.includes('Roboto'))) {
          vfs = pdfFonts;
        }
      }
    }

    if (vfs && typeof vfs === 'object' && Object.keys(vfs).length > 0) {
      pdfMakeInstance.vfs = vfs;
      console.log('PDF fonts loaded successfully, vfs keys:', Object.keys(vfs).length);
    } else {
      console.warn('PDF fonts module structure is unexpected:', {
        pdfFontsType: typeof pdfFonts,
        pdfFontsKeys: pdfFonts ? Object.keys(pdfFonts) : null,
        hasPdfMake: pdfFonts?.pdfMake ? true : false,
        hasVfs: pdfFonts?.vfs ? true : false,
      });
      // Создаем минимальный vfs объект для работы pdfmake
      pdfMakeInstance.vfs = pdfMakeInstance.vfs || {};
      console.warn('Continuing with empty vfs - pdfmake may use default fonts');
    }

    fontsInitialized = true;
    return pdfMakeInstance;
  } catch (error) {
    console.error('Failed to initialize pdfmake:', error);
    console.error('Error details:', error);
    throw new Error('Не удалось загрузить библиотеку для создания PDF. Пожалуйста, обновите страницу.');
  }
};

interface AccountingEntry {
  id: number;
  createdAt: string;
  amount: number | string | null | undefined;
  discountAmount: number | string | null | undefined;
  method: 'CASH' | 'CARD' | 'TRANSFER';
  paidFor: 'PERFORMANCE' | 'DIPLOMAS_MEDALS';
  collective?: { name: string };
  registration?: { 
    id?: number;
    danceName?: string;
    blockNumber?: number;
    number?: number;
    diplomasCount?: number;
    medalsCount?: number;
    diplomasList?: string | null;
  };
  paymentGroupName?: string;
}

interface AccountingData {
  summary: {
    totalAmount: number | string | null | undefined;
    totalDiscount: number | string | null | undefined;
    grandTotal: number | string | null | undefined;
    performance: {
      cash: number | string | null | undefined;
      card: number | string | null | undefined;
      transfer: number | string | null | undefined;
    };
    diplomasMedals: {
      cash: number | string | null | undefined;
      card: number | string | null | undefined;
      transfer: number | string | null | undefined;
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
  
  // Проверяем, что pdfmake инициализирован
  if (!pdfMake || typeof pdfMake.createPdf !== 'function') {
    console.error('PDFMake not initialized properly');
    throw new Error('Не удалось инициализировать библиотеку для создания PDF. Пожалуйста, обновите страницу.');
  }

  const formatCurrency = (amount: number | string | null | undefined): string => {
    const numAmount = typeof amount === 'number' ? amount : (typeof amount === 'string' ? parseFloat(amount) : 0);
    if (isNaN(numAmount)) {
      return '0.00 ₽';
    }
    return `${numAmount.toFixed(2)} ₽`;
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

  // Вычисляем реальные значения для проверки отката
  const totalDiscountValue = typeof data.summary.totalDiscount === 'number' 
    ? data.summary.totalDiscount 
    : parseFloat(String(data.summary.totalDiscount || 0));
  const hasDiscount = !isNaN(totalDiscountValue) && totalDiscountValue > 0;

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        text: `Бухгалтерский отчет: ${eventName}`,
        style: 'header',
        margin: [0, 0, 0, 10],
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
        margin: [0, 0, 0, 15],
      },
      // Сводная информация
      {
        text: 'Сводная информация',
        style: 'sectionHeader',
        margin: [0, 10, 0, 8],
      },
      {
        columns: hasDiscount ? [
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
              { text: formatCurrency(data.summary.totalDiscount), color: 'red' },
            ],
          },
          {
            width: '*',
            text: [
              { text: 'После откатов: ', bold: true },
              { text: formatCurrency(data.summary.grandTotal) },
            ],
          },
        ] : [
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
              { text: 'Итого: ', bold: true },
              { text: formatCurrency(data.summary.grandTotal) },
            ],
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        text: 'Выступления:',
        style: 'subsectionHeader',
        margin: [0, 8, 0, 4],
      },
      {
        columns: [
          {
            width: '*',
            text: `Наличные: ${formatCurrency(data.summary.performance.cash)}`,
            fontSize: 9,
          },
          {
            width: '*',
            text: `Карта: ${formatCurrency(data.summary.performance.card)}`,
            fontSize: 9,
          },
          {
            width: '*',
            text: `Перевод: ${formatCurrency(data.summary.performance.transfer)}`,
            fontSize: 9,
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        text: 'Дипломы/Медали:',
        style: 'subsectionHeader',
        margin: [0, 8, 0, 4],
      },
      {
        columns: [
          {
            width: '*',
            text: `Наличные: ${formatCurrency(data.summary.diplomasMedals.cash)}`,
            fontSize: 9,
          },
          {
            width: '*',
            text: `Карта: ${formatCurrency(data.summary.diplomasMedals.card)}`,
            fontSize: 9,
          },
          {
            width: '*',
            text: `Перевод: ${formatCurrency(data.summary.diplomasMedals.transfer)}`,
            fontSize: 9,
          },
        ],
        margin: [0, 0, 0, 12],
      },
    ],
    styles: {
      header: {
        fontSize: 16,
        bold: true,
        alignment: 'center',
      },
      subheader: {
        fontSize: 9,
        alignment: 'center',
        color: '#666',
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        margin: [0, 8, 0, 4],
      },
      subsectionHeader: {
        fontSize: 10,
        bold: true,
        margin: [0, 4, 0, 2],
      },
      tableHeader: {
        bold: true,
        fontSize: 8,
        color: 'black',
        fillColor: '#f0f0f0',
      },
    },
    defaultStyle: {
      font: pdfMake.vfs && Object.keys(pdfMake.vfs).length > 0 ? 'Roboto' : 'Helvetica',
      fontSize: 8,
    },
  };

  // Добавление объединенных платежей
  const groupedEntries = Object.entries(data.grouped);
  if (groupedEntries.length > 0) {
    docDefinition.content.push({
      text: 'Объединенные платежи',
      style: 'sectionHeader',
      margin: [0, 12, 0, 8],
    });

    groupedEntries.forEach(([groupId, entries]) => {
      const groupEntries = Array.isArray(entries) ? entries : [];
      const totalAmount = groupEntries.reduce((sum, e) => {
        const amt = typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount || 0));
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0);
      const totalDiscount = groupEntries
        .filter((e) => e.paidFor === 'PERFORMANCE')
        .reduce((sum, e) => {
          const disc = typeof e.discountAmount === 'number' ? e.discountAmount : parseFloat(String(e.discountAmount || 0));
          return sum + (isNaN(disc) ? 0 : disc);
        }, 0);

      docDefinition.content.push({
        text: `Группа: ${groupEntries[0]?.paymentGroupName || groupId.slice(0, 8)}`,
        style: 'subsectionHeader',
        margin: [0, 8, 0, 4],
      });

      const groupHasDiscount = totalDiscount > 0;
      docDefinition.content.push({
        text: groupHasDiscount 
          ? `Всего: ${formatCurrency(totalAmount)} | Откат: ${formatCurrency(totalDiscount)}`
          : `Всего: ${formatCurrency(totalAmount)}`,
        fontSize: 8,
        margin: [0, 0, 0, 4],
      });

      // Таблица записей группы
      const tableBody: any[] = [
        groupHasDiscount ? [
          { text: 'Дата', style: 'tableHeader' },
          { text: 'Коллектив', style: 'tableHeader' },
          { text: 'Название', style: 'tableHeader' },
          { text: 'Сумма', style: 'tableHeader' },
          { text: 'Откат', style: 'tableHeader' },
          { text: 'Способ', style: 'tableHeader' },
          { text: 'Категория', style: 'tableHeader' },
        ] : [
          { text: 'Дата', style: 'tableHeader' },
          { text: 'Коллектив', style: 'tableHeader' },
          { text: 'Название', style: 'tableHeader' },
          { text: 'Сумма', style: 'tableHeader' },
          { text: 'Способ', style: 'tableHeader' },
          { text: 'Категория', style: 'tableHeader' },
        ],
      ];

      groupEntries.forEach((entry) => {
        const amount = typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount || 0));
        const discountAmount = typeof entry.discountAmount === 'number' ? entry.discountAmount : parseFloat(String(entry.discountAmount || 0));
        if (groupHasDiscount) {
          tableBody.push([
            formatDate(entry.createdAt),
            entry.collective?.name || '-',
            entry.registration?.danceName || '-',
            formatCurrency(amount),
            formatCurrency(discountAmount),
            getMethodName(entry.method),
            getPaidForName(entry.paidFor),
          ]);
        } else {
          tableBody.push([
            formatDate(entry.createdAt),
            entry.collective?.name || '-',
            entry.registration?.danceName || '-',
            formatCurrency(amount),
            getMethodName(entry.method),
            getPaidForName(entry.paidFor),
          ]);
        }
      });

      docDefinition.content.push({
        table: {
          headerRows: 1,
          widths: groupHasDiscount ? ['auto', '*', '*', 'auto', 'auto', 'auto', 'auto'] : ['auto', '*', '*', 'auto', 'auto', 'auto'],
          body: tableBody,
        },
        margin: [0, 0, 0, 10],
        layout: {
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      });
    });
  }

  // Добавление одиночных выступлений
  const performanceEntries = data.ungrouped.filter((e) => e.paidFor === 'PERFORMANCE');
  if (performanceEntries.length > 0) {
    docDefinition.content.push({
      text: 'Одиночные выступления',
      style: 'sectionHeader',
      margin: [0, 12, 0, 8],
    });

    const performanceHasDiscount = performanceEntries.some(e => {
      const disc = typeof e.discountAmount === 'number' ? e.discountAmount : parseFloat(String(e.discountAmount || 0));
      return !isNaN(disc) && disc > 0;
    });

    const tableBody: any[] = [
      performanceHasDiscount ? [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Откат', style: 'tableHeader' },
        { text: 'Способ', style: 'tableHeader' },
      ] : [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Способ', style: 'tableHeader' },
      ],
    ];

    performanceEntries.forEach((entry) => {
      const amount = typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount || 0));
      const discountAmount = typeof entry.discountAmount === 'number' ? entry.discountAmount : parseFloat(String(entry.discountAmount || 0));
      if (performanceHasDiscount) {
        tableBody.push([
          formatDate(entry.createdAt),
          entry.collective?.name || '-',
          entry.registration?.danceName || '-',
          formatCurrency(amount),
          formatCurrency(discountAmount),
          getMethodName(entry.method),
        ]);
      } else {
        tableBody.push([
          formatDate(entry.createdAt),
          entry.collective?.name || '-',
          entry.registration?.danceName || '-',
          formatCurrency(amount),
          getMethodName(entry.method),
        ]);
      }
    });

    docDefinition.content.push({
      table: {
        headerRows: 1,
        widths: performanceHasDiscount ? ['auto', '*', '*', 'auto', 'auto', 'auto'] : ['auto', '*', '*', 'auto', 'auto'],
        body: tableBody,
      },
      margin: [0, 0, 0, 10],
      layout: {
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
    });
  }

  // Добавление одиночных дипломов/медалей
  const diplomasEntries = data.ungrouped.filter((e) => e.paidFor === 'DIPLOMAS_MEDALS');
  if (diplomasEntries.length > 0) {
    docDefinition.content.push({
      text: 'Одиночные дипломы/медали',
      style: 'sectionHeader',
      margin: [0, 12, 0, 8],
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
      const amount = typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount || 0));
      tableBody.push([
        formatDate(entry.createdAt),
        entry.collective?.name || '-',
        entry.registration?.danceName || '-',
        formatCurrency(amount),
        getMethodName(entry.method),
      ]);
    });

    docDefinition.content.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', '*', 'auto', 'auto'],
        body: tableBody,
      },
      margin: [0, 0, 0, 10],
      layout: {
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
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
  
  // Проверяем, что pdfmake инициализирован
  if (!pdfMake || typeof pdfMake.createPdf !== 'function') {
    console.error('PDFMake not initialized properly');
    throw new Error('Не удалось инициализировать библиотеку для создания PDF. Пожалуйста, обновите страницу.');
  }

  const formatCurrency = (amount: number | string | null | undefined): string => {
    const numAmount = typeof amount === 'number' ? amount : (typeof amount === 'string' ? parseFloat(amount) : 0);
    if (isNaN(numAmount)) {
      return '0.00 ₽';
    }
    return `${numAmount.toFixed(2)} ₽`;
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
  const totalAmount = entries.reduce((sum, e) => {
    const amt = typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount || 0));
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);
  const totalDiscount = entries
    .filter((e) => e.paidFor === 'PERFORMANCE')
    .reduce((sum, e) => {
      const disc = typeof e.discountAmount === 'number' ? e.discountAmount : parseFloat(String(e.discountAmount || 0));
      return sum + (isNaN(disc) ? 0 : disc);
    }, 0);
  const totalBeforeDiscount = totalAmount + totalDiscount;

  const byMethod = {
    cash: entries.filter((e) => e.method === 'CASH').reduce((sum, e) => {
      const amt = typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount || 0));
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0),
    card: entries.filter((e) => e.method === 'CARD').reduce((sum, e) => {
      const amt = typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount || 0));
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0),
    transfer: entries.filter((e) => e.method === 'TRANSFER').reduce((sum, e) => {
      const amt = typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount || 0));
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0),
  };

  const performanceEntries = entries.filter((e) => e.paidFor === 'PERFORMANCE');
  const diplomasEntries = entries.filter((e) => e.paidFor === 'DIPLOMAS_MEDALS');
  
  const hasDiscount = !isNaN(totalDiscount) && totalDiscount > 0;

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        text: 'ВЫПИСКА ПО ОПЛАТЕ',
        style: 'header',
        margin: [0, 0, 0, 8],
      },
      {
        text: `Мероприятие: ${eventName}`,
        style: 'subheader',
        margin: [0, 0, 0, 4],
      },
      {
        text: paymentGroupName 
          ? `Группа платежей: ${paymentGroupName}`
          : 'Одиночная оплата',
        style: 'subheader',
        margin: [0, 0, 0, 15],
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
        margin: [0, 0, 0, 15],
      },
      // Итоговая информация
      {
        text: 'Итоговая информация',
        style: 'sectionHeader',
        margin: [0, 12, 0, 8],
      },
      {
        columns: hasDiscount ? [
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
              { text: formatCurrency(totalDiscount), color: 'red' },
            ],
          },
          {
            width: '*',
            text: [
              { text: 'Итого к оплате: ', bold: true },
              { text: formatCurrency(totalAmount), fontSize: 11 },
            ],
          },
        ] : [
          {
            width: '*',
            text: [
              { text: 'Итого к оплате: ', bold: true },
              { text: formatCurrency(totalAmount), fontSize: 11 },
            ],
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        text: 'Распределение по способам оплаты:',
        style: 'subsectionHeader',
        margin: [0, 8, 0, 4],
      },
      {
        columns: [
          {
            width: '*',
            text: `Наличные: ${formatCurrency(byMethod.cash)}`,
            fontSize: 9,
          },
          {
            width: '*',
            text: `Карта: ${formatCurrency(byMethod.card)}`,
            fontSize: 9,
          },
          {
            width: '*',
            text: `Перевод: ${formatCurrency(byMethod.transfer)}`,
            fontSize: 9,
          },
        ],
        margin: [0, 0, 0, 12],
      },
    ],
    styles: {
      header: {
        fontSize: 16,
        bold: true,
        alignment: 'center',
      },
      subheader: {
        fontSize: 9,
        alignment: 'center',
        color: '#666',
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        margin: [0, 8, 0, 4],
      },
      subsectionHeader: {
        fontSize: 10,
        bold: true,
        margin: [0, 4, 0, 2],
      },
      tableHeader: {
        bold: true,
        fontSize: 8,
        color: 'black',
        fillColor: '#f0f0f0',
      },
    },
    defaultStyle: {
      font: pdfMake.vfs && Object.keys(pdfMake.vfs).length > 0 ? 'Roboto' : 'Helvetica',
      fontSize: 8,
    },
  };

  // Добавление таблицы выступлений
  if (performanceEntries.length > 0) {
    docDefinition.content.push({
      text: 'Выступления',
      style: 'sectionHeader',
      margin: [0, 12, 0, 8],
    });

    const performanceHasDiscount = performanceEntries.some(e => {
      const disc = typeof e.discountAmount === 'number' ? e.discountAmount : parseFloat(String(e.discountAmount || 0));
      return !isNaN(disc) && disc > 0;
    });

    const tableBody: any[] = [
      performanceHasDiscount ? [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Откат', style: 'tableHeader' },
        { text: 'Способ', style: 'tableHeader' },
      ] : [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Способ', style: 'tableHeader' },
      ],
    ];

    performanceEntries.forEach((entry) => {
      const reg = entry.registration as any;
      const amount = typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount || 0));
      const discountAmount = typeof entry.discountAmount === 'number' ? entry.discountAmount : parseFloat(String(entry.discountAmount || 0));
      
      if (performanceHasDiscount) {
        tableBody.push([
          formatDate(entry.createdAt),
          entry.collective?.name || '-',
          reg?.danceName || '-',
          formatCurrency(amount),
          formatCurrency(discountAmount),
          getMethodName(entry.method),
        ]);
      } else {
        tableBody.push([
          formatDate(entry.createdAt),
          entry.collective?.name || '-',
          reg?.danceName || '-',
          formatCurrency(amount),
          getMethodName(entry.method),
        ]);
      }
    });

      docDefinition.content.push({
      table: {
        headerRows: 1,
        widths: performanceHasDiscount ? ['auto', '*', '*', 'auto', 'auto', 'auto'] : ['auto', '*', '*', 'auto', 'auto'],
        body: tableBody,
      },
      margin: [0, 0, 0, 10],
      layout: {
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
    });
  }

  // Добавление таблицы дипломов/медалей
  if (diplomasEntries.length > 0) {
    docDefinition.content.push({
      text: 'Дипломы и медали',
      style: 'sectionHeader',
      margin: [0, 12, 0, 8],
    });

    const tableBody: any[] = [
      [
        { text: 'Дата', style: 'tableHeader' },
        { text: 'Коллектив', style: 'tableHeader' },
        { text: 'Название', style: 'tableHeader' },
        { text: 'Дипломы (кол-во)', style: 'tableHeader' },
        { text: 'Медали (кол-во)', style: 'tableHeader' },
        { text: 'ФИО на дипломы', style: 'tableHeader' },
        { text: 'Сумма', style: 'tableHeader' },
        { text: 'Способ', style: 'tableHeader' },
      ],
    ];

    diplomasEntries.forEach((entry) => {
      const reg = entry.registration as any;
      const amount = typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount || 0));
      const diplomasCount = reg?.diplomasCount || 0;
      const medalsCount = reg?.medalsCount || 0;
      const diplomasList = reg?.diplomasList || null;
      
      // Форматируем ФИО на дипломы - каждое ФИО на отдельной строке в ячейке
      let formattedDiplomasList: any = '';
      if (diplomasList && typeof diplomasList === 'string' && diplomasList.trim()) {
        const fioLines = diplomasList.split('\n').filter((line: string) => line.trim());
        if (fioLines.length > 0) {
          // Используем stack для многострочного текста в ячейке
          formattedDiplomasList = {
            stack: fioLines.map((line: string) => ({
              text: line.trim(),
              fontSize: 7,
            })),
            lineHeight: 1.2,
          };
        }
      }
      
      tableBody.push([
        formatDate(entry.createdAt),
        entry.collective?.name || '-',
        reg?.danceName || '-',
        diplomasCount > 0 ? String(diplomasCount) : '',
        medalsCount > 0 ? String(medalsCount) : '',
        formattedDiplomasList || '',
        formatCurrency(amount),
        getMethodName(entry.method),
      ]);
    });

    docDefinition.content.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', '*', 'auto', 'auto', '*', 'auto', 'auto'],
        body: tableBody,
      },
      margin: [0, 0, 0, 10],
      layout: {
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
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

