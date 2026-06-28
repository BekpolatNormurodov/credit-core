import { cn } from './cn';

/**
 * SINGLE SOURCE OF TRUTH for surfaces (cards / panels).
 *
 * Every card-like component MUST build on `surface` instead of repeating
 * border/shadow/radius/dark-mode classes. This guarantees the shadow "sits"
 * the same everywhere and keeps the whole product visually consistent.
 *
 * Usage:
 *   import { surface, cardPad } from '../lib/surfaces';
 *   <div className={cn(surface, cardPad, className)} />
 */

/** Base card surface (TailAdmin): rounded-2xl + gray border + soft shadow + dark mode. */
export const surface =
  'rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-gray-900';

/** Clickable card: same surface + a subtle hover lift to the medium shadow. */
export const surfaceInteractive = cn(
  surface,
  'transition duration-200 hover:-translate-y-0.5 hover:shadow-theme-md',
);

/** Standard inner padding for cards (responsive). */
export const cardPad = 'p-5 md:p-6';

/** Tighter padding variant for dense widgets. */
export const cardPadSm = 'p-4';
