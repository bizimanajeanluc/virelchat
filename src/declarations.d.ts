declare module 'motion/react' {
  export { motion, AnimatePresence, MotionConfig, useAnimation, useMotionValue, useTransform, useScroll, useSpring, useInView } from 'framer-motion';
  export const m: typeof import('framer-motion').motion;
}

declare module 'framer-motion' {
  import { ComponentType, ReactNode } from 'react';

  interface AnimatePresenceProps {
    children?: ReactNode;
    mode?: 'wait' | 'sync' | 'popLayout';
    initial?: boolean;
    onExitComplete?: () => void;
  }

  export const AnimatePresence: ComponentType<AnimatePresenceProps>;
  export const motion: {
    div: ComponentType<any>;
    span: ComponentType<any>;
    p: ComponentType<any>;
    button: ComponentType<any>;
    a: ComponentType<any>;
    img: ComponentType<any>;
    section: ComponentType<any>;
    article: ComponentType<any>;
    nav: ComponentType<any>;
    header: ComponentType<any>;
    footer: ComponentType<any>;
    main: ComponentType<any>;
    aside: ComponentType<any>;
    h1: ComponentType<any>;
    h2: ComponentType<any>;
    h3: ComponentType<any>;
    h4: ComponentType<any>;
    ul: ComponentType<any>;
    li: ComponentType<any>;
    [key: string]: ComponentType<any>;
  };
  export const m: typeof motion;
  export function useAnimation(): any;
  export function useMotionValue<T = number>(initial: T): any;
  export function useTransform(...args: any[]): any;
  export function useScroll(): any;
  export function useSpring(value: any, config?: any): any;
  export function useInView(options?: any): any;
}
