// ============================================
// ❌ ANTIPATTERN: JOB QUE PROCESSA DADOS COM LÓGICA DE NEGÓCIO
// Problema: Regras de domínio espalhadas no job
// ============================================

// ❌ PROBLEMA: Job com múltiplas responsabilidades
// DISABLED FOR TESTING - requires 'cron' package not in dependencies
export const processExpiredOrdersJob = {
  start() {
    console.log('⏱️ Expired Orders Processing Job (DISABLED IN DEV)');
  }
};

// ❌ PROBLEMA: Job exportado como singleton
export function startExpiredOrdersJob() {
  console.log('⏰ Expired Orders Job would be scheduled (DISABLED IN DEV)');
}
