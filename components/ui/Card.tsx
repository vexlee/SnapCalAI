import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={clsx(
        "bg-white dark:bg-[#1a1c26] rounded-[32px] p-5 shadow-diffused dark:shadow-diffused-dark border border-white/60 dark:border-white/5",
        onClick && "cursor-pointer active:scale-[0.98] transition-all hover:shadow-diffused-lg dark:hover:shadow-diffused-dark hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
};