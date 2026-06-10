"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";

type LayoutMode = 'classic' | 'modern' | 'aurora';

const transitionVariants: Record<string, any> = {
  modern: {
    initial: { y: 20, opacity: 0, filter: "blur(5px)" },
    animate: { y: 0, opacity: 1, filter: "blur(0px)" },
    exit: { y: -20, opacity: 0, filter: "blur(5px)" },
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
  aurora: {
    initial: { x: 30, opacity: 0, scale: 0.98, filter: "blur(6px)" },
    animate: { x: 0, opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { x: -30, opacity: 0, scale: 0.98, filter: "blur(6px)" },
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('classic');
  const isFirstRender = useRef(true);

  useEffect(() => {
    const checkMode = () => {
      const mode = (document.documentElement.getAttribute('data-layout-mode') || 'classic') as LayoutMode;
      setLayoutMode(mode);
    };
    checkMode();
    
    const observer = new MutationObserver(checkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout-mode'] });
    
    return () => observer.disconnect();
  }, []);

  // After first render, disable the initial animation flag
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, []);

  if (layoutMode === 'classic') {
    return <>{children}</>;
  }

  const variant = transitionVariants[layoutMode] || transitionVariants.modern;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={isFirstRender.current ? false : variant.initial}
        animate={variant.animate}
        exit={variant.exit}
        transition={variant.transition}
        className="flex-grow flex flex-col"
        style={{ willChange: 'transform, opacity' }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}

// Next.js App Router updates children before Framer Motion's exit animation completes.
// This causes the exiting page to flash the incoming page's content.
// We freeze the router context for the exiting component to prevent this.
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useContext } from 'react';

function FrozenRouter(props: { children: ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const frozen = useRef(context).current;

  if (!LayoutRouterContext) {
    return <>{props.children}</>;
  }

  return (
    <LayoutRouterContext.Provider value={frozen}>
      {props.children}
    </LayoutRouterContext.Provider>
  );
}
