"use client";

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  function GlassInput({ className, label, error, id, ...props }, ref) {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground/80">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "glass px-4 py-3 text-base text-foreground placeholder:text-foreground/40",
            "outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200",
            error && "ring-2 ring-danger/50",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }
);
