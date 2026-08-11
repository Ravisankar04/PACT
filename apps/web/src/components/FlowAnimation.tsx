"use client";

import { motion } from "framer-motion";

const steps = ["Agent", "Policy", "Authorization", "Smart Contract", "Settlement"];

export function FlowAnimation() {
  return (
    <div className="panel rounded-xl p-6 mono">
      <div className="text-xs text-pact-muted mb-4">LIVE AUTHORIZATION PATH</div>
      <div className="flex flex-col gap-0">
        {steps.map((step, i) => (
          <div key={step} className="flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.25, duration: 0.4 }}
              className="flex items-center gap-3"
            >
              <motion.span
                className="h-2.5 w-2.5 rounded-full bg-pact-accent"
                animate={{ scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.8, delay: i * 0.2 }}
              />
              <span className="text-pact-text">{step}</span>
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                className="ml-[4px] h-6 w-px bg-gradient-to-b from-pact-accent/80 to-pact-border"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.25 + 0.15, duration: 0.3 }}
                style={{ originY: 0 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
