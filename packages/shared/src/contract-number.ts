/** Full contract number: "{GLOBAL} MFL {YEARLY} {BRANCH}" e.g. "2012 MFL 1320 PS".
 *  GLOBAL is the company-wide ever-increasing counter, YEARLY resets each year,
 *  BRANCH is the filial symbol (Branch.symbol). */
export function formatContractNumber(global: number, yearly: number, branch: string): string {
  return `${global} MFL ${yearly} ${branch}`;
}
