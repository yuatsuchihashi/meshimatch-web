"""
Process MLIT N02 railway GeoJSON into MeshiMatch station/line data.

Input:  ~/Downloads/Shift-JIS/N02-22_Station.geojson
        ~/Downloads/Shift-JIS/N02-22_RailroadSection.geojson
Output: src/data/stations.json
        src/data/lines.json
        src/data/adjacency.json

Usage:  python3 scripts/process-station-data.py
"""

import json
import re
import os
from collections import defaultdict
from math import radians, cos, sin, sqrt, atan2

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_DIR, "src", "data")

STATION_GEOJSON = os.path.expanduser("~/Downloads/Shift-JIS/N02-22_Station.geojson")
SECTION_GEOJSON = os.path.expanduser("~/Downloads/Shift-JIS/N02-22_RailroadSection.geojson")

# Tokyo metropolitan area bounding box
LAT_MIN, LAT_MAX = 35.4, 36.1
LNG_MIN, LNG_MAX = 139.3, 140.2

# Estimated daily ridership for major stations (top ~50, from public data)
# Used for Scale Score. Smaller stations default to 10000.
RIDERSHIP_ESTIMATES = {
    "新宿": 775000, "渋谷": 540000, "池袋": 560000, "東京": 460000,
    "品川": 390000, "新橋": 280000, "秋葉原": 250000, "北千住": 410000,
    "高田馬場": 210000, "上野": 190000, "大手町": 330000, "横浜": 420000,
    "大宮": 250000, "町田": 150000, "吉祥寺": 145000, "立川": 170000,
    "中目黒": 190000, "恵比寿": 140000, "目黒": 120000, "五反田": 140000,
    "大崎": 160000, "浜松町": 160000, "田町": 150000, "有楽町": 180000,
    "神田": 120000, "御茶ノ水": 110000, "飯田橋": 110000, "市ヶ谷": 100000,
    "四ツ谷": 100000, "代々木": 70000, "原宿": 75000, "表参道": 170000,
    "六本木": 110000, "赤坂": 70000, "銀座": 140000, "日本橋": 120000,
    "三軒茶屋": 65000, "下北沢": 80000, "中野": 140000, "荻窪": 90000,
    "蒲田": 140000, "自由が丘": 85000, "二子玉川": 70000, "武蔵小杉": 200000,
    "川崎": 210000, "溝の口": 100000, "登戸": 90000, "調布": 80000,
    "府中": 60000, "国分寺": 100000, "三鷹": 95000, "船橋": 140000,
    "柏": 120000, "松戸": 100000, "浦和": 100000, "赤羽": 95000,
    "日暮里": 110000, "西日暮里": 80000, "巣鴨": 70000, "駒込": 50000,
    "田端": 45000, "王子": 60000, "板橋": 45000, "十条": 30000,
    "新木場": 65000, "豊洲": 85000, "月島": 45000, "門前仲町": 60000,
    "清澄白河": 40000, "押上": 75000, "錦糸町": 110000, "亀戸": 45000,
    "小岩": 60000, "葛西": 50000, "西船橋": 130000, "津田沼": 90000,
    "千葉": 110000, "学芸大学": 40000, "都立大学": 30000, "祐天寺": 25000,
    "中目黒": 190000, "代官山": 35000, "神泉": 20000, "駒場東大前": 25000,
    "下高井戸": 25000, "明大前": 55000, "笹塚": 55000, "幡ヶ谷": 25000,
    "初台": 30000, "永田町": 100000, "溜池山王": 90000, "虎ノ門": 60000,
    "霞ヶ関": 85000, "国会議事堂前": 40000, "赤坂見附": 80000,
    "青山一丁目": 60000, "外苑前": 30000, "乃木坂": 35000,
    "広尾": 40000, "麻布十番": 40000, "白金高輪": 45000,
    "泉岳寺": 50000, "三田": 65000, "芝公園": 25000, "御成門": 30000,
    "内幸町": 25000, "日比谷": 80000, "二重橋前": 25000,
    "九段下": 80000, "竹橋": 35000, "神保町": 55000, "水道橋": 45000,
    "後楽園": 60000, "春日": 40000, "本郷三丁目": 35000,
    "湯島": 35000, "根津": 20000, "千駄木": 20000, "西ヶ原": 15000,
    "中板橋": 15000, "ときわ台": 20000, "上板橋": 20000,
    "成増": 55000, "和光市": 70000, "朝霞台": 40000, "志木": 50000,
    "所沢": 90000, "練馬": 55000, "石神井公園": 45000, "大泉学園": 35000,
    "ひばりヶ丘": 30000, "田無": 35000, "花小金井": 25000, "小平": 30000,
    "国立": 40000, "日野": 25000, "八王子": 80000, "橋本": 50000,
    "相模原": 30000, "海老名": 45000, "藤沢": 55000, "大船": 50000,
    "戸塚": 65000, "上大岡": 45000, "関内": 40000, "桜木町": 50000,
    "東神奈川": 25000, "新横浜": 60000, "鶴見": 45000, "鳴海": 10000,
    "綱島": 25000, "日吉": 50000, "菊名": 30000, "白楽": 15000,
    "東白楽": 10000, "反町": 10000, "妙蓮寺": 10000,
    "大井町": 70000, "西小山": 20000, "武蔵小山": 35000, "不動前": 20000,
    "戸越銀座": 15000, "旗の台": 25000, "長原": 15000, "洗足": 15000,
    "北赤羽": 20000, "浮間舟渡": 20000, "戸田公園": 25000, "戸田": 20000,
    "蕨": 35000, "西川口": 35000, "川口": 60000,
    "南浦和": 45000, "武蔵浦和": 40000, "中浦和": 15000, "北浦和": 40000,
    "与野": 15000, "北与野": 15000, "さいたま新都心": 30000,
    "赤坂": 70000, "溜池山王": 90000,
}

