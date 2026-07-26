import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { type LucideIcon } from 'lucide-react';

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none gap-2",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-dark focus:ring-primary",
        secondary: "bg-secondary text-white hover:bg-secondary-dark focus:ring-secondary",
        gray: "bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500",
        light: "bg-light text-dark hover:bg-light-dark focus:ring-gray-300",
        dark: "bg-dark text-white hover:bg-dark-light focus:ring-dark",
        outline: "border-2 border-primary text-primary hover:bg-primary hover:text-white focus:ring-primary",
        ghost: "hover:bg-gray-100 text-gray-700 hover:text-gray-900 focus:ring-gray-300",
        danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500",
      },
      size: {
        default: "px-6 py-2.5 text-sm",
        sm: "px-4 py-2 text-xs",
        lg: "px-8 py-3.5 text-base",
        xl: "px-10 py-4 text-lg",
        icon: "w-10 h-10 p-0",
        iconSm: "w-8 h-8 p-0 text-xs",
        iconLg: "w-12 h-12 p-0 text-xl",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  icon?: LucideIcon;          // Single icon (replaces children)
  leftIcon?: LucideIcon;      // Icon on the left
  rightIcon?: LucideIcon;     // Icon on the right
  iconSize?: number;          // Custom icon size
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    fullWidth,
    icon: Icon,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    iconSize = 18,
    isLoading,
    children,
    disabled,
    ...props 
  }, ref) => {
    // Determine if this is an icon-only button
    const isIconOnly = size?.startsWith('icon') && !children && !LeftIcon && !RightIcon;
    
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        
        {/* Single icon (icon-only button) */}
        {Icon && !isLoading && <Icon size={iconSize} />}
        
        {/* Left icon with children */}
        {LeftIcon && !isLoading && <LeftIcon size={iconSize} />}
        
        {children}
        
        {/* Right icon with children */}
        {RightIcon && !isLoading && <RightIcon size={iconSize} />}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };