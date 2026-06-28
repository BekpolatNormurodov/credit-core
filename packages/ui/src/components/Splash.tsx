import { motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from './Logo';

export function Splash({ title, subtitle }: { title: string; subtitle: string }) {
  const reduce = useReducedMotion();
  const from = (v: Record<string, number>) => (reduce ? { opacity: 1 } : v);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <motion.div
        initial={from({ scale: 0.6, opacity: 0, rotate: -8 })}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 14 }}
        className="flex h-24 w-24 items-center justify-center rounded-3xl border border-gray-200 bg-white shadow-theme-md dark:border-gray-800 dark:bg-gray-800"
      >
        <LogoMark className="h-14 w-14" />
      </motion.div>
      <motion.h1
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-3xl font-bold tracking-tight text-gray-800 dark:text-white"
      >
        {title}
      </motion.h1>
      <motion.p
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mt-2 text-gray-500 dark:text-gray-400"
      >
        {subtitle}
      </motion.p>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 160 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="mt-8 h-1 rounded-full bg-brand-500/70 dark:bg-brand-500/60"
      />
    </div>
  );
}
