import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

export function Splash({ title, subtitle }: { title: string; subtitle: string }) {
  const reduce = useReducedMotion();
  const from = (v: Record<string, number>) => (reduce ? { opacity: 1 } : v);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 text-white">
      <motion.div
        initial={from({ scale: 0.6, opacity: 0, rotate: -8 })}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 14 }}
        className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 backdrop-blur"
      >
        <ShieldCheck className="h-12 w-12" />
      </motion.div>
      <motion.h1
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-3xl font-bold tracking-tight"
      >
        {title}
      </motion.h1>
      <motion.p
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mt-2 text-brand-100"
      >
        {subtitle}
      </motion.p>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 160 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="mt-8 h-1 rounded-full bg-white/40"
      />
    </div>
  );
}
