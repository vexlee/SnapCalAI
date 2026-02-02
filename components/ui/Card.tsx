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
        "bg-surface rounded-4xl p-5 shadow-soft border border-white/40",
        onClick && "cursor-pointer active:scale-[0.98] transition-all hover:shadow-soft-lg hover:-translate-y-1",
        className
      )}
    >
      {children}
    </div>
  );
};