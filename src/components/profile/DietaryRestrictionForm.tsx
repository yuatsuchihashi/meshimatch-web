"use client";

import { useTransition } from "react";
import { DIETARY_RESTRICTIONS, type DietaryRestrictionId } from "@/lib/restaurant-taxonomy";
import { addDietaryRestriction, removeDietaryRestriction } from "@/actions/preferences";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type DietaryRestrictionFormProps = {
  initial: DietaryRestrictionId[];
};

export function DietaryRestrictionForm({ initial }: DietaryRestrictionFormProps) {
  const [isPending, startTransition] = useTransition();

  function toggleRestriction(id: DietaryRestrictionId, isActive: boolean) {
    startTransition(async () => {
      if (isActive) {
        await removeDietaryRestriction(id);
      } else {
        await addDietaryRestriction(id);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {DIETARY_RESTRICTIONS.map((restriction) => {
        const isActive = initial.includes(restriction.id);
        return (
          <button
            key={restriction.id}
            type="button"
            disabled={isPending}
            onClick={() => toggleRestriction(restriction.id as DietaryRestrictionId, isActive)}
            className={cn(
              "glass inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium",
              "transition-all duration-200 cursor-pointer rounded-xl",
              isActive
                ? "!bg-accent/20 !border-accent/40 text-accent"
                : "text-foreground/60 hover:bg-white/25"
            )}
          >
            {isActive && <Check size={14} />}
            {restriction.label}
          </button>
        );
      })}
    </div>
  );
}
