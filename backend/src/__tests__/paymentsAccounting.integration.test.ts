import request from 'supertest';
import app from '../index';

/**
 * Integration tests for payments creation and accounting logic.
 *
 * NOTE:
 * - Tests rely on seed data:
 *   - Event with id=1 exists and is ACTIVE.
 *   - Discount tiers are configured as in prisma/seed.ts.
 *   - Event prices exist for all nominations with pricePerParticipant=500, pricePerFederationParticipant=400.
 */

describe('Payments and accounting integration', () => {
  const adminCredentials = {
    email: 'admin@ftr.ru',
    password: 'admin123',
  };

  async function loginAndGetToken(): Promise<string> {
    const res = await request(app).post('/api/auth/login').send(adminCredentials);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    return res.body.accessToken as string;
  }

  it('creates grouped performance payment with discount and proper accounting entries', async () => {
    const token = await loginAndGetToken();

    // 1) Find a nomination suitable for many participants (Формейшн: 8–24 участников)
    const nominationsRes = await request(app)
      .get('/api/reference/nominations')
      .set('Authorization', `Bearer ${token}`);
    expect(nominationsRes.status).toBe(200);

    const formationNomination = (nominationsRes.body as any[]).find((n) =>
      String(n.name).toLowerCase().includes('формейшн')
    );
    expect(formationNomination).toBeDefined();

    const nominationId = formationNomination.id as number;

    // 2) Take any discipline and age from reference
    const disciplinesRes = await request(app)
      .get('/api/reference/disciplines')
      .set('Authorization', `Bearer ${token}`);
    expect(disciplinesRes.status).toBe(200);
    const disciplineId = (disciplinesRes.body as any[])[0].id as number;

    const agesRes = await request(app)
      .get('/api/reference/ages')
      .set('Authorization', `Bearer ${token}`);
    expect(agesRes.status).toBe(200);
    const ageId = (agesRes.body as any[])[0].id as number;

    // 3) Create two registrations with participantsCount=20 each (valid for Формейшн)
    const createReg = async (collectiveName: string) => {
      const res = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: 1,
          collectiveName,
          disciplineId,
          nominationId,
          ageId,
          participantsCount: 20,
          federationParticipantsCount: 0,
          agreement: true,
          agreement2: true,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      return res.body.id as number;
    };

    const regId1 = await createReg('Интеграционный коллектив 1');
    const regId2 = await createReg('Интеграционный коллектив 2');

    // 4) Create grouped payment for performances with discount applied.
    //
    // Seeded prices: pricePerParticipant = 500.
    // Each registration: 20 * 500 = 10 000.
    // Total performanceRequired = 20 000.
    // Seeded discount tiers: 10% for 10 000–30 999 -> discount = 2 000.
    // So totalRequired = 18 000.

    const totalToPay = 18000;

    const paymentRes = await request(app)
      .post('/api/payments/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        registrationIds: [regId1, regId2],
        paymentsByMethod: {
          cash: totalToPay,
          card: 0,
          transfer: 0,
        },
        payingPerformance: true,
        payingDiplomasAndMedals: false,
        applyDiscount: true,
        paymentGroupName: 'Интеграционный тест оплаты',
      });

    expect(paymentRes.status).toBe(200);
    expect(paymentRes.body).toMatchObject({
      success: true,
      totalPaid: totalToPay,
      totalToPay,
    });
    expect(paymentRes.body.discount).toBeGreaterThan(0);

    // 5) Check accounting entries for the event.
    const accountingRes = await request(app)
      .get('/api/accounting')
      .query({ eventId: 1, includeDeleted: false })
      .set('Authorization', `Bearer ${token}`);

    expect(accountingRes.status).toBe(200);
    const { entries, summary } = accountingRes.body as {
      entries: any[];
      summary: any;
    };

    // Flatten grouped/ungrouped entries for easier search.
    const flatEntries: any[] = [];
    for (const groupOrEntry of entries) {
      if (Array.isArray(groupOrEntry)) {
        flatEntries.push(...groupOrEntry);
      } else {
        flatEntries.push(groupOrEntry);
      }
    }

    const ourEntries = flatEntries.filter(
      (e) => e.registrationId === regId1 || e.registrationId === regId2
    );

    expect(ourEntries.length).toBeGreaterThan(0);

    // All entries must be PERFORMANCE and CASH, with some discount applied.
    for (const entry of ourEntries) {
      expect(entry.paidFor).toBe('PERFORMANCE');
      expect(entry.method).toBe('CASH');
      expect(Number(entry.amount)).toBeGreaterThan(0);
      // discountAmount may be zero if distribution is skewed, but sum should match global discount
    }

    const totalAmountForRegs = ourEntries.reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );

    // Total amount for our registrations should closely match totalToPay (allow minor rounding diff).
    expect(Math.abs(totalAmountForRegs - totalToPay)).toBeLessThanOrEqual(1);

    // Summary.performance.total should be at least totalToPay (may include other entries from previous tests).
    expect(summary.performance.total).toBeGreaterThanOrEqual(totalToPay);

    // 6) Verify registration payment statuses updated to PERFORMANCE_PAID.
    const reg1Res = await request(app)
      .get(`/api/registrations/${regId1}`)
      .set('Authorization', `Bearer ${token}`);
    expect(reg1Res.status).toBe(200);
    expect(reg1Res.body.paymentStatus).toBe('PERFORMANCE_PAID');

    const reg2Res = await request(app)
      .get(`/api/registrations/${regId2}`)
      .set('Authorization', `Bearer ${token}`);
    expect(reg2Res.status).toBe(200);
    expect(reg2Res.body.paymentStatus).toBe('PERFORMANCE_PAID');
  });
});


