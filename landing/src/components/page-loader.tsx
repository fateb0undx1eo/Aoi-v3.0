import { AnimatePresence, motion } from "motion/react";

type PageLoaderProps = {
  active: boolean;
};

export function PageLoader({ active }: PageLoaderProps) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative flex items-center gap-4">
            <motion.div
              className="absolute -inset-12 rounded-full bg-primary/12 blur-2xl"
              animate={{ opacity: [0.2, 0.45, 0.2], scale: [0.9, 1.08, 0.9] }}
              transition={{ duration: 1.8, repeat: 1, ease: "easeInOut" }}
            />

            <motion.div
              className="relative h-20 w-20"
              initial={{ rotate: -22 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="absolute inset-0 rounded-full border-[3px] border-primary/85"
                initial={{ scale: 0.35, opacity: 0.95 }}
                animate={{ scale: [0.35, 1, 0.7], opacity: [0.95, 0.6, 0] }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />

              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" fill="none">
                <motion.path
                  d="M50 10V90"
                  stroke="hsl(var(--foreground))"
                  strokeWidth="4.8"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.55, duration: 0.4 }}
                />
                <motion.path
                  d="M50 18L26 42L50 66L74 42L50 18Z"
                  stroke="hsl(var(--foreground))"
                  strokeWidth="4.8"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.67, duration: 0.45 }}
                />
                <motion.path
                  d="M50 34L74 58L50 90L26 58L50 34Z"
                  stroke="hsl(var(--foreground))"
                  strokeWidth="4.8"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.78, duration: 0.45 }}
                />
              </svg>
            </motion.div>

            <motion.span
              className="card-heading text-4xl tracking-tight text-primary"
              initial={{ opacity: 0, x: 8, filter: "blur(7px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.95, duration: 0.5 }}
            >
              ToketoCo
            </motion.span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
