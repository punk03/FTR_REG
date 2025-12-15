import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function generateCalculatorTokens() {
  try {
    // Получаем все события без токена калькулятора
    const eventsWithoutToken = await prisma.event.findMany({
      where: {
        calculatorToken: null,
      },
    });

    console.log(`Found ${eventsWithoutToken.length} events without calculator token`);

    // Генерируем токены для каждого события
    for (const event of eventsWithoutToken) {
      const token = uuidv4();
      await prisma.event.update({
        where: { id: event.id },
        data: { calculatorToken: token },
      });
      console.log(`Generated token for event "${event.name}" (ID: ${event.id}): ${token}`);
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error generating calculator tokens:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generateCalculatorTokens();

