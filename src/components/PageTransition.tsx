"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isModern, setIsModern] = useState(false);

  useEffect(() => {
    // Escuta a mudanca do data-layout-mode do Next ou body
    const checkMode = () => {
      const mode = document.documentElement.getAttribute('data-layout-mode') || 'classic';
      setIsModern(mode === 'modern');
    };
    checkMode();
    
    // Configura observer para mudancas
    const observer = new MutationObserver(checkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout-mode'] });
    
    return () => observer.disconnect();
  }, []);

  if (!isModern) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ y: 20, opacity: 0, filter: "blur(5px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        exit={{ y: -20, opacity: 0, filter: "blur(5px)" }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex-grow flex flex-col will-change-[transform,opacity]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
