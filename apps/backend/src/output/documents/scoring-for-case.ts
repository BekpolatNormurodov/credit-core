import { scoreForCase, type ScorableCase, type ScoreResult } from '@credit-core/shared';
import { CaseDocData } from './case-document.loader';

/**
 * The case's score, computed on demand.
 *
 * Nothing ever wrote the ScoringResult table, so every report printed «Скоринг ҳисобланмаган».
 * Computing it here — the way the payment schedule is computed — means the report is always
 * current and never depends on a row somebody forgot to create.
 *
 * The mapping itself lives in shared, so this and the wizard's live preview score a case
 * identically. Two mappers would have drifted apart, and a printed report disagreeing with the
 * screen the operator just read is worse than no score at all.
 */
export function scoringForCase(c: CaseDocData): ScoreResult {
  return scoreForCase(c as unknown as ScorableCase);
}
