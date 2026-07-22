/**
 * Who owns the pledged property.
 *
 * The forms always name an owner — «кўчмас мулк эгаси», «автомототранспорт воситаси эгаси» — but
 * the operator only fills the owner list in when it is somebody *other than* the borrower. Left
 * empty it used to print «—», so the most common case, the borrower pledging their own property,
 * produced documents that named nobody.
 *
 * The rule is the one the paperwork already assumes: no owner entered means the borrower owns it
 * outright. Resolved in one place so the documents, the case view and the wizard all say the same
 * thing, rather than each falling back on its own (which is how they drifted apart).
 */

/** The minimum an owner row has to carry to be printed. */
export interface OwnerLike {
  fullName: string;
  passportSeries?: string | null;
  passportNumber?: string | null;
  pinfl?: string | null;
  sharePercent?: number | null;
  /** True when this row is the borrower — either implied by us, or entered as such. */
  isBorrowerOwner?: boolean | null;
}

export interface BorrowerLike {
  fullName?: string | null;
  passportSeries?: string | null;
  passportNumber?: string | null;
  pinfl?: string | null;
}

/**
 * The owners to print for one collateral.
 *
 * An entered list wins untouched — including its shares, which may not total 100 (co-owners can
 * pledge a part). Only an empty list is filled in, and then with the borrower at 100%.
 *
 * Returns an empty array when there is nothing to say: no owners AND no borrower name. Callers
 * print «—» for that, and `collateralOwnerErrors` turns it into a submit-time error, because a
 * case that reaches the moderator with no nameable owner is not fit to sign.
 */
export function resolveOwners<T extends OwnerLike>(
  owners: T[] | null | undefined,
  borrower: BorrowerLike | null | undefined,
): (T | OwnerLike)[] {
  const entered = (owners ?? []).filter((o) => o?.fullName?.trim());
  if (entered.length) return entered;

  const name = borrower?.fullName?.trim();
  if (!name) return [];

  return [{
    fullName: name,
    passportSeries: borrower?.passportSeries ?? null,
    passportNumber: borrower?.passportNumber ?? null,
    pinfl: borrower?.pinfl ?? null,
    sharePercent: 100,
    isBorrowerOwner: true,
  }];
}

/** The first owner's name, or null when there is none to name. */
export function primaryOwnerName(
  owners: OwnerLike[] | null | undefined,
  borrower: BorrowerLike | null | undefined,
): string | null {
  return resolveOwners(owners, borrower)[0]?.fullName ?? null;
}

/** True when the owner shown is the borrower standing in, not somebody the operator entered. */
export function ownerIsImplied(
  owners: OwnerLike[] | null | undefined,
  borrower: BorrowerLike | null | undefined,
): boolean {
  return !(owners ?? []).some((o) => o?.fullName?.trim()) && !!borrower?.fullName?.trim();
}

/**
 * Submit-time complaints about ownership, one per collateral that cannot name an owner.
 *
 * Only fires when the owner list is empty *and* the borrower has no name — the case where the
 * implied default has nothing to fall back on. `label` numbers the collateral for the message.
 */
export function collateralOwnerErrors(
  collaterals: { owners?: OwnerLike[] | null }[] | null | undefined,
  borrower: BorrowerLike | null | undefined,
): string[] {
  const out: string[] = [];
  (collaterals ?? []).forEach((col, i) => {
    if (!resolveOwners(col.owners, borrower).length) {
      out.push(
        `Garov ${i + 1}: mulk egasi aniqlanmadi — egasini kiriting yoki qarz oluvchining F.I.Sh. sini to‘ldiring`,
      );
    }
  });
  return out;
}
