// ============================================================
// MeshiMatch Figma UI – Part 3: Searching, Results, Invite, Notifications
// ============================================================
// Part 1, Part 2 を実行してから、このスクリプトを実行してください
// ============================================================

function rgb(hex, op) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [{ type: "SOLID", color: { r, g, b }, opacity: op !== undefined ? op : 1 }];
}
function shadow(ox, oy, blur, sp, a) {
  return [{ type: "DROP_SHADOW", visible: true, blendMode: "NORMAL", color: { r: 0, g: 0, b: 0, a: a || 0.08 }, offset: { x: ox, y: oy }, radius: blur, spread: sp || 0 }];
}
const FONTS = {};
async function loadFont(s) { if (!FONTS[s]) { await figma.loadFontAsync({ family: "Inter", style: s }); FONTS[s] = true; } }
function fs(w) { return w >= 700 ? "Bold" : w >= 600 ? "Semi Bold" : w >= 500 ? "Medium" : "Regular"; }
async function txt(p, t, sz, w, c, o) {
  const s = fs(w); await loadFont(s);
  const n = figma.createText(); n.characters = t; n.fontSize = sz;
  n.fontName = { family: "Inter", style: s }; n.fills = rgb(c);
  if (o?.w) { n.resize(o.w, n.height); n.textAutoResize = "HEIGHT"; }
  if (o?.align) n.textAlignHorizontal = o.align;
  if (o?.x !== undefined) n.x = o.x; if (o?.y !== undefined) n.y = o.y;
  p.appendChild(n); return n;
}
function af(p, name, o) {
  const f = figma.createFrame(); f.name = name;
  if (o.w && o.h) f.resize(o.w, o.h);
  f.fills = o.fills || [];
  if (o.corner) f.cornerRadius = o.corner;
  if (o.layout) {
    f.layoutMode = o.layout;
    f.primaryAxisAlignItems = o.mainAlign || "MIN";
    f.counterAxisAlignItems = o.crossAlign || "MIN";
    if (o.gap !== undefined) f.itemSpacing = o.gap;
    if (o.pad !== undefined) { f.paddingTop = o.pad; f.paddingBottom = o.pad; f.paddingLeft = o.pad; f.paddingRight = o.pad; }
    if (o.pt !== undefined) f.paddingTop = o.pt; if (o.pb !== undefined) f.paddingBottom = o.pb;
    if (o.pl !== undefined) f.paddingLeft = o.pl; if (o.pr !== undefined) f.paddingRight = o.pr;
  }
  if (o.shadow) f.effects = o.shadow;
  if (o.x !== undefined) f.x = o.x; if (o.y !== undefined) f.y = o.y;
  if (o.strokes) { f.strokes = o.strokes; f.strokeWeight = o.strokeW || 1; }
  if (o.alignSelf) f.layoutAlign = o.alignSelf;
  p.appendChild(f); return f;
}
function card(p, n, o) {
  return af(p, n, { ...o, fills: rgb("#FFFFFF"), corner: o?.corner || 20,
    shadow: shadow(0, 1, 3, 0, 0.04).concat([{ type: "DROP_SHADOW", visible: true, blendMode: "NORMAL", color: { r: 0, g: 0, b: 0, a: 0.02 }, offset: { x: 0, y: 4 }, radius: 12, spread: 0 }]),
  });
}
function pill(p, n, w, h, bg, t, sz, tc, tw) {
  const f = af(p, n, { w, h, fills: rgb(bg), corner: 100, layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER" });
  return txt(f, t, sz, tw || 600, tc, { align: "CENTER" }).then(() => f);
}
function avatar(p, init, col, sz) {
  const a = af(p, "av-" + init, { w: sz || 36, h: sz || 36, corner: 100, fills: rgb(col), layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER" });
  txt(a, init, (sz || 36) * 0.4, 700, "#FFFFFF"); return a;
}

const C = {
  primary: "#C26A4A", secondary: "#1A1A2E", bg: "#F7F6F3", bgSec: "#EFEEE9",
  surface: "#FFFFFF", text1: "#1A1A2E", text2: "#6E6E7A", text3: "#A0A0AC",
  border: "#E8E8E4", warning: "#E8B944", danger: "#B33A3A", success: "#3D8B5E",
};

(async () => {
  const page = figma.root.children.find(p => p.name === "UI Screens");
  if (!page) { figma.notify("❌ Run Part 1 first"); return; }
  await figma.setCurrentPageAsync(page);

  const W = 390, H = 844, GAP = 60;
  let cx = 0;
  page.children.forEach(c => { cx = Math.max(cx, c.x + c.width + GAP); });

  // ════════════════════════════════════════════════════════════
  // 10. SEARCHING (AI Loading)
  // ════════════════════════════════════════════════════════════
  const searching = af(page, "Searching", { w: W, h: H, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  // Center content
  const searchCenter = af(searching, "Center", {
    w: W, h: H, layout: "VERTICAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 24,
  });

  // Pulse rings (decorative circles)
  const pulse = af(searchCenter, "PulseRings", { w: 120, h: 120 });
  const ring1 = figma.createEllipse(); ring1.resize(120, 120); ring1.fills = rgb(C.primary, 0.06); ring1.x = 0; ring1.y = 0; pulse.appendChild(ring1);
  const ring2 = figma.createEllipse(); ring2.resize(100, 100); ring2.fills = rgb(C.primary, 0.08); ring2.x = 10; ring2.y = 10; pulse.appendChild(ring2);
  const ring3 = figma.createEllipse(); ring3.resize(80, 80); ring3.fills = rgb(C.primary, 0.12); ring3.x = 20; ring3.y = 20; pulse.appendChild(ring3);
  // Center icon
  const searchIconBg = af(pulse, "IconBg", {
    w: 60, h: 60, x: 30, y: 30, corner: 100, fills: rgb(C.primary, 0.15),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(searchIconBg, "🔍", 24, 400, C.primary);

  // Progress bar
  const progWrap = af(searchCenter, "ProgressWrap", { w: 280, h: 6, corner: 6, fills: rgb(C.border) });
  const progFill = figma.createRectangle();
  progFill.resize(180, 6); progFill.cornerRadius = 6; progFill.fills = rgb(C.primary);
  progWrap.appendChild(progFill);

  await txt(searchCenter, "64%", 13, 500, C.text3, { align: "CENTER" });
  await txt(searchCenter, "レストランを検索中...", 16, 600, C.text1, { align: "CENTER" });
  await txt(searchCenter, "AIがベストマッチを探しています", 14, 400, C.text2, { align: "CENTER" });

  // ════════════════════════════════════════════════════════════
  // 11. RESULTS
  // ════════════════════════════════════════════════════════════
  const results = af(page, "Results", { w: W, h: 1400, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  // Header
  await txt(results, "← ホーム", 16, 500, C.primary, { x: 20, y: 20 });
  await txt(results, "金曜ランチ会", 20, 700, C.text1, { x: 20, y: 52 });

  // Area badges
  const areaBadges = af(results, "AreaBadges", { w: 200, x: 20, y: 82, layout: "HORIZONTAL", gap: 6 });
  for (const area of ["新宿", "六本木"]) {
    const b = af(areaBadges, area, {
      h: 24, corner: 100, fills: rgb(C.primary, 0.08),
      layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 10, pr: 10,
    });
    await txt(b, area, 12, 500, C.primary);
  }

  // Avatar stack + menu (top right)
  const avStack = af(results, "AvatarStack", { w: 80, h: 32, x: 270, y: 52, layout: "HORIZONTAL", gap: -8 });
  for (const [i, c] of [["Y", "#C26A4A"], ["T", "#6B7A52"], ["M", "#4A6B9A"]]) {
    const a = af(avStack, "av", { w: 32, h: 32, corner: 100, fills: rgb(c), layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER" });
    a.strokes = rgb(C.surface); a.strokeWeight = 2;
    await txt(a, i, 13, 700, "#FFFFFF");
  }

  // Menu dots
  const dots = af(results, "MenuDots", {
    w: 32, h: 32, x: 346, y: 52, corner: 100, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(dots, "⋮", 18, 700, C.text2);

  // Decided banner
  const decided = af(results, "DecidedBanner", {
    w: 350, x: 20, y: 118, corner: 14,
    fills: rgb(C.success, 0.06),
    strokes: rgb(C.success, 0.2), strokeW: 1,
    layout: "HORIZONTAL", crossAlign: "CENTER", gap: 10, pl: 14, pr: 14, pt: 12, pb: 12,
  });
  await txt(decided, "✓", 14, 700, C.success);
  const decCol = af(decided, "DecInfo", { layout: "VERTICAL", gap: 2 });
  decCol.layoutGrow = 1;
  await txt(decCol, "決定済み", 12, 700, C.success);
  await txt(decCol, "鳥貴族 新宿東口店", 15, 600, C.text1);

  // Area tabs
  const areaTabs = af(results, "AreaTabs", {
    w: 350, x: 20, y: 186, layout: "HORIZONTAL", gap: 8,
  });
  for (const [area, sel] of [["すべて", true], ["新宿", false], ["六本木", false]]) {
    const t = af(areaTabs, area, {
      h: 36, corner: 100,
      fills: sel ? rgb(C.secondary) : rgb(C.surface),
      layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 18, pr: 18,
    });
    if (!sel) { t.strokes = rgb(C.border); t.strokeWeight = 1; }
    await txt(t, area, 14, sel ? 600 : 400, sel ? "#FFFFFF" : C.text2);
  }

  // Sort toggle
  const sortRow = af(results, "SortRow", {
    w: 350, x: 20, y: 236, layout: "HORIZONTAL", mainAlign: "SPACE_BETWEEN", crossAlign: "CENTER",
  });
  await txt(sortRow, "8件の結果", 13, 400, C.text3);

  const sortToggle = af(sortRow, "SortToggle", {
    h: 36, corner: 100, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", gap: 0, pt: 4, pb: 4, pl: 4, pr: 4,
  });
  const sortMatch = af(sortToggle, "SortMatch", {
    h: 28, corner: 100, fills: rgb(C.surface),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 14, pr: 14,
    shadow: shadow(0, 1, 2, 0, 0.06),
  });
  await txt(sortMatch, "一致度", 13, 600, C.text1);
  const sortRate = af(sortToggle, "SortRate", {
    h: 28, corner: 100,
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 14, pr: 14,
  });
  await txt(sortRate, "評価", 13, 400, C.text3);

  // Restaurant Cards
  let ry = 290;
  const restaurants = [
    { name: "鳥貴族 新宿東口店", genre: "居酒屋", budget: "2000〜3000円", score: 0.92, rating: 4.2, access: "新宿駅 徒歩3分", genreColor: "#6E6E7A", hasPrivateRoom: true },
    { name: "AFURI 六本木ヒルズ", genre: "ラーメン", budget: "1000〜2000円", score: 0.85, rating: 4.5, access: "六本木駅 徒歩2分", genreColor: "#C26A4A", hasPrivateRoom: false },
    { name: "叙々苑 新宿小田急店", genre: "焼肉", budget: "5000〜8000円", score: 0.78, rating: 4.3, access: "新宿駅 徒歩1分", genreColor: "#B33A3A", hasPrivateRoom: true },
  ];

  for (const r of restaurants) {
    const rc = card(results, r.name, {
      w: 350, x: 20, y: ry, corner: 20,
      layout: "VERTICAL", gap: 0,
    });

    // Genre accent bar
    const bar = figma.createRectangle();
    bar.resize(350, 4); bar.fills = rgb(r.genreColor, 0.6);
    bar.cornerRadius = 0;
    bar.topLeftRadius = 20; bar.topRightRadius = 20;
    bar.layoutAlign = "STRETCH";
    rc.appendChild(bar);

    // Card content
    const content = af(rc, "Content", {
      w: 350, layout: "VERTICAL", gap: 12, pl: 18, pr: 18, pt: 16, pb: 16,
    });
    content.layoutAlign = "STRETCH";

    // Name + score badge
    const nameRow = af(content, "NameRow", {
      w: 314, layout: "HORIZONTAL", mainAlign: "SPACE_BETWEEN", crossAlign: "MIN", gap: 8,
    });
    nameRow.layoutAlign = "STRETCH";
    const nameTxt = await txt(nameRow, r.name, 17, 700, C.text1, { w: 240 });
    nameTxt.layoutGrow = 1;

    const scorePct = Math.round(r.score * 100);
    const scoreColor = r.score >= 0.8 ? C.primary : r.score >= 0.6 ? C.warning : C.text3;
    const scoreBadge = af(nameRow, "ScoreBadge", {
      h: 24, corner: 100, fills: rgb(scoreColor),
      layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 10, pr: 10,
    });
    await txt(scoreBadge, scorePct + "%", 11, 700, "#FFFFFF");

    // Chips row
    const chipsRow = af(content, "Chips", {
      w: 314, layout: "HORIZONTAL", gap: 6,
    });
    chipsRow.layoutAlign = "STRETCH";
    chipsRow.layoutWrap = "WRAP";

    for (const label of [r.genre, r.budget]) {
      const c = af(chipsRow, label, {
        h: 28, corner: 100, fills: rgb(C.bgSec),
        layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 12, pr: 12,
      });
      await txt(c, label, 12, 500, C.text2);
    }
    if (r.hasPrivateRoom) {
      const prChip = af(chipsRow, "個室", {
        h: 28, corner: 8, fills: rgb(C.secondary, 0.06),
        layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 10, pr: 10,
      });
      await txt(prChip, "個室あり", 12, 500, C.secondary);
    }

    // Match score bar
    const matchSection = af(content, "MatchSection", { w: 314, layout: "VERTICAL", gap: 4 });
    matchSection.layoutAlign = "STRETCH";
    await txt(matchSection, "一致度", 12, 500, C.text2);

    const barRow = af(matchSection, "BarRow", {
      w: 314, layout: "HORIZONTAL", crossAlign: "CENTER", gap: 8,
    });
    barRow.layoutAlign = "STRETCH";

    const barBg = af(barRow, "BarBg", { w: 260, h: 8, corner: 8, fills: rgb("#F0F0EC") });
    barBg.layoutGrow = 1;
    const barFill = figma.createRectangle();
    barFill.resize(260 * r.score, 8); barFill.cornerRadius = 8; barFill.fills = rgb(scoreColor);
    barBg.appendChild(barFill);

    await txt(barRow, scorePct + "%", 13, 600, scoreColor, { w: 40, align: "RIGHT" });

    // Rating + access
    const bottomRow = af(content, "Bottom", {
      w: 314, layout: "HORIZONTAL", mainAlign: "SPACE_BETWEEN", crossAlign: "CENTER",
    });
    bottomRow.layoutAlign = "STRETCH";

    const stars = af(bottomRow, "Stars", { layout: "HORIZONTAL", crossAlign: "CENTER", gap: 4 });
    for (let i = 1; i <= 5; i++) {
      const star = figma.createRectangle();
      star.resize(12, 12); star.cornerRadius = 2;
      star.fills = rgb(C.warning, i <= Math.floor(r.rating) ? 1 : 0.2);
      stars.appendChild(star);
    }
    await txt(stars, r.rating.toFixed(1), 13, 600, C.warning);

    await txt(bottomRow, r.access, 12, 400, C.text2, { align: "RIGHT" });

    ry += rc.height + 14;
  }

  // ════════════════════════════════════════════════════════════
  // 12. RESULTS – Confirm Dialog Overlay
  // ════════════════════════════════════════════════════════════
  const confirmDlg = af(page, "ConfirmDialog", { w: W, h: H, fills: rgb("#000000", 0.5), x: cx }); cx += W + GAP;

  // Dialog card (centered)
  const dlg = card(confirmDlg, "Dialog", {
    w: 320, x: 35, y: 300, corner: 24,
    layout: "VERTICAL", crossAlign: "CENTER", gap: 16, pad: 28,
  });

  // Warning icon
  const warnCircle = af(dlg, "WarnIcon", {
    w: 48, h: 48, corner: 100, fills: rgb(C.danger, 0.1),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(warnCircle, "⚠", 20, 400, C.danger);

  await txt(dlg, "グループを削除しますか？", 18, 700, C.text1, { align: "CENTER", w: 264 });
  await txt(dlg, "この操作は取り消せません。\nグループのすべてのデータが削除されます。", 14, 400, C.text2, { align: "CENTER", w: 264 });

  // Buttons
  const dlgBtns = af(dlg, "Buttons", {
    w: 264, layout: "HORIZONTAL", gap: 10,
  });
  dlgBtns.layoutAlign = "STRETCH";

  const cancelBtn = af(dlgBtns, "Cancel", {
    h: 48, corner: 100, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  cancelBtn.layoutGrow = 1;
  await txt(cancelBtn, "キャンセル", 15, 600, C.text2, { align: "CENTER" });

  const delBtn = af(dlgBtns, "Delete", {
    h: 48, corner: 100, fills: rgb(C.danger),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  delBtn.layoutGrow = 1;
  await txt(delBtn, "削除する", 15, 600, "#FFFFFF", { align: "CENTER" });

  // ════════════════════════════════════════════════════════════
  // 13. INVITE PAGE
  // ════════════════════════════════════════════════════════════
  const invite = af(page, "Invite", { w: W, h: H, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  // Logo
  await txt(invite, "MeshiMatch", 22, 700, C.text1, { x: 0, y: 40, w: W, align: "CENTER" });

  // Invite card
  const invCard = card(invite, "InviteCard", {
    w: 350, x: 20, y: 100, corner: 24,
    layout: "VERTICAL", crossAlign: "CENTER", gap: 20, pad: 32,
    strokes: rgb(C.border, 0.5), strokeW: 1,
  });

  await txt(invCard, "グループに招待されました", 13, 400, C.text3, { align: "CENTER" });
  await txt(invCard, "金曜ランチ会", 22, 700, C.primary, { align: "CENTER" });
  await txt(invCard, "4人が参加中", 14, 400, C.text2, { align: "CENTER" });

  // Info box
  const infoBox = af(invCard, "InfoBox", {
    w: 286, corner: 14, fills: rgb(C.primary, 0.06),
    layout: "VERTICAL", crossAlign: "CENTER", gap: 8, pad: 18,
  });
  infoBox.layoutAlign = "STRETCH";
  await txt(infoBox, "アンケートに答えてね", 13, 700, C.primary, { align: "CENTER" });
  await txt(infoBox, "好きなジャンルや気分を答えると、\nAIがみんなに合うお店を提案します", 13, 400, C.text2, { align: "CENTER", w: 250 });

  await pill(invCard, "JoinBtn", 286, 52, C.primary, "アンケートに答える →", 16, "#FFFFFF", 600);
  await txt(invCard, "ログインが必要です", 12, 400, C.text3, { align: "CENTER" });

  // ════════════════════════════════════════════════════════════
  // 14. NOTIFICATIONS BOTTOM SHEET
  // ════════════════════════════════════════════════════════════
  const notif = af(page, "Notifications Sheet", { w: W, h: H, fills: rgb("#000000", 0.5), x: cx }); cx += W + GAP;

  // Sheet
  const sheet = af(notif, "Sheet", {
    w: W, h: 560, x: 0, y: H - 560,
    fills: rgb(C.surface), corner: 24,
    layout: "VERTICAL", gap: 16, pl: 20, pr: 20, pt: 12, pb: 24,
  });
  // Only top corners rounded
  sheet.topLeftRadius = 24; sheet.topRightRadius = 24;
  sheet.bottomLeftRadius = 0; sheet.bottomRightRadius = 0;

  // Drag handle
  const handle = af(sheet, "Handle", { w: 40, h: 4, corner: 4, fills: rgb(C.border) });
  handle.layoutAlign = "CENTER";

  // Header row
  const notifHeader = af(sheet, "NotifHeader", {
    w: 350, layout: "HORIZONTAL", mainAlign: "SPACE_BETWEEN", crossAlign: "CENTER",
  });
  notifHeader.layoutAlign = "STRETCH";
  await txt(notifHeader, "通知", 20, 700, C.text1);
  const closeN = af(notifHeader, "Close", {
    w: 32, h: 32, corner: 100, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(closeN, "×", 16, 400, C.text2);

  // Invitation card 1
  const inv1 = af(sheet, "Invitation1", {
    w: 350, layout: "VERTICAL", gap: 12,
  });
  inv1.layoutAlign = "STRETCH";

  const invRow1 = af(inv1, "InviterRow", {
    w: 350, layout: "HORIZONTAL", crossAlign: "CENTER", gap: 10,
  });
  invRow1.layoutAlign = "STRETCH";
  avatar(invRow1, "T", "#6B7A52", 40);
  const invInfo = af(invRow1, "Info", { layout: "VERTICAL", gap: 2 });
  invInfo.layoutGrow = 1;

  // Name + text composite
  const invLine = af(invInfo, "Line", { layout: "HORIZONTAL", gap: 4 });
  await txt(invLine, "たかし", 14, 600, C.primary);
  await txt(invLine, "さんからの招待", 14, 400, C.text1);
  await txt(invInfo, "2時間前", 12, 400, C.text3);

  // Group info box
  const grpInfo = af(inv1, "GroupInfo", {
    w: 350, corner: 12, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", crossAlign: "CENTER", gap: 8, pad: 14,
  });
  grpInfo.layoutAlign = "STRETCH";
  await txt(grpInfo, "🍽", 16, 400, C.text2);
  const grpDetail = af(grpInfo, "Detail", { layout: "VERTICAL", gap: 2 });
  grpDetail.layoutGrow = 1;
  await txt(grpDetail, "金曜ランチ会", 14, 600, C.text1);
  await txt(grpDetail, "4人のメンバー", 12, 400, C.text2);

  await pill(inv1, "JoinBtn1", 350, 46, C.primary, "参加してアンケートに回答する", 14, "#FFFFFF", 600);
  const jb1 = inv1.children[inv1.children.length - 1];
  jb1.layoutAlign = "STRETCH";

  // Divider
  const divN = figma.createRectangle();
  divN.resize(350, 1); divN.fills = rgb(C.border, 0.3);
  divN.layoutAlign = "STRETCH";
  sheet.appendChild(divN);

  // Invitation card 2
  const inv2 = af(sheet, "Invitation2", {
    w: 350, layout: "VERTICAL", gap: 12,
  });
  inv2.layoutAlign = "STRETCH";

  const invRow2 = af(inv2, "InviterRow", {
    w: 350, layout: "HORIZONTAL", crossAlign: "CENTER", gap: 10,
  });
  invRow2.layoutAlign = "STRETCH";
  avatar(invRow2, "M", "#4A6B9A", 40);
  const invInfo2 = af(invRow2, "Info", { layout: "VERTICAL", gap: 2 });
  invInfo2.layoutGrow = 1;

  const invLine2 = af(invInfo2, "Line", { layout: "HORIZONTAL", gap: 4 });
  await txt(invLine2, "みさき", 14, 600, C.primary);
  await txt(invLine2, "さんからの招待", 14, 400, C.text1);
  await txt(invInfo2, "1日前", 12, 400, C.text3);

  const grpInfo2 = af(inv2, "GroupInfo2", {
    w: 350, corner: 12, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", crossAlign: "CENTER", gap: 8, pad: 14,
  });
  grpInfo2.layoutAlign = "STRETCH";
  await txt(grpInfo2, "🍽", 16, 400, C.text2);
  const grpDetail2 = af(grpInfo2, "Detail2", { layout: "VERTICAL", gap: 2 });
  grpDetail2.layoutGrow = 1;
  await txt(grpDetail2, "チーム飲み会", 14, 600, C.text1);
  await txt(grpDetail2, "6人のメンバー", 12, 400, C.text2);

  await pill(inv2, "JoinBtn2", 350, 46, C.primary, "参加してアンケートに回答する", 14, "#FFFFFF", 600);
  const jb2 = inv2.children[inv2.children.length - 1];
  jb2.layoutAlign = "STRETCH";

  // ════════════════════════════════════════════════════════════
  // 15. SURVEY COMPLETE / SUBMITTING
  // ════════════════════════════════════════════════════════════
  const complete = af(page, "Survey Complete", { w: W, h: H, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  const compCenter = af(complete, "Center", {
    w: W, h: H, layout: "VERTICAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 20,
  });

  // Success circle
  const successCircle = af(compCenter, "SuccessCircle", {
    w: 80, h: 80, corner: 100, fills: rgb(C.success, 0.12),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(successCircle, "✓", 36, 700, C.success);

  await txt(compCenter, "回答完了！", 24, 700, C.text1, { align: "CENTER" });
  await txt(compCenter, "みんなの回答を待っています...", 15, 400, C.text2, { align: "CENTER" });

  // Spinner + redirect text
  const spinRow = af(compCenter, "Spin", {
    layout: "HORIZONTAL", crossAlign: "CENTER", gap: 8,
  });
  const spinner = figma.createEllipse();
  spinner.resize(20, 20);
  spinner.fills = [];
  spinner.strokes = rgb(C.border);
  spinner.strokeWeight = 3;
  spinner.arcData = { startingAngle: 0, endingAngle: 4.71, innerRadius: 0.7 };
  spinRow.appendChild(spinner);
  await txt(spinRow, "待機室に移動中...", 14, 400, C.text2);

  figma.notify("✅ Part 3 complete: Searching, Results, ConfirmDialog, Invite, Notifications, SurveyComplete");
})();
