// ============================================
// ❌ ANTIPATTERN: BACKGROUND JOB COM ACESSO DIRETO AO DB
// Problema: Lógica de negócio e acesso ao banco dentro do job
// ============================================

// ❌ PROBLEMA: Job com múltiplas responsabilidades
// DISABLED FOR TESTING - requires 'cron' package not in dependencies
export const sendDailyReportJob = {
  start() {
    console.log('📅 Daily Report Job (DISABLED IN DEV)');
  }
};

// ❌ PROBLEMA: Exporta o job como singleton global
export function startDailyReportJob() {
  console.log('📅 Daily Report Job would be scheduled (DISABLED IN DEV)');
}
