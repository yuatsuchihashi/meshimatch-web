// ============================================================
// MeshiMatch Figma UI – Part 2: Profile + Group Flow
// ============================================================
// Part 1を実行してから、このスクリプトを実行してください
// ============================================================

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
  if (!FONTS[style]) { await figma.loadFontAsync({ family: "Inter", style }); FONTS[style] = true; }
}
function fontStyle(w) {
  return w >= 700 ? "Bold" : w >= 600 ? "Semi Bold" : w >= 500 ? "Medium" : "Regular";
}
async function txt(parent, text, size, weight, color, opts) {
  const style = fontStyle(weight);
  await loadFont(style);
  const t = figma.createText();
  t.characters = text; t.fontSize = size;
  t.fontName = { family: "Inter", style }; t.fills = rgb(color);
  if (opts?.w) { t.resize(opts.w, t.height); t.textAutoResize = "HEIGHT"; }
  if (opts?.align) t.textAlignHorizontal = opts.align;
  if (opts?.x !== undefined) t.x = opts.x;
  if (opts?.y !== undefined) t.y = opts.y;
  parent.appendChild(t);
  return t;
}

function af(parent, name, opts) {
  const f = figma.createFrame(); f.name = name;
  if (opts.w && opts.h) f.resize(opts.w, opts.h);
  if (opts.fills) f.fills = opts.fills; else f.fills = [];
  if (opts.corner) f.cornerRadius = opts.corner;
  if (opts.layout) {
    f.layoutMode = opts.layout;
    f.primaryAxisAlignItems = opts.mainAlign || "MIN";
    f.counterAxisAlignItems = opts.crossAlign || "MIN";
    if (opts.gap !== undefined) f.itemSpacing = opts.gap;
    if (opts.pad !== undefined) { f.paddingTop = opts.pad; f.paddingBottom = opts.pad; f.paddingLeft = opts.pad; f.paddingRight = opts.pad; }
    if (opts.pt !== undefined) f.paddingTop = opts.pt;
    if (opts.pb !== undefined) f.paddingBottom = opts.pb;
    if (opts.pl !== undefined) f.paddingLeft = opts.pl;
    if (opts.pr !== undefined) f.paddingRight = opts.pr;
  }
  if (opts.shadow) f.effects = opts.shadow;
  if (opts.x !== undefined) f.x = opts.x;
  if (opts.y !== undefined) f.y = opts.y;
  if (opts.strokes) { f.strokes = opts.strokes; f.strokeWeight = opts.strokeW || 1; }
  if (opts.alignSelf) f.layoutAlign = opts.alignSelf;
  parent.appendChild(f);
  return f;
}

function card(parent, name, opts) {
  return af(parent, name, {
    ...opts, fills: rgb("#FFFFFF"), corner: opts?.corner || 20,
    shadow: shadow(0, 1, 3, 0, 0.04).concat([{
      type: "DROP_SHADOW", visible: true, blendMode: "NORMAL",
      color: { r: 0, g: 0, b: 0, a: 0.02 }, offset: { x: 0, y: 4 }, radius: 12, spread: 0,
    }]),
  });
}

function pill(parent, name, w, h, fillHex, textStr, textSize, textColor, textWeight) {
  const f = af(parent, name, {
    w, h, fills: rgb(fillHex), corner: 100,
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  return txt(f, textStr, textSize, textWeight || 600, textColor, { align: "CENTER" }).then(() => f);
}

function chip(parent, label, selected) {
  const bg = selected ? "#1A1A2E" : "#EFEEE9";
  const tc = selected ? "#FFFFFF" : "#6E6E7A";
  const f = af(parent, "chip-" + label, {
    h: 34, fills: rgb(bg), corner: 100,
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 16, pr: 16, pt: 8, pb: 8,
  });
  txt(f, label, 13, 500, tc);
  return f;
}

function avatar(parent, initial, color, size) {
  const a = af(parent, "avatar-" + initial, {
    w: size || 36, h: size || 36, corner: 100, fills: rgb(color),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  txt(a, initial, (size || 36) * 0.4, 700, "#FFFFFF");
  return a;
}

function bottomNav(parent, activeTab, yPos) {
  const nav = af(parent, "BottomNav", {
    w: 390, h: 80, x: 0, y: yPos, fills: rgb("#FFFFFF"),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 80,
    pt: 10, pb: 20, pl: 40, pr: 40,
  });
  nav.effects = [{ type: "DROP_SHADOW", visible: true, blendMode: "NORMAL", color: { r: 0, g: 0, b: 0, a: 0.05 }, offset: { x: 0, y: -1 }, radius: 8, spread: 0 }];
  const tabs = [["ホーム", "home"], ["プロフィール", "profile"]];
  for (const [label, key] of tabs) {
    const active = key === activeTab;
    const tab = af(nav, label, { w: 60, h: 50, layout: "VERTICAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 4 });
    const ic = figma.createEllipse(); ic.resize(28, 28);
    ic.fills = rgb(active ? "#C26A4A" : "#A0A0AC", active ? 0.12 : 0.08);
    tab.appendChild(ic);
    txt(tab, label, 10, active ? 600 : 400, active ? "#C26A4A" : "#A0A0AC", { align: "CENTER" });
  }
  return nav;
}

const C = {
  primary: "#C26A4A", secondary: "#1A1A2E", bg: "#F7F6F3", bgSec: "#EFEEE9",
  surface: "#FFFFFF", text1: "#1A1A2E", text2: "#6E6E7A", text3: "#A0A0AC",
  border: "#E8E8E4", warning: "#E8B944", danger: "#B33A3A", success: "#3D8B5E",
};

(async () => {
  const page = figma.root.children.find(p => p.name === "UI Screens");
  if (!page) { figma.notify("❌ UI Screens page not found. Run Part 1 first."); return; }
  await figma.setCurrentPageAsync(page);

  const W = 390, H = 844, GAP = 60;
  // Find rightmost element to continue placement
  let cx = 0;
  page.children.forEach(c => { cx = Math.max(cx, c.x + c.width + GAP); });

  // ════════════════════════════════════════════════════════════
  // 5. PROFILE
  // ════════════════════════════════════════════════════════════
  const prof = af(page, "Profile", { w: W, h: H, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  // Navy hero header
  const hero = af(prof, "Hero", {
    w: W, h: 200, fills: rgb(C.secondary),
    layout: "VERTICAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 12,
  });
  hero.layoutAlign = "STRETCH";

  // Decorative circles
  const dc1 = figma.createEllipse(); dc1.resize(120, 120); dc1.fills = rgb("#FFFFFF", 0.03);
  dc1.x = -30; dc1.y = -20; hero.appendChild(dc1);
  const dc2 = figma.createEllipse(); dc2.resize(80, 80); dc2.fills = rgb("#FFFFFF", 0.03);
  dc2.x = 320; dc2.y = 140; hero.appendChild(dc2);

  // Avatar (80px)
  const profAv = af(hero, "ProfileAvatar", {
    w: 80, h: 80, corner: 100,
    fills: rgb(C.primary),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(profAv, "Y", 32, 700, "#FFFFFF");

  await txt(hero, "ゆうた", 24, 700, "#FFFFFF", { align: "CENTER" });
  await txt(hero, "MeshiMatchユーザー", 13, 400, "#FFFFFF99", { align: "CENTER" });

  // Content area
  const profContent = af(prof, "Content", {
    w: W, x: 0, y: 200,
    layout: "VERTICAL", gap: 16, pad: 20, pt: 24,
  });

  // 基本情報
  await txt(profContent, "基本情報", 15, 700, C.text1);

  const idCard = card(profContent, "UserID", {
    w: 350, h: 50, corner: 16,
    layout: "HORIZONTAL", crossAlign: "CENTER", pl: 16, pr: 16, gap: 8,
  });
  idCard.layoutAlign = "STRETCH";
  await txt(idCard, "User ID", 13, 500, C.text2);
  const idVal = await txt(idCard, "abc123xyz", 13, 500, C.text1);
  idVal.layoutGrow = 1;

  // 友達に共有
  await txt(profContent, "友達に共有", 15, 700, C.text1);

  const shareRow = af(profContent, "ShareRow", {
    w: 350, layout: "HORIZONTAL", gap: 12,
  });
  shareRow.layoutAlign = "STRETCH";

  for (const label of ["QRコード", "ID検索"]) {
    const btn = card(shareRow, label, {
      w: 169, h: 80, corner: 16,
      layout: "VERTICAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 8,
    });
    btn.layoutGrow = 1;
    await txt(btn, label === "QRコード" ? "📱" : "🔍", 24, 400, C.text2);
    await txt(btn, label, 13, 500, C.text2, { align: "CENTER" });
  }

  // 繋がり
  await txt(profContent, "繋がり", 15, 700, C.text1);
  const connCard = card(profContent, "Connections", {
    w: 350, h: 56, corner: 16,
    layout: "HORIZONTAL", crossAlign: "CENTER", pl: 16, pr: 16, gap: 12,
  });
  connCard.layoutAlign = "STRETCH";

  const avStack = af(connCard, "AvatarStack", { w: 100, h: 32, layout: "HORIZONTAL", gap: -8 });
  for (const [init, col] of [["Y", "#C26A4A"], ["T", "#6B7A52"], ["K", "#4A6B9A"]]) {
    const a = af(avStack, "av", { w: 32, h: 32, corner: 100, fills: rgb(col),
      layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER" });
    a.strokes = rgb(C.surface); a.strokeWeight = 2;
    await txt(a, init, 13, 700, "#FFFFFF");
  }
  const connTxt = await txt(connCard, "3人の繋がり", 14, 500, C.text2);
  connTxt.layoutGrow = 1;
  await txt(connCard, "→", 16, 400, C.text3);

  // 食の好み
  await txt(profContent, "食の好み", 15, 700, C.text1);

  const prefCard = card(profContent, "FoodPrefs", {
    w: 350, corner: 16,
    layout: "VERTICAL", gap: 0,
  });
  prefCard.layoutAlign = "STRETCH";

  // Disliked
  const disRow = af(prefCard, "Disliked", {
    w: 350, layout: "HORIZONTAL", crossAlign: "CENTER", pl: 16, pr: 16, pt: 14, pb: 14, gap: 8,
  });
  disRow.layoutAlign = "STRETCH";
  await txt(disRow, "苦手なジャンル", 14, 500, C.text2);
  const disChips = af(disRow, "chips", { layout: "HORIZONTAL", gap: 6 });
  disChips.layoutGrow = 1;
  chip(disChips, "パクチー", false);
  chip(disChips, "辛いもの", false);
  await txt(disRow, "✏️", 14, 400, C.text3);

  // Divider
  const div = figma.createRectangle();
  div.resize(350, 1); div.fills = rgb(C.border, 0.5);
  div.layoutAlign = "STRETCH";
  prefCard.appendChild(div);

  // Allergies
  const allergyRow = af(prefCard, "Allergies", {
    w: 350, layout: "HORIZONTAL", crossAlign: "CENTER", pl: 16, pr: 16, pt: 14, pb: 14, gap: 8,
  });
  allergyRow.layoutAlign = "STRETCH";
  await txt(allergyRow, "アレルギー", 14, 500, C.text2);
  const allerTxt = await txt(allergyRow, "設定なし", 14, 400, C.text3);
  allerTxt.layoutGrow = 1;
  await txt(allergyRow, "✏️", 14, 400, C.text3);

  // Logout
  const logoutBtn = af(profContent, "LogoutBtn", {
    w: 350, h: 52, corner: 100,
    fills: rgb(C.danger, 0.08),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  logoutBtn.layoutAlign = "STRETCH";
  await txt(logoutBtn, "ログアウト", 15, 600, C.danger, { align: "CENTER" });

  bottomNav(prof, "profile", H - 80);

  // ════════════════════════════════════════════════════════════
  // 6. GROUP CREATE – Step 1: Name
  // ════════════════════════════════════════════════════════════
  const create1 = af(page, "GroupCreate – Name", { w: W, h: H, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  // Close button
  const closeBtn = af(create1, "CloseBtn", {
    w: 36, h: 36, x: 340, y: 16, corner: 100, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(closeBtn, "×", 18, 400, C.text2);

  await txt(create1, "グループを作ろう", 24, 700, C.text1, { x: 20, y: 80, w: 350 });
  await txt(create1, "メンバーの好みを合わせて\nAIがベストなお店を提案します", 15, 400, C.text2, { x: 20, y: 120, w: 350 });

  await txt(create1, "グループ名", 14, 500, C.text2, { x: 20, y: 190 });

  const nameInput = af(create1, "NameInput", {
    w: 350, h: 52, x: 20, y: 216, corner: 16,
    fills: rgb(C.surface),
    strokes: rgb(C.border), strokeW: 1.5,
    layout: "HORIZONTAL", crossAlign: "CENTER", pl: 16, pr: 16,
  });
  await txt(nameInput, "例：金曜ランチ会", 14, 400, C.text3);

  await pill(create1, "NextBtn", 350, 52, C.primary, "次へ", 16, "#FFFFFF", 600);
  const nb = create1.children[create1.children.length - 1];
  nb.x = 20; nb.y = H - 100;

  // ════════════════════════════════════════════════════════════
  // 7. GROUP CREATE – Step 2: Members
  // ════════════════════════════════════════════════════════════
  const create2 = af(page, "GroupCreate – Members", { w: W, h: H, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  // Back + Close
  await txt(create2, "←", 20, 400, C.primary, { x: 20, y: 20 });
  const closeBtn2 = af(create2, "CloseBtn", {
    w: 36, h: 36, x: 340, y: 16, corner: 100, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  await txt(closeBtn2, "×", 18, 400, C.text2);

  await txt(create2, "メンバーを追加", 24, 700, C.text1, { x: 20, y: 72, w: 350 });

  // Member chips
  const memberChips = af(create2, "MemberChips", {
    w: 350, x: 20, y: 116,
    layout: "HORIZONTAL", gap: 8,
  });
  for (const name of ["たかし", "みさき"]) {
    const mc = af(memberChips, "member-" + name, {
      h: 36, corner: 100, fills: rgb(C.primary, 0.1),
      layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 14, pr: 10, gap: 6,
    });
    await txt(mc, name, 14, 500, C.primary);
    await txt(mc, "×", 14, 400, C.primary);
  }

  // Add input row
  const addRow = af(create2, "AddRow", {
    w: 350, x: 20, y: 170,
    layout: "HORIZONTAL", gap: 8, crossAlign: "CENTER",
  });
  const addInput = af(addRow, "AddInput", {
    w: 270, h: 48, corner: 16,
    fills: rgb(C.surface), strokes: rgb(C.border), strokeW: 1.5,
    layout: "HORIZONTAL", crossAlign: "CENTER", pl: 16,
  });
  addInput.layoutGrow = 1;
  await txt(addInput, "メンバー名", 14, 400, C.text3);
  await pill(addRow, "AddBtn", 72, 48, C.bgSec, "追加", 14, C.text2, 600);

  // Share section
  const shareCard = card(create2, "ShareCard", {
    w: 350, x: 20, y: 240, corner: 16,
    layout: "VERTICAL", gap: 12, pad: 16,
  });
  await txt(shareCard, "招待リンクを共有", 15, 600, C.text1);

  const linkRow = af(shareCard, "LinkRow", {
    w: 318, layout: "HORIZONTAL", gap: 8, crossAlign: "CENTER",
  });
  linkRow.layoutAlign = "STRETCH";
  const linkBox = af(linkRow, "Link", {
    h: 40, corner: 10, fills: rgb(C.bgSec),
    layout: "HORIZONTAL", crossAlign: "CENTER", pl: 12, pr: 12,
  });
  linkBox.layoutGrow = 1;
  await txt(linkBox, "meshimatch.app/invite/abc123", 12, 400, C.text2);
  await pill(linkRow, "CopyBtn", 64, 40, C.bgSec, "コピー", 13, C.text2, 500);

  await pill(create2, "NextBtn2", 350, 52, C.primary, "次へ（アンケートに回答する）", 15, "#FFFFFF", 600);
  const nb2 = create2.children[create2.children.length - 1];
  nb2.x = 20; nb2.y = H - 100;

  // ════════════════════════════════════════════════════════════
  // 8. SURVEY PAGE
  // ════════════════════════════════════════════════════════════
  const survey = af(page, "Survey", { w: W, h: 1200, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  await txt(survey, "←", 20, 400, C.primary, { x: 20, y: 20 });
  await txt(survey, "今日の気分は？", 24, 700, C.text1, { x: 20, y: 64, w: 350 });
  await txt(survey, "金曜ランチ会 · ジャンルをドラッグしてティアに分けてください", 14, 400, C.text2, { x: 20, y: 100, w: 350 });

  // Area selection card
  const areaCard = card(survey, "AreaCard", {
    w: 350, x: 20, y: 150, corner: 16,
    layout: "VERTICAL", gap: 12, pad: 16,
  });
  await txt(areaCard, "希望エリア", 15, 700, C.text1);
  await txt(areaCard, "複数選択OK・未選択の場合はどこでもOK", 12, 400, C.text3);

  const areaChips = af(areaCard, "AreaChips", {
    w: 318, layout: "HORIZONTAL", gap: 8,
  });
  areaChips.layoutAlign = "STRETCH";
  areaChips.layoutWrap = "WRAP";
  for (const [area, sel] of [["新宿", true], ["渋谷", false], ["池袋", false], ["六本木", true], ["銀座", false]]) {
    chip(areaChips, area, sel);
  }

  // Unranked pool
  await txt(survey, "未ランク", 14, 600, C.text2, { x: 20, y: 340 });
  const pool = af(survey, "UnrankedPool", {
    w: 350, x: 20, y: 366, corner: 14,
    fills: rgb(C.bgSec),
    layout: "HORIZONTAL", gap: 8, pad: 14,
  });
  pool.layoutWrap = "WRAP";
  for (const g of ["和食", "中華", "フレンチ", "カフェ", "焼肉"]) {
    chip(pool, g, false);
  }

  // Tier S
  const tierS = af(survey, "TierS", {
    w: 350, x: 20, y: 470, corner: 16,
    fills: rgb(C.surface),
    strokes: rgb(C.primary, 0.3), strokeW: 2,
    layout: "VERTICAL", gap: 10, pad: 14,
  });
  const tierSHeader = af(tierS, "Header", {
    w: 322, layout: "HORIZONTAL", crossAlign: "CENTER", gap: 8,
  });
  tierSHeader.layoutAlign = "STRETCH";
  await pill(tierSHeader, "SBadge", 60, 28, C.primary, "🔥 S", 13, "#FFFFFF", 700);
  await txt(tierSHeader, "めっちゃ食べたい", 13, 500, C.text2);

  const tierSChips = af(tierS, "SChips", {
    w: 322, layout: "HORIZONTAL", gap: 6,
  });
  tierSChips.layoutAlign = "STRETCH";
  chip(tierSChips, "イタリアン", true);
  chip(tierSChips, "寿司", true);

  // Tier A
  const tierA = af(survey, "TierA", {
    w: 350, x: 20, y: 600, corner: 16,
    fills: rgb(C.surface),
    strokes: rgb(C.warning, 0.3), strokeW: 2,
    layout: "VERTICAL", gap: 10, pad: 14,
  });
  const tierAHeader = af(tierA, "Header", {
    w: 322, layout: "HORIZONTAL", crossAlign: "CENTER", gap: 8,
  });
  tierAHeader.layoutAlign = "STRETCH";
  await pill(tierAHeader, "ABadge", 60, 28, C.warning, "👍 A", 13, "#FFFFFF", 700);
  await txt(tierAHeader, "食べたい", 13, 500, C.text2);

  const tierAChips = af(tierA, "AChips", {
    w: 322, layout: "HORIZONTAL", gap: 6,
  });
  tierAChips.layoutAlign = "STRETCH";
  chip(tierAChips, "韓国料理", true);

  // Tier B
  const tierB = af(survey, "TierB", {
    w: 350, x: 20, y: 720, corner: 16,
    fills: rgb(C.surface),
    strokes: rgb(C.text3, 0.3), strokeW: 2,
    layout: "VERTICAL", gap: 10, pad: 14,
  });
  const tierBHeader = af(tierB, "Header", {
    w: 322, layout: "HORIZONTAL", crossAlign: "CENTER", gap: 8,
  });
  tierBHeader.layoutAlign = "STRETCH";
  await pill(tierBHeader, "BBadge", 60, 28, C.text3, "👌 B", 13, "#FFFFFF", 700);
  await txt(tierBHeader, "まぁいいよ", 13, 500, C.text2);

  // Empty drop zone
  const tierBZone = af(tierB, "DropZone", {
    w: 322, h: 60, corner: 10,
    fills: rgb(C.bgSec, 0.5),
    strokes: rgb(C.border), strokeW: 1,
    layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER",
  });
  tierBZone.layoutAlign = "STRETCH";
  tierBZone.dashPattern = [6, 4];
  await txt(tierBZone, "ここにドロップ", 13, 400, C.text3, { align: "CENTER" });

  // Progress
  await txt(survey, "5/13 ジャンルをランク付け済み", 13, 500, C.text2, { x: 20, y: 850 });

  // Submit button
  await pill(survey, "SubmitBtn", 350, 52, C.primary, "回答を送信する", 16, "#FFFFFF", 600);
  const submitBtn = survey.children[survey.children.length - 1];
  submitBtn.x = 20; submitBtn.y = 1130;

  // ════════════════════════════════════════════════════════════
  // 9. WAITING ROOM
  // ════════════════════════════════════════════════════════════
  const waiting = af(page, "Waiting Room", { w: W, h: H, fills: rgb(C.bg), x: cx }); cx += W + GAP;

  await txt(waiting, "← ホーム", 16, 500, C.primary, { x: 20, y: 20 });
  await txt(waiting, "金曜ランチ会", 22, 700, C.text1, { x: 20, y: 56 });

  // Response count circle
  const countCircle = af(waiting, "CountCircle", {
    w: 110, h: 110, x: 140, y: 110, corner: 100,
    fills: rgb(C.surface),
    strokes: rgb(C.primary), strokeW: 4,
    layout: "VERTICAL", mainAlign: "CENTER", crossAlign: "CENTER", gap: 2,
  });
  await txt(countCircle, "3", 32, 700, C.primary, { align: "CENTER" });
  await txt(countCircle, "/ 4", 13, 400, C.text2, { align: "CENTER" });

  await txt(waiting, "回答件数", 14, 500, C.text2, { x: 155, y: 230 });

  // Members card
  const memCard = card(waiting, "MembersCard", {
    w: 350, x: 20, y: 270, corner: 16,
    layout: "VERTICAL", gap: 0,
  });

  const members = [
    ["Y", "#C26A4A", "ゆうた", "幹事", true],
    ["T", "#6B7A52", "たかし", "", true],
    ["M", "#4A6B9A", "みさき", "", true],
    ["K", "#9A4A6B", "けいこ", "", false],
  ];
  for (let i = 0; i < members.length; i++) {
    const [init, col, name, role, answered] = members[i];
    const row = af(memCard, "member-" + name, {
      w: 350, h: 56, layout: "HORIZONTAL", crossAlign: "CENTER", pl: 16, pr: 16, gap: 12,
    });
    row.layoutAlign = "STRETCH";

    avatar(row, init, col, 36);
    const nameCol = af(row, "info", { layout: "VERTICAL", gap: 2 });
    nameCol.layoutGrow = 1;
    await txt(nameCol, name, 15, 600, C.text1);
    if (role) await txt(nameCol, role, 11, 400, C.text3);

    const badge = af(row, "status", {
      h: 24, corner: 100,
      fills: rgb(answered ? C.success : C.text3, 0.1),
      layout: "HORIZONTAL", mainAlign: "CENTER", crossAlign: "CENTER", pl: 10, pr: 10,
    });
    await txt(badge, answered ? "回答済み" : "未回答", 11, 600, answered ? C.success : C.text3);

    // Divider
    if (i < members.length - 1) {
      const d = figma.createRectangle();
      d.resize(350, 1); d.fills = rgb(C.border, 0.3);
      d.layoutAlign = "STRETCH";
      memCard.appendChild(d);
    }
  }

  // Buttons
  await pill(waiting, "ShareBtn", 350, 52, C.surface, "招待リンクを共有", 15, C.text1, 600);
  const shareBtn = waiting.children[waiting.children.length - 1];
  shareBtn.x = 20; shareBtn.y = H - 180;
  shareBtn.strokes = rgb(C.border); shareBtn.strokeWeight = 1.5;

  await pill(waiting, "SearchBtn", 350, 52, C.primary, "お店を探す", 16, "#FFFFFF", 600);
  const searchBtn = waiting.children[waiting.children.length - 1];
  searchBtn.x = 20; searchBtn.y = H - 116;

  figma.notify("✅ Part 2 complete: Profile, GroupCreate(Name/Members), Survey, Waiting");
})();