# Default ridership for stations not in the map
DEFAULT_RIDERSHIP = 15000


def load_geojson(path):
    with open(path, "rb") as f:
        raw = f.read()
    text = raw.decode("cp932", errors="replace")
    # The cp932 GeoJSON has stray backslashes in station names (e.g. "能\登中島", "小禄\")
    # These break JSON parsing. Strategy: use regex to fix values inside JSON strings.
    # Match backslashes inside property values and remove them.
    # Property values in this file are always: "KEY": "VALUE"
    def fix_value(m):
        return m.group(0).replace("\\", "")
    # Fix N02_005 (station name) values that may contain backslashes
    text = re.sub(r'"N02_005[cg]?":\s*"[^"]*(?:\\[^"]*)*"', fix_value, text)
    # Also fix line/operator names just in case
    text = re.sub(r'"N02_003":\s*"[^"]*(?:\\[^"]*)*"', fix_value, text)
    text = re.sub(r'"N02_004":\s*"[^"]*(?:\\[^"]*)*"', fix_value, text)
    return json.loads(text)


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def centroid(coords):
    lats = [c[1] for c in coords]
    lngs = [c[0] for c in coords]
    return sum(lats) / len(lats), sum(lngs) / len(lngs)


def in_tokyo_area(lat, lng):
    return LAT_MIN < lat < LAT_MAX and LNG_MIN < lng < LNG_MAX


