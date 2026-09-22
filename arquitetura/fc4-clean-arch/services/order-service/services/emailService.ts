// ❌ PROBLEMA: EmailService hardcoded (sem abstração/interface)
// Simula envio de email sem depender do SendGrid

export class EmailService {
  private emails: any[] = [];

  async send(to: string, subject: string, html: string): Promise<void> {
    try {
      // Simula envio de email
      const email = {
        to,
        subject,
        html,
        from: 'noreply@shophub.com',
        sentAt: new Date().toISOString(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.emails.push(email);
      console.log(`📧 Email enviado para ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Message ID: ${email.messageId}`);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      throw error;
    }
  }

  // Método auxiliar para testes - retorna emails enviados
  getSentEmails(): any[] {
    return this.emails;
  }

  // Método auxiliar para limpar histórico
  clearHistory(): void {
    this.emails = [];
  }
}

// Instância singleton
export const emailService = new EmailService();
