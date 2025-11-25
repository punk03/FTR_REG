import nodemailer from 'nodemailer';

interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig = {};
  private enabled: boolean = false;

  /**
   * Initialize email service
   */
  async initialize(): Promise<void> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || smtpUser || 'noreply@ftr.ru';
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.warn('Email service not configured. SMTP settings missing.');
      this.enabled = false;
      return;
    }

    this.config = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      from: smtpFrom,
    };

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
      });

      // Verify connection
      await this.transporter.verify();
      this.enabled = true;
      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Email service initialization failed:', error);
      this.enabled = false;
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      console.warn('Email service is not enabled or not initialized');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''),
        html,
      });
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send registration created notification
   */
  async sendRegistrationCreatedNotification(
    userEmail: string,
    registrationData: {
      id: number;
      number: number | null;
      collectiveName: string;
      eventName: string;
      danceName?: string;
    }
  ): Promise<boolean> {
    const subject = `Регистрация создана: ${registrationData.collectiveName}`;
    const html = `
      <h2>Регистрация успешно создана</h2>
      <p>Ваша регистрация была успешно создана в системе FTR Registration.</p>
      <ul>
        <li><strong>Номер регистрации:</strong> ${registrationData.number || 'Не назначен'}</li>
        <li><strong>Коллектив:</strong> ${registrationData.collectiveName}</li>
        <li><strong>Мероприятие:</strong> ${registrationData.eventName}</li>
        ${registrationData.danceName ? `<li><strong>Номер:</strong> ${registrationData.danceName}</li>` : ''}
      </ul>
      <p>Вы можете просмотреть детали регистрации в системе.</p>
    `;

    return this.sendEmail(userEmail, subject, html);
  }

  /**
   * Send payment created notification
   */
  async sendPaymentCreatedNotification(
    userEmail: string,
    paymentData: {
      registrationIds: number[];
      totalAmount: number;
      discountAmount: number;
      paymentGroupName?: string;
    }
  ): Promise<boolean> {
    const subject = `Оплата создана: ${paymentData.paymentGroupName || 'Группа платежей'}`;
    const html = `
      <h2>Оплата успешно создана</h2>
      <p>Оплата была успешно зарегистрирована в системе.</p>
      <ul>
        ${paymentData.paymentGroupName ? `<li><strong>Группа платежей:</strong> ${paymentData.paymentGroupName}</li>` : ''}
        <li><strong>Количество регистраций:</strong> ${paymentData.registrationIds.length}</li>
        <li><strong>Общая сумма:</strong> ${paymentData.totalAmount.toFixed(2)} руб.</li>
        ${paymentData.discountAmount > 0 ? `<li><strong>Скидка:</strong> ${paymentData.discountAmount.toFixed(2)} руб.</li>` : ''}
      </ul>
      <p>Вы можете просмотреть детали оплаты в разделе бухгалтерии.</p>
    `;

    return this.sendEmail(userEmail, subject, html);
  }

  /**
   * Send registration status changed notification
   */
  async sendRegistrationStatusChangedNotification(
    userEmail: string,
    registrationData: {
      id: number;
      number: number | null;
      collectiveName: string;
      oldStatus: string;
      newStatus: string;
    }
  ): Promise<boolean> {
    const statusLabels: Record<string, string> = {
      PENDING: 'Ожидает рассмотрения',
      APPROVED: 'Одобрена',
      REJECTED: 'Отклонена',
    };

    const subject = `Статус регистрации изменен: ${registrationData.collectiveName}`;
    const html = `
      <h2>Статус регистрации изменен</h2>
      <p>Статус вашей регистрации был изменен.</p>
      <ul>
        <li><strong>Номер регистрации:</strong> ${registrationData.number || 'Не назначен'}</li>
        <li><strong>Коллектив:</strong> ${registrationData.collectiveName}</li>
        <li><strong>Предыдущий статус:</strong> ${statusLabels[registrationData.oldStatus] || registrationData.oldStatus}</li>
        <li><strong>Новый статус:</strong> ${statusLabels[registrationData.newStatus] || registrationData.newStatus}</li>
      </ul>
      <p>Вы можете просмотреть детали регистрации в системе.</p>
    `;

    return this.sendEmail(userEmail, subject, html);
  }

  /**
   * Check if email service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

export const emailService = new EmailService();