def main():
    print("Loading Station GeoJSON...")
    station_data = load_geojson(STATION_GEOJSON)
    print(f"  Total features: {len(station_data['features'])}")

    print("Loading RailroadSection GeoJSON...")
    section_data = load_geojson(SECTION_GEOJSON)
    print(f"  Total features: {len(section_data['features'])}")

    # --- Process Stations ---
    # Group by group_code (N02_005g) to merge same-name stations across lines
    group_map = defaultdict(list)
    for feat in station_data["features"]:
        p = feat["properties"]
        coords = feat["geometry"]["coordinates"]
        lat, lng = centroid(coords)
        if not in_tokyo_area(lat, lng):
            continue
        group_code = p.get("N02_005g", p.get("N02_005c", ""))
        group_map[group_code].append({
            "name": p["N02_005"],
            "line": p["N02_003"],
            "operator": p["N02_004"],
            "station_code": p["N02_005c"],
            "group_code": group_code,
            "lat": lat,
            "lng": lng,
        })

    # Build station master (one row per group_code = one physical station)
    stations = {}
    for group_code, entries in group_map.items():
        name = entries[0]["name"]
        lats = [e["lat"] for e in entries]
        lngs = [e["lng"] for e in entries]
        avg_lat = sum(lats) / len(lats)
        avg_lng = sum(lngs) / len(lngs)
        line_set = set()
        for e in entries:
            line_id = f"{e['operator']}_{e['line']}"
            line_set.add(line_id)

        ridership = RIDERSHIP_ESTIMATES.get(name, DEFAULT_RIDERSHIP)

        stations[group_code] = {
            "id": group_code,
            "name": name,
            "lat": round(avg_lat, 5),
            "lng": round(avg_lng, 5),
            "passenger_count": ridership,
            "line_ids": sorted(line_set),
        }

    print(f"  Tokyo area stations (grouped): {len(stations)}")

    # --- Process Lines ---
    # Build lines from the station data directly.
    # Each station entry has (operator, line) info. Group stations by line_id.
    line_station_map = defaultdict(set)
    line_info = {}
    for group_code, entries in group_map.items():
        for e in entries:
            line_id = f"{e['operator']}_{e['line']}"
            line_station_map[line_id].add(group_code)
            if line_id not in line_info:
                line_info[line_id] = {
                    "operator": e["operator"],
                    "line_name": e["line"],
                }

    lines = {}
    adjacency = []
    adjacency_set = set()

    for line_id, station_id_set in line_station_map.items():
        station_ids_on_line = list(station_id_set)
        if len(station_ids_on_line) < 2:
            continue

        info = line_info[line_id]

        # Skip shinkansen
        line_name = info["line_name"]
        if "新幹線" in line_name:
            continue

        # Determine type from operator name
        operator = info["operator"]
        if "JR" in operator or "東日本旅客" in operator or "東海旅客" in operator:
            line_type = "JR"
        elif "東京メトロ" in operator or "メトロ" in operator:
            line_type = "metro"
        elif "都営" in operator or "東京都" in operator or "都交通局" in operator:
            line_type = "metro"
        else:
            line_type = "private"

        # Sort stations along the line by geographic proximity (greedy nearest neighbor)
        remaining = set(station_ids_on_line)
        start = min(remaining, key=lambda sid: (stations[sid]["lng"], stations[sid]["lat"]))
        ordered = [start]
        remaining.remove(start)

        while remaining:
            current = stations[ordered[-1]]
            nearest = min(remaining, key=lambda sid: haversine(
                current["lat"], current["lng"],
                stations[sid]["lat"], stations[sid]["lng"]
            ))
            # Skip if nearest is too far (>5km = probably wrong line grouping)
            dist = haversine(
                current["lat"], current["lng"],
                stations[nearest]["lat"], stations[nearest]["lng"]
            )
            if dist > 5.0:
                break
            ordered.append(nearest)
            remaining.remove(nearest)

        if len(ordered) < 2:
            continue

        lines[line_id] = {
            "id": line_id,
            "name": info["line_name"],
            "operator": info["operator"],
            "type": line_type,
            "station_ids": ordered,
        }

        # Generate adjacency edges from consecutive stations
        for i in range(len(ordered) - 1):
            a, b = ordered[i], ordered[i + 1]
            edge_key = tuple(sorted([a, b]))
            if edge_key not in adjacency_set:
                adjacency_set.add(edge_key)
                adjacency.append({
                    "station_a": a,
                    "station_b": b,
                    "line_id": line_id,
                })

    print(f"  Lines: {len(lines)}")
    print(f"  Adjacency edges: {len(adjacency)}")

    # --- Output ---
    os.makedirs(DATA_DIR, exist_ok=True)

    stations_list = sorted(stations.values(), key=lambda s: s["id"])
    with open(os.path.join(DATA_DIR, "stations.json"), "w", encoding="utf-8") as f:
        json.dump(stations_list, f, ensure_ascii=False, indent=1)
    print(f"  Wrote stations.json ({len(stations_list)} stations)")

    lines_list = sorted(lines.values(), key=lambda l: l["id"])
    with open(os.path.join(DATA_DIR, "lines.json"), "w", encoding="utf-8") as f:
        json.dump(lines_list, f, ensure_ascii=False, indent=1)
    print(f"  Wrote lines.json ({len(lines_list)} lines)")

    with open(os.path.join(DATA_DIR, "adjacency.json"), "w", encoding="utf-8") as f:
        json.dump(adjacency, f, ensure_ascii=False, indent=1)
    print(f"  Wrote adjacency.json ({len(adjacency)} edges)")

    # Print some stats
    print("\nSample stations:")
    for name in ["渋谷", "新宿", "池袋", "東京", "中目黒", "三軒茶屋", "下北沢"]:
        matches = [s for s in stations_list if s["name"] == name]
        if matches:
            s = matches[0]
            print(f"  {s['name']}: {len(s['line_ids'])} lines, {s['passenger_count']} passengers/day")


if __name__ == "__main__":
    main()
