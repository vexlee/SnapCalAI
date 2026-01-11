import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  className, 
  variant = 'primary', 
  isLoading, 
  children, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-6 py-4 rounded-[24px] font-semibold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-sm tracking-wide";
  
  const variants = {
    primary: "bg-royal-600 text-white hover:bg-royal-700 shadow-[0_10px_20px_-10px_rgba(124,58,237,0.5)]",
    secondary: "bg-royal-50 text-royal-700 hover:bg-royal-100",
    ghost: "bg-transparent text-gray-500 hover:text-royal-600 hover:bg-royal-50",
  };

  return (
    <button 
      className={clsx(baseStyles, variants[variant], className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Processing...
        </span>
      ) : children}
    </button>
  );
};