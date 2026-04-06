// ============================================================
// MeshiMatch Figma UI – Part 1: Auth Screens + Home
// ============================================================
// Figma Plugin Console で実行してください
// Plugins > Development > Open Console > paste & run
// ============================================================

// ── Helpers ──────────────────────────────────────────────────
function rgb(hex, op) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [{ type: "SOLID", color: { r, g, b }, opacity: op !== undefined ? op : 1 }];
}

function shadow(ox, oy, blur, spread, a) {
  return [{
    type: "DROP_SHADOW", visible: true, blendMode: "NORMAL",
    color: { r: 0, g: 0, b: 0, a: a || 0.08 },
    offset: { x: ox, y: oy }, radius: blur, spread: spread || 0,
  }];
}

const FONTS = {};
async function loadFont(style) {
  const key = style;
  if (!FONTS[key]) {
    await figma.loadFontAsync({ family: "Inter", style });
    FONTS[key] = true;
  }
}

function fontStyle(w) {
  return w >= 700 ? "Bold" : w >= 600 ? "Semi Bold" : w >= 500 ? "Medium" : "Regular";
}

async function txt(parent, text, size, weight, color, opts) {
  const style = fontStyle(weight);
  await loadFont(style);
  const t = figma.createText();
  t.characters = text;
  t.fontSize = size;
  t.fontName = { family: "Inter", style };
  t.fills = rgb(color);
  if (opts?.w) { t.resize(opts.w, t.height); t.textAutoResize = "HEIGHT"; }
  if (opts?.align) t.textAlignHorizontal = opts.align;
  if (opts?.x !== undefined) t.x = opts.x;
  if (opts?.y !== undefined) t.y = opts.y;
  if (opts?.lineHeight) t.lineHeight = { value: opts.lineHeight, unit: "PIXELS" };
  parent.appendChild(t);
  return t;
}

function autoFrame(parent, name, opts) {
  const f = figma.createFrame();
  f.name = name;
  if (opts.w && opts.h) f.resize(opts.w, opts.h);
  if (opts.fills) f.fills = opts.fills;
  else f.fills = [];
  if (opts.corner) f.cornerRadius = opts.corner;
  if (opts.layout) {
    f.layoutMode = opts.layout;
    f.primaryAxisAlignItems = opts.mainAlign || "MIN";
    f.counterAxisAlignItems = opts.crossAlign || "MIN";
    if (opts.gap !== undefined) f.itemSpacing = opts.gap;
    if (opts.pt !== undefined) f.paddingTop = opts.pt;
    if (opts.pb !== undefined) f.paddingBottom = opts.pb;
    if (opts.pl !== undefined) f.paddingLeft = opts.pl;
    if (opts.pr !== undefined) f.paddingRight = opts.pr;
    if (opts.pad !== undefined) {
      f.paddingTop = opts.pad; f.paddingBottom = opts.pad;
      f.paddingLeft = opts.pad; f.paddingRight = opts.pad;
    }
  }
  if (opts.shadow) f.effects = opts.shadow;
  if (opts.x !== undefined) f.x = opts.x;
  if (opts.y !== undefined) f.y = opts.y;
  if (opts.grow) f.layoutGrow = 1;
  if (opts.alignSelf) f.layoutAlign = opts.alignSelf;
  parent.appendChild(f);
  return f;
}

function circle(parent, size, fillHex, op) {
  const e = figma.createEllipse();
  e.resize(size, size);
  e.fills = rgb(fillHex, op);
  parent.appendChild(e);
  return e;
}

function pill(parent, name, w, h, fillHex, textStr, textSize, textColor, textWeight) {
  const f = autoFrame(parent, name, {
    w, h, fills: rgb(fillHex), corner: 100,
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  return txt(f, textStr, textSize, textWeight || 600, textColor, { align: "CENTER" }).then(() => f);
}

function glassInput(parent, w, placeholder) {
  const f = autoFrame(parent, placeholder, {
    w, h: 50, corner: 12,
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.06 }],
    layout: "HORIZONTAL", crossAlign: "CENTER", pl: 16, pr: 16,
  });
  f.layoutAlign = "STRETCH";
  return txt(f, placeholder, 14, 400, "#666680").then(() => f);
}

