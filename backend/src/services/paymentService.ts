import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// PaymentStatus enum from Prisma schema
type PaymentStatus = 'UNPAID' | 'PERFORMANCE_PAID' | 'DIPLOMAS_PAID' | 'PAID';

const prisma = new PrismaClient();

/**
 * Recalculate payment status for a registration
 */
export const recalculateRegistrationPaymentStatus = async (registrationId: number): Promise<void> => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      event: true,
      nomination: true,
    },
  });

  if (!registration) {
    return;
  }

  // Get all non-deleted accounting entries
  const entries = await prisma.accountingEntry.findMany({
    where: {
      registrationId,
      deletedAt: null,
    },
  });

  // Calculate paid amounts by category
  let performancePaid = 0;
  let diplomasAndMedalsPaid = 0;

  for (const entry of entries) {
    if (entry.paidFor === 'PERFORMANCE') {
      performancePaid += Number(entry.amount);
    } else if (entry.paidFor === 'DIPLOMAS_MEDALS') {
      diplomasAndMedalsPaid += Number(entry.amount);
    }
  }

  // Calculate required amounts
  // Performance price
  const eventPrice = await prisma.eventPrice.findUnique({
    where: {
      eventId_nominationId: {
        eventId: registration.eventId,
        nominationId: registration.nominationId,
      },
    },
  });

  let performanceRequired = 0;
  if (eventPrice) {
    const regularCount = Math.max(0, registration.participantsCount - registration.federationParticipantsCount);
    const regularPrice = Number(eventPrice.pricePerParticipant) * regularCount;
    const federationPrice =
      Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant) *
      registration.federationParticipantsCount;
    performanceRequired = regularPrice + federationPrice;
  }

  // Diplomas and medals price
  const diplomasPrice = registration.event.pricePerDiploma
    ? Number(registration.event.pricePerDiploma) * registration.diplomasCount
    : 0;
  const medalsPrice = registration.event.pricePerMedal ? Number(registration.event.pricePerMedal) * registration.medalsCount : 0;
  const diplomasAndMedalsRequired = diplomasPrice + medalsPrice;

  // Determine statuses
  const performancePaidStatus = Math.abs(performancePaid - performanceRequired) < 0.01;
  const diplomasAndMedalsPaidStatus = Math.abs(diplomasAndMedalsPaid - diplomasAndMedalsRequired) < 0.01;

  // Check if registration has diplomas or medals
  const hasDiplomasOrMedals = (registration.diplomasCount > 0) || (registration.medalsCount > 0);

  // Determine overall status according to new rules:
  // - PAID (green): has diplomas/medals AND everything is paid
  // - PERFORMANCE_PAID (yellow): performance paid BUT has unpaid diplomas/medals
  // - DIPLOMAS_PAID (yellow): diplomas/medals paid BUT performance not paid
  // - UNPAID (red): nothing is paid
  let paymentStatus: PaymentStatus = 'UNPAID';
  
  if (performancePaidStatus && diplomasAndMedalsPaidStatus) {
    // Everything is paid
    if (hasDiplomasOrMedals) {
      paymentStatus = 'PAID'; // Green: has diplomas/medals AND everything paid
    } else {
      // No diplomas/medals, but everything that exists is paid
      paymentStatus = 'PAID';
    }
  } else if (performancePaidStatus && !diplomasAndMedalsPaidStatus) {
    // Performance paid, but diplomas/medals not paid
    if (hasDiplomasOrMedals) {
      paymentStatus = 'PERFORMANCE_PAID'; // Yellow: performance paid BUT has unpaid diplomas/medals
    } else {
      // No diplomas/medals, performance paid
      paymentStatus = 'PERFORMANCE_PAID';
    }
  } else if (!performancePaidStatus && diplomasAndMedalsPaidStatus) {
    // Diplomas/medals paid, but performance not paid
    paymentStatus = 'DIPLOMAS_PAID'; // Yellow: diplomas/medals paid BUT performance not paid
  } else {
    // Nothing is paid
    paymentStatus = 'UNPAID'; // Red: nothing is paid
  }

  // Update registration
  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      paymentStatus,
      performancePaid: performancePaidStatus,
      diplomasAndMedalsPaid: diplomasAndMedalsPaidStatus,
      paidAmount: performancePaid + diplomasAndMedalsPaid,
    },
  });
};

/**
 * Calculate discount from total amount based on discount tiers
 */
export const calculateDiscount = (totalAmount: number, discountTiersJson: string | null): { discountAmount: number; discountPercent: number } => {
  if (!discountTiersJson) {
    return { discountAmount: 0, discountPercent: 0 };
  }

  try {
    const tiers = JSON.parse(discountTiersJson);
    if (!Array.isArray(tiers)) {
      return { discountAmount: 0, discountPercent: 0 };
    }

    for (const tier of tiers) {
      if (totalAmount >= tier.minAmount && totalAmount <= tier.maxAmount) {
        const discountAmount = (totalAmount * tier.percentage) / 100;
        return { discountAmount, discountPercent: tier.percentage };
      }
    }

    return { discountAmount: 0, discountPercent: 0 };
  } catch (error) {
    console.error('Error parsing discount tiers:', error);
    return { discountAmount: 0, discountPercent: 0 };
  }
};

/**
 * Generate payment group ID
 */
export const generatePaymentGroupId = (): string => {
  return uuidv4();
};


