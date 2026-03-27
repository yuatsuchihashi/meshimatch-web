"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { GoButton } from "./GoButton";
import { Heart, MapPin, Utensils } from "lucide-react";
import { saveFavoriteRestaurant } from "@/actions/favorites";
import type { ScoredRestaurant } from "@/types/search";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

type RestaurantCardProps = {
  restaurant: ScoredRestaurant;
};

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleFavorite() {
    startTransition(async () => {
      await saveFavoriteRestaurant(restaurant);
    });
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex gap-3">
        {/* Photo */}
        {restaurant.photo_s ? (
          <img
            src={restaurant.photo_s}
            alt={restaurant.name}
            className="w-20 h-20 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Utensils size={24} className="text-accent/50" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground text-sm leading-tight truncate">
              {restaurant.name}
            </h3>
            <button
              type="button"
              onClick={handleFavorite}
              disabled={isPending}
              className="shrink-0 text-foreground/30 hover:text-red-400 transition-colors"
            >
              <Heart size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-lg">
              {restaurant.genre_name}
            </span>
            {restaurant.budget_name && (
              <span className="text-xs text-foreground/50">
                {restaurant.budget_name}
              </span>
            )}
          </div>

          <p className="text-xs text-foreground/40 flex items-center gap-1 mt-1.5 truncate">
            <MapPin size={10} />
            {restaurant.address}
          </p>

          {restaurant.catch_text && (
            <p className="text-xs text-foreground/50 mt-1 line-clamp-1">
              {restaurant.catch_text}
            </p>
          )}
        </div>
      </div>

      {/* Score badges + Go button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <span
            className={cn(
              "text-xs px-2 py-1 rounded-lg font-medium",
              restaurant.match_score >= 70
                ? "bg-green-500/15 text-green-700"
                : restaurant.match_score >= 50
                  ? "bg-yellow-500/15 text-yellow-700"
                  : "bg-foreground/5 text-foreground/50"
            )}
          >
            一致 {restaurant.match_score}
          </span>
          {restaurant.distance_km !== undefined && (
            <span className="text-xs bg-foreground/5 text-foreground/50 px-2 py-1 rounded-lg">
              {restaurant.distance_km}km
            </span>
          )}
        </div>

        <GoButton
          address={restaurant.address}
          lat={restaurant.lat}
          lng={restaurant.lng}
          name={restaurant.name}
        />
      </div>
    </GlassCard>
  );
}