function card(parent, name, opts) {
  return autoFrame(parent, name, {
    ...opts,
    fills: rgb("#FFFFFF"),
    corner: opts?.corner || 20,
    shadow: shadow(0, 1, 3, 0, 0.04).concat([{
      type: "DROP_SHADOW", visible: true, blendMode: "NORMAL",
      color: { r: 0, g: 0, b: 0, a: 0.02 },
      offset: { x: 0, y: 4 }, radius: 12, spread: 0,
    }]),
  });
}

function bottomNav(parent, activeTab) {
  const nav = autoFrame(parent, "BottomNav", {
    w: 390, h: 80, fills: rgb("#FFFFFF"),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 80,
    pt: 10, pb: 20, pl: 40, pr: 40,
  });
  nav.effects = [{
    type: "DROP_SHADOW", visible: true, blendMode: "NORMAL",
    color: { r: 0, g: 0, b: 0, a: 0.05 },
    offset: { x: 0, y: -1 }, radius: 8, spread: 0,
  }];
  nav.layoutAlign = "STRETCH";

  const tabs = [["ホーム", activeTab === "home"], ["プロフィール", activeTab === "profile"]];
  for (const [label, active] of tabs) {
    const tab = autoFrame(nav, label, {
      w: 60, h: 50, layout: "VERTICAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 4,
    });
    const icon = circle(tab, 28, active ? "#C26A4A" : "#A0A0AC", active ? 0.12 : 0.08);
    icon.layoutAlign = "INHERIT";
    txt(tab, label, 10, active ? 600 : 400, active ? "#C26A4A" : "#A0A0AC", { align: "CENTER" });
  }
  return nav;
}

// ── COLORS ──
const C = {
  primary: "#C26A4A", secondary: "#1A1A2E", bg: "#F7F6F3", bgSec: "#EFEEE9",
  surface: "#FFFFFF", text1: "#1A1A2E", text2: "#6E6E7A", text3: "#A0A0AC",
  border: "#E8E8E4", warning: "#E8B944", danger: "#B33A3A", success: "#3D8B5E",
};

// ══════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════
(async () => {
  let page = figma.root.children.find(p => p.name === "UI Screens");
  if (!page) { page = figma.createPage(); page.name = "UI Screens"; }
  await figma.setCurrentPageAsync(page);
  // Clear old
  page.children.forEach(c => c.remove());

  const W = 390, H = 844, GAP = 60;
  let cx = 0;

  function nextX() { const x = cx; cx += W + GAP; return x; }

  // ════════════════════════════════════════════════════════════
  // 1. LOGIN
  // ════════════════════════════════════════════════════════════
  const login = autoFrame(page, "Login", { w: W, h: H, fills: rgb(C.secondary), x: nextX() });

  const lc = autoFrame(login, "LoginCard", {
    w: 350, h: 420, x: 20, y: 200, corner: 24,
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.08 }],
    shadow: shadow(0, 4, 24, 0, 0.15),
    layout: "VERTICAL", crossAlign: "CENTER", gap: 20, pad: 32, pt: 40, pb: 40,
  });

  await txt(lc, "ログイン", 24, 700, "#FFFFFF", { align: "CENTER", w: 286 });
  await txt(lc, "MeshiMatchへようこそ", 14, 400, "#FFFFFFAA", { align: "CENTER", w: 286 });
  await glassInput(lc, 286, "you@example.com");
  await glassInput(lc, 286, "••••••");
  await pill(lc, "LoginBtn", 286, 52, C.primary, "ログイン", 16, "#FFFFFF", 600);
  await txt(lc, "アカウントをお持ちでない方はこちら", 13, 400, "#9999AA", { align: "CENTER", w: 286 });

  // ════════════════════════════════════════════════════════════
  // 2. SIGNUP
  // ════════════════════════════════════════════════════════════
  const signup = autoFrame(page, "Signup", { w: W, h: H, fills: rgb(C.secondary), x: nextX() });

  const sc = autoFrame(signup, "SignupCard", {
    w: 350, h: 540, x: 20, y: 140, corner: 24,
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.08 }],
    shadow: shadow(0, 4, 24, 0, 0.15),
    layout: "VERTICAL", crossAlign: "CENTER", gap: 12, pl: 32, pr: 32, pt: 36, pb: 36,
  });

  await txt(sc, "新規登録", 24, 700, "#FFFFFF", { align: "CENTER", w: 286 });
  await txt(sc, "MeshiMatchを始めよう", 14, 400, "#FFFFFFAA", { align: "CENTER", w: 286 });

  for (const [label, ph] of [["表示名", "あなたの名前"], ["メールアドレス", "you@example.com"], ["パスワード", "••••••"]]) {
    await txt(sc, label, 13, 500, "#CCCCDD", { w: 286 });
    await glassInput(sc, 286, ph);
  }

  await pill(sc, "SignupBtn", 286, 52, C.primary, "登録する", 16, "#FFFFFF", 600);
  await txt(sc, "すでにアカウントをお持ちの方", 13, 400, "#9999AA", { align: "CENTER", w: 286 });

  // ════════════════════════════════════════════════════════════
  // 3. HOME
  // ════════════════════════════════════════════════════════════
  const home = autoFrame(page, "Home", { w: W, h: H, fills: rgb(C.bg), x: nextX() });

  // Header
  await txt(home, "こんにちは、ゆうたさん", 26, 700, C.text1, { x: 20, y: 60, w: 300 });

  // Notification bell
  const bell = autoFrame(home, "NotifBell", {
    w: 44, h: 44, x: 326, y: 56, corner: 100,
    fills: rgb(C.surface),
    shadow: shadow(0, 1, 4, 0, 0.06),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  bell.strokes = rgb(C.border);
  bell.strokeWeight = 1;
  await txt(bell, "🔔", 18, 400, C.text2);

  // Badge
  const badge = circle(home, 18, C.danger);
  badge.x = 354; badge.y = 50;
  await txt(home, "2", 10, 700, "#FFFFFF", { x: 359, y: 53 });

  // CTA Card
  const cta = card(home, "CTACard", {
    w: 350, h: 80, x: 20, y: 120, corner: 20,
    layout: "HORIZONTAL", crossAlign: "CENTER", gap: 14, pl: 16, pr: 16, pt: 16, pb: 16,
  });

  const ctaIcon = autoFrame(cta, "CTAIcon", {
    w: 48, h: 48, corner: 14, fills: rgb(C.primary, 0.1),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(ctaIcon, "🍽", 20, 400, C.primary);

  const ctaText = autoFrame(cta, "CTAText", {
    w: 220, layout: "VERTICAL", gap: 4,
  });
  ctaText.layoutGrow = 1;
  await txt(ctaText, "グループを作ろう", 16, 700, C.text1);
  await txt(ctaText, "みんなで行くお店をAIが提案", 13, 400, C.text2);

  await txt(cta, "→", 18, 400, C.text3);

  // Section: 進行中のグループ
  await txt(home, "進行中のグループ", 18, 700, C.text1, { x: 20, y: 224 });

  // Group Card 1
  const gc1 = card(home, "GroupCard1", {
    w: 350, h: 140, x: 20, y: 260, corner: 20,
    layout: "VERTICAL", gap: 10, pad: 18,
  });

  // Card header row
  const gcHeader = autoFrame(gc1, "GCHeader", {
    w: 314, layout: "HORIZONTAL", mainAlign: "MIN", crossAlign: "CENTER", gap: 8,
  });
  gcHeader.layoutAlign = "STRETCH";
  await txt(gcHeader, "金曜ランチ会", 17, 700, C.text1);
  const statusBadge = autoFrame(gcHeader, "Status", {
    h: 24, corner: 100, fills: rgb(C.success, 0.1),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 10, pr: 10,
  });
  await txt(statusBadge, "回答中", 11, 600, C.success);

  // Card meta row
  const gcMeta = autoFrame(gc1, "GCMeta", {
    w: 314, layout: "HORIZONTAL", gap: 12, crossAlign: "CENTER",
  });
  gcMeta.layoutAlign = "STRETCH";
  await txt(gcMeta, "4人のメンバー", 13, 400, C.text2);
  await txt(gcMeta, "2025/03/28", 13, 400, C.text3);

  // Avatar stack
  const avatarRow = autoFrame(gc1, "Avatars", {
    w: 314, layout: "HORIZONTAL", gap: -8,
  });
  avatarRow.layoutAlign = "STRETCH";
  const avatarColors = ["#C26A4A", "#6B7A52", "#4A6B9A", "#9A4A6B"];
  const avatarInitials = ["Y", "T", "K", "S"];
  for (let i = 0; i < 4; i++) {
    const av = autoFrame(avatarRow, "av" + i, {
      w: 32, h: 32, corner: 100, fills: rgb(avatarColors[i]),
      layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
    });
    av.strokes = rgb(C.surface);
    av.strokeWeight = 2;
    await txt(av, avatarInitials[i], 13, 700, "#FFFFFF");
  }

  // Group Card 2
  const gc2 = card(home, "GroupCard2", {
    w: 350, h: 140, x: 20, y: 414, corner: 20,
    layout: "VERTICAL", gap: 10, pad: 18,
  });
  const gc2Header = autoFrame(gc2, "GC2Header", {
    w: 314, layout: "HORIZONTAL", crossAlign: "CENTER", gap: 8,
  });
  gc2Header.layoutAlign = "STRETCH";
  await txt(gc2Header, "チーム飲み会", 17, 700, C.text1);
  const statusBadge2 = autoFrame(gc2Header, "Status2", {
    h: 24, corner: 100, fills: rgb(C.primary, 0.1),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 10, pr: 10,
  });
  await txt(statusBadge2, "結果あり", 11, 600, C.primary);

  const gc2Meta = autoFrame(gc2, "GC2Meta", {
    w: 314, layout: "HORIZONTAL", gap: 12, crossAlign: "CENTER",
  });
  gc2Meta.layoutAlign = "STRETCH";
  await txt(gc2Meta, "6人のメンバー", 13, 400, C.text2);
  await txt(gc2Meta, "2025/03/25", 13, 400, C.text3);

  const avRow2 = autoFrame(gc2, "Avatars2", { w: 314, layout: "HORIZONTAL", gap: -8 });
  avRow2.layoutAlign = "STRETCH";
  for (let i = 0; i < 4; i++) {
    const av = autoFrame(avRow2, "av" + i, {
      w: 32, h: 32, corner: 100, fills: rgb(avatarColors[i]),
      layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
    });
    av.strokes = rgb(C.surface); av.strokeWeight = 2;
    await txt(av, avatarInitials[i], 13, 700, "#FFFFFF");
  }
  const extra = autoFrame(avRow2, "extra", {
    w: 32, h: 32, corner: 100, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  extra.strokes = rgb(C.surface); extra.strokeWeight = 2;
  await txt(extra, "+2", 11, 600, C.text2);

  // Empty state hint
  await txt(home, "非表示のグループ (1)", 14, 500, C.text2, { x: 20, y: 572 });

  // Bottom Nav
  bottomNav(home, "home");
  const nav = home.children[home.children.length - 1];
  nav.x = 0; nav.y = H - 80;

  // ════════════════════════════════════════════════════════════
  // 4. HOME – EMPTY STATE
  // ════════════════════════════════════════════════════════════
  const homeEmpty = autoFrame(page, "Home (Empty)", { w: W, h: H, fills: rgb(C.bg), x: nextX() });

  await txt(homeEmpty, "こんにちは、ゆうたさん", 26, 700, C.text1, { x: 20, y: 60, w: 300 });

  // CTA
  const cta2 = card(homeEmpty, "CTACard", {
    w: 350, h: 80, x: 20, y: 120, corner: 20,
    layout: "HORIZONTAL", crossAlign: "CENTER", gap: 14, pl: 16, pr: 16, pt: 16, pb: 16,
  });
  const ctaI2 = autoFrame(cta2, "CTAIcon", {
    w: 48, h: 48, corner: 14, fills: rgb(C.primary, 0.1),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(ctaI2, "🍽", 20, 400, C.primary);
  const ctaT2 = autoFrame(cta2, "CTAText", { w: 220, layout: "VERTICAL", gap: 4 });
  ctaT2.layoutGrow = 1;
  await txt(ctaT2, "グループを作ろう", 16, 700, C.text1);
  await txt(ctaT2, "みんなで行くお店をAIが提案", 13, 400, C.text2);
  await txt(cta2, "→", 18, 400, C.text3);

  // Empty section
  const emptyBox = autoFrame(homeEmpty, "EmptyState", {
    w: 350, x: 20, y: 280,
    layout: "VERTICAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 12, pad: 40,
  });
  circle(emptyBox, 48, C.bgSec);
  await txt(emptyBox, "グループがありません", 16, 600, C.text2, { align: "CENTER" });
  await txt(emptyBox, "「グループを作ろう」から始めてみましょう", 14, 400, C.text3, { align: "CENTER", w: 280 });

  bottomNav(homeEmpty, "home");
  const nav2 = homeEmpty.children[homeEmpty.children.length - 1];
  nav2.x = 0; nav2.y = H - 80;

  figma.notify("✅ Part 1 complete: Login, Signup, Home, Home(Empty)");
})();
