"use client";

import { useState, useEffect } from "react";
import { GlassInput } from "@/components/ui/GlassInput";
import { MapPin } from "lucide-react";

type Area = { code: string; name: string };

type LocationInputProps = {
  onSelect: (code: string, name: string) => void;
  selectedName?: string;
};

export function LocationInput({ onSelect, selectedName }: LocationInputProps) {
  const [largeAreas, setLargeAreas] = useState<Area[]>([]);
  const [middleAreas, setMiddleAreas] = useState<Area[]>([]);
  const [selectedLarge, setSelectedLarge] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLargeAreas() {
      try {
        const res = await fetch("/api/hotpepper/areas?type=large");
        const data = await res.json();
        setLargeAreas(data.areas ?? []);
      } catch {
        // silently fail
      }
    }
    fetchLargeAreas();
  }, []);

  async function handleLargeAreaSelect(code: string) {
    setSelectedLarge(code);
    setMiddleAreas([]);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/hotpepper/areas?type=middle&parent_code=${code}`
      );
      const data = await res.json();
      setMiddleAreas(data.areas ?? []);
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <MapPin size={14} />
        {selectedName ? (
          <span className="text-accent font-medium">{selectedName}</span>
        ) : (
          <span>エリアを選択してください</span>
        )}
      </div>

      <select
        className="glass px-4 py-3 text-sm text-foreground bg-transparent outline-none cursor-pointer"
        value={selectedLarge}
        onChange={(e) => handleLargeAreaSelect(e.target.value)}
      >
        <option value="">都道府県を選択</option>
        {largeAreas.map((area) => (
          <option key={area.code} value={area.code}>
            {area.name}
          </option>
        ))}
      </select>

      {loading && (
        <p className="text-xs text-foreground/50">エリアを読み込み中...</p>
      )}

      {middleAreas.length > 0 && (
        <select
          className="glass px-4 py-3 text-sm text-foreground bg-transparent outline-none cursor-pointer"
          onChange={(e) => {
            const area = middleAreas.find((a) => a.code === e.target.value);
            if (area) onSelect(area.code, area.name);
          }}
          defaultValue=""
        >
          <option value="">エリアを選択</option>
          {middleAreas.map((area) => (
            <option key={area.code} value={area.code}>
              {area.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
