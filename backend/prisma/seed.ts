import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create disciplines (47 items)
  const disciplines = [
    'Jazz',
    'Street dance show',
    'Contemporary',
    'Hip-Hop',
    'House',
    'Waacking',
    'Vogue',
    'Locking',
    'Popping',
    'Breaking',
    'Dancehall',
    'Afro',
    'Krump',
    'Experimental',
    'Show',
    'Театр танца',
    'Классический танец',
    'Народный танец',
    'Бальный танец',
    'Современный танец',
    'Эстрадный танец',
    'Детский танец',
    'Спортивный танец',
    'Акробатический танец',
    'Цирковой танец',
    'Пантомима',
    'Пластика',
    'Движение',
    'Перформанс',
    'Инсталляция',
    'Видео-арт',
    'Мультимедиа',
    'Интерактивный танец',
    'Сайт-специфик',
    'Импровизация',
    'Контактная импровизация',
    'Композиция',
    'Хореография',
    'Режиссура',
    'Сценография',
    'Музыка',
    'Звук',
    'Свет',
    'Костюм',
    'Грим',
    'Техника',
    'Теория',
  ];

  console.log('Creating disciplines...');
  for (const name of disciplines) {
    await prisma.discipline.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create nominations (7 items)
  const nominations = [
    'Соло',
    'Дуэт/Пара',
    'Трио',
    'Квартет',
    'Малая группа',
    'Формейшн',
    'Продакшн',
  ];

  console.log('Creating nominations...');
  for (const name of nominations) {
    await prisma.nomination.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create ages (8 items)
  const ages = [
    'Бэби',
    'Мини 1',
    'Мини 2',
    'Дети',
    'Ювеналы 1',
    'Ювеналы 2',
    'Юниоры',
    'Взрослые',
    'Смешанная',
  ];

  console.log('Creating ages...');
  for (const name of ages) {
    await prisma.age.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create categories (3 items)
  const categories = ['Beginners', 'Basic', 'Advanced'];

  console.log('Creating categories...');
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Hash password function
  const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, 10);
  };

  // Create demo users
  console.log('Creating demo users...');
  const adminPassword = await hashPassword('admin123');
  const registrarPassword = await hashPassword('registrar123');
  const accountantPassword = await hashPassword('accountant123');
  const statisticianPassword = await hashPassword('statistician123');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ftr.ru' },
    update: {},
    create: {
      name: 'Администратор',
      email: 'admin@ftr.ru',
      password: adminPassword,
      role: 'ADMIN',
      city: 'Москва',
      phone: '+7 (999) 123-45-67',
    },
  });

  const registrar = await prisma.user.upsert({
    where: { email: 'registrar@ftr.ru' },
    update: {},
    create: {
      name: 'Регистратор',
      email: 'registrar@ftr.ru',
      password: registrarPassword,
      role: 'REGISTRATOR',
      city: 'Москва',
      phone: '+7 (999) 123-45-68',
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@ftr.ru' },
    update: {},
    create: {
      name: 'Бухгалтер',
      email: 'accountant@ftr.ru',
      password: accountantPassword,
      role: 'ACCOUNTANT',
      city: 'Москва',
      phone: '+7 (999) 123-45-69',
    },
  });

  const statistician = await prisma.user.upsert({
    where: { email: 'statistician@ftr.ru' },
    update: {},
    create: {
      name: 'Статистик',
      email: 'statistician@ftr.ru',
      password: statisticianPassword,
      role: 'STATISTICIAN',
      city: 'Москва',
      phone: '+7 (999) 123-45-70',
    },
  });

  // Create test event
  console.log('Creating test event...');
  const discountTiers = JSON.stringify([
    { minAmount: 0, maxAmount: 9999, percentage: 0 },
    { minAmount: 10000, maxAmount: 30999, percentage: 10 },
    { minAmount: 31000, maxAmount: 50999, percentage: 15 },
    { minAmount: 51000, maxAmount: 70999, percentage: 20 },
    { minAmount: 71000, maxAmount: 140999, percentage: 25 },
    { minAmount: 141000, maxAmount: 999999999, percentage: 30 },
  ]);

  const testEvent = await prisma.event.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Тестовое мероприятие 2025',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-03'),
      description: 'Тестовое мероприятие для демонстрации системы',
      status: 'ACTIVE',
      isOnline: false,
      paymentEnable: true,
      categoryEnable: true,
      songEnable: false,
      durationMax: 43200,
      pricePerDiploma: 100,
      pricePerMedal: 50,
      discountTiers,
    },
  });

  // Create event prices
  console.log('Creating event prices...');
  const nominationIds = await prisma.nomination.findMany({
    select: { id: true, name: true },
  });

  for (const nomination of nominationIds) {
    await prisma.eventPrice.upsert({
      where: {
        eventId_nominationId: {
          eventId: testEvent.id,
          nominationId: nomination.id,
        },
      },
      update: {},
      create: {
        eventId: testEvent.id,
        nominationId: nomination.id,
        pricePerParticipant: 500,
        pricePerFederationParticipant: 400,
      },
    });
  }

  // Create system settings
  console.log('Creating system settings...');
  await prisma.systemSetting.upsert({
    where: { key: 'diploma_cancel_timeout_minutes' },
    update: {},
    create: {
      key: 'diploma_cancel_timeout_minutes',
      value: '5',
      description: 'Время в минутах, в течение которого REGISTRATOR может отменить оплату дипломов',
    },
  });

  console.log('Seed completed successfully!');
  console.log('\nDemo accounts:');
  console.log('ADMIN: admin@ftr.ru / admin123');
  console.log('REGISTRATOR: registrar@ftr.ru / registrar123');
  console.log('ACCOUNTANT: accountant@ftr.ru / accountant123');
  console.log('STATISTICIAN: statistician@ftr.ru / statistician123');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


