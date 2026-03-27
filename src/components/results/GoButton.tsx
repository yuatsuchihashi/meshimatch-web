"use client";

import { useState } from "react";
import { GlassButton } from "@/components/ui/GlassButton";
import { MapPin, Copy, Check, ChevronDown } from "lucide-react";

type GoButtonProps = {
  address: string;
  lat: number;
  lng: number;
  name: string;
};

export function GoButton({ address, lat, lng, name }: GoButtonProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  function openGoogleMaps() {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(name)}`,
      "_blank"
    );
  }

  function openAppleMaps() {
    window.open(
      `https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${lat},${lng}`,
      "_blank"
    );
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(`${name} ${address}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <GlassButton
          variant="accent"
          size="sm"
          onClick={openGoogleMaps}
          className="flex-1 flex items-center justify-center gap-1"
        >
          <MapPin size={14} />
          Go
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={() => setShowOptions(!showOptions)}
        >
          <ChevronDown size={14} />
        </GlassButton>
      </div>

      {showOptions && (
        <div className="absolute bottom-full mb-2 right-0 glass-strong p-2 flex flex-col gap-1 min-w-[160px] z-10">
          <button
            onClick={openGoogleMaps}
            className="text-left text-sm px-3 py-2 rounded-xl hover:bg-white/15 transition-colors text-foreground"
          >
            Google Maps
          </button>
          <button
            onClick={openAppleMaps}
            className="text-left text-sm px-3 py-2 rounded-xl hover:bg-white/15 transition-colors text-foreground"
          >
            Apple Maps
          </button>
          <button
            onClick={copyAddress}
            className="text-left text-sm px-3 py-2 rounded-xl hover:bg-white/15 transition-colors text-foreground flex items-center gap-2"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "コピー済み" : "住所をコピー"}
          </button>
        </div>
      )}
    </div>
  );
}
