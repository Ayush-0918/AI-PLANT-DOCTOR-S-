'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAssistant = pathname === '/assistant';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 25, 
        mass: 0.5 
      }}
      className={`w-full ${
        isAssistant
          ? 'flex-1 min-h-0 h-full overflow-hidden flex flex-col'
          : 'flex-none'
      }`}
    >
      {children}
    </motion.div>
  );
}

