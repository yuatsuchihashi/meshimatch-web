// MeshiMatch UI Generator - All Screens
// Figma Plugin: プラグイン > 開発 > マニフェストからインポート

function rgb(hex, op) {
  var r = parseInt(hex.slice(1,3),16)/255;
  var g = parseInt(hex.slice(3,5),16)/255;
  var b = parseInt(hex.slice(5,7),16)/255;
  return [{type:"SOLID",color:{r:r,g:g,b:b},opacity:op!==undefined?op:1}];
}
function shadow(ox,oy,blur,sp,a){
  return [{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",color:{r:0,g:0,b:0,a:a||0.08},offset:{x:ox,y:oy},radius:blur,spread:sp||0}];
}
var FONTS={};
async function lf(s){if(!FONTS[s]){await figma.loadFontAsync({family:"Inter",style:s});FONTS[s]=true;}}
function fs(w){return w>=700?"Bold":w>=600?"Semi Bold":w>=500?"Medium":"Regular";}
async function txt(p,t,sz,w,c,o){
  var s=fs(w);await lf(s);var n=figma.createText();n.characters=t;n.fontSize=sz;
  n.fontName={family:"Inter",style:s};n.fills=rgb(c);
  if(o&&o.w){n.resize(o.w,n.height);n.textAutoResize="HEIGHT";}
  if(o&&o.align)n.textAlignHorizontal=o.align;
  if(o&&o.x!==undefined)n.x=o.x;if(o&&o.y!==undefined)n.y=o.y;
  p.appendChild(n);return n;
}
function af(p,name,o){
  var f=figma.createFrame();f.name=name;
  if(o.w&&o.h)f.resize(o.w,o.h);
  f.fills=o.fills||[];
  if(o.corner)f.cornerRadius=o.corner;
  if(o.layout){
    f.layoutMode=o.layout;f.primaryAxisAlignItems=o.mainAlign||"MIN";f.counterAxisAlignItems=o.crossAlign||"MIN";
    if(o.gap!==undefined)f.itemSpacing=o.gap;
    if(o.pad!==undefined){f.paddingTop=o.pad;f.paddingBottom=o.pad;f.paddingLeft=o.pad;f.paddingRight=o.pad;}
    if(o.pt!==undefined)f.paddingTop=o.pt;if(o.pb!==undefined)f.paddingBottom=o.pb;
    if(o.pl!==undefined)f.paddingLeft=o.pl;if(o.pr!==undefined)f.paddingRight=o.pr;
  }
  if(o.shadow)f.effects=o.shadow;
  if(o.x!==undefined)f.x=o.x;if(o.y!==undefined)f.y=o.y;
  if(o.strokes){f.strokes=o.strokes;f.strokeWeight=o.strokeW||1;}
  if(o.alignSelf)f.layoutAlign=o.alignSelf;
  p.appendChild(f);return f;
}
function crd(p,n,o){
  var opts={fills:rgb("#FFFFFF"),corner:(o&&o.corner)||20,
    shadow:shadow(0,1,3,0,0.04).concat([{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",color:{r:0,g:0,b:0,a:0.02},offset:{x:0,y:4},radius:12,spread:0}])};
  var keys=Object.keys(o);
  for(var i=0;i<keys.length;i++){opts[keys[i]]=o[keys[i]];}
  opts.fills=rgb("#FFFFFF");
  opts.corner=(o&&o.corner)||20;
  opts.shadow=shadow(0,1,3,0,0.04).concat([{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",color:{r:0,g:0,b:0,a:0.02},offset:{x:0,y:4},radius:12,spread:0}]);
  return af(p,n,opts);
}
function pill(p,n,w,h,bg,t,sz,tc,tw){
  var f=af(p,n,{w:w,h:h,fills:rgb(bg),corner:100,layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});
  return txt(f,t,sz,tw||600,tc,{align:"CENTER"}).then(function(){return f;});
}
function chip(p,label,sel){
  var bg=sel?"#1A1A2E":"#EFEEE9",tc=sel?"#FFFFFF":"#6E6E7A";
  var f=af(p,"chip-"+label,{h:34,fills:rgb(bg),corner:100,layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:16,pr:16,pt:8,pb:8});
  txt(f,label,13,500,tc);return f;
}
function avatar(p,init,col,sz){
  var s=sz||36;
  var a=af(p,"av-"+init,{w:s,h:s,corner:100,fills:rgb(col),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});
  txt(a,init,s*0.4,700,"#FFFFFF");return a;
}
function circle(p,sz,hex,op){var e=figma.createEllipse();e.resize(sz,sz);e.fills=rgb(hex,op);p.appendChild(e);return e;}
function glassInput(p,w,ph){
  var f=af(p,ph,{w:w,h:50,corner:12,fills:[{type:"SOLID",color:{r:1,g:1,b:1},opacity:0.06}],layout:"HORIZONTAL",crossAlign:"CENTER",pl:16,pr:16});
  f.layoutAlign="STRETCH";return txt(f,ph,14,400,"#666680").then(function(){return f;});
}
function bottomNav(p,active,y){
  var nav=af(p,"BottomNav",{w:390,h:80,x:0,y:y,fills:rgb("#FFFFFF"),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",gap:80,pt:10,pb:20,pl:40,pr:40});
  nav.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",color:{r:0,g:0,b:0,a:0.05},offset:{x:0,y:-1},radius:8,spread:0}];
  var items=[["ホーム","home"],["プロフィール","profile"]];
  for(var i=0;i<items.length;i++){
    var label=items[i][0],key=items[i][1];
    var act=key===active;
    var tab=af(nav,label,{w:60,h:50,layout:"VERTICAL",mainAlign:"CENTER",crossAlign:"CENTER",gap:4});
    var ic=figma.createEllipse();ic.resize(28,28);ic.fills=rgb(act?"#C26A4A":"#A0A0AC",act?0.12:0.08);tab.appendChild(ic);
    txt(tab,label,10,act?600:400,act?"#C26A4A":"#A0A0AC",{align:"CENTER"});
  }
  return nav;
}

var C={primary:"#C26A4A",secondary:"#1A1A2E",bg:"#F7F6F3",bgSec:"#EFEEE9",surface:"#FFFFFF",text1:"#1A1A2E",text2:"#6E6E7A",text3:"#A0A0AC",border:"#E8E8E4",warning:"#E8B944",danger:"#B33A3A",success:"#3D8B5E"};
var W=390,H=844,GAP=60;

(async function(){
  var page=null;
  var pages=figma.root.children;
  for(var i=0;i<pages.length;i++){if(pages[i].name==="UI Screens"){page=pages[i];break;}}
  if(!page){page=figma.createPage();page.name="UI Screens";}
  await figma.setCurrentPageAsync(page);
  var ch=page.children;
  for(var i=ch.length-1;i>=0;i--){ch[i].remove();}
  var cx=0;
  function nx(){var x=cx;cx+=W+GAP;return x;}

  // 1. LOGIN
  var login=af(page,"Login",{w:W,h:H,fills:rgb(C.secondary),x:nx()});
  var lc=af(login,"LoginCard",{w:350,h:420,x:20,y:200,corner:24,fills:[{type:"SOLID",color:{r:1,g:1,b:1},opacity:0.08}],shadow:shadow(0,4,24,0,0.15),layout:"VERTICAL",crossAlign:"CENTER",gap:20,pad:32,pt:40,pb:40});
  await txt(lc,"ログイン",24,700,"#FFFFFF",{align:"CENTER",w:286});
  await txt(lc,"MeshiMatchへようこそ",14,400,"#FFFFFFAA",{align:"CENTER",w:286});
  await glassInput(lc,286,"you@example.com");
  await glassInput(lc,286,"••••••");
  await pill(lc,"LoginBtn",286,52,C.primary,"ログイン",16,"#FFFFFF",600);
  await txt(lc,"アカウントをお持ちでない方はこちら",13,400,"#9999AA",{align:"CENTER",w:286});

  // 2. SIGNUP
  var signup=af(page,"Signup",{w:W,h:H,fills:rgb(C.secondary),x:nx()});
  var sc=af(signup,"SignupCard",{w:350,h:540,x:20,y:140,corner:24,fills:[{type:"SOLID",color:{r:1,g:1,b:1},opacity:0.08}],shadow:shadow(0,4,24,0,0.15),layout:"VERTICAL",crossAlign:"CENTER",gap:12,pl:32,pr:32,pt:36,pb:36});
  await txt(sc,"新規登録",24,700,"#FFFFFF",{align:"CENTER",w:286});
  await txt(sc,"MeshiMatchを始めよう",14,400,"#FFFFFFAA",{align:"CENTER",w:286});
  var fields=[["表示名","あなたの名前"],["メールアドレス","you@example.com"],["パスワード","••••••"]];
  for(var fi=0;fi<fields.length;fi++){
    await txt(sc,fields[fi][0],13,500,"#CCCCDD",{w:286});await glassInput(sc,286,fields[fi][1]);
  }
  await pill(sc,"SignupBtn",286,52,C.primary,"登録する",16,"#FFFFFF",600);
  await txt(sc,"すでにアカウントをお持ちの方",13,400,"#9999AA",{align:"CENTER",w:286});

  // 3. HOME
  var home=af(page,"Home",{w:W,h:H,fills:rgb(C.bg),x:nx()});
  await txt(home,"こんにちは、ゆうたさん",26,700,C.text1,{x:20,y:60,w:300});
  var bell=af(home,"Bell",{w:44,h:44,x:326,y:56,corner:100,fills:rgb(C.surface),shadow:shadow(0,1,4,0,0.06),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});
  bell.strokes=rgb(C.border);bell.strokeWeight=1;await txt(bell,"🔔",18,400,C.text2);
  var bdg=circle(home,18,C.danger);bdg.x=354;bdg.y=50;await txt(home,"2",10,700,"#FFFFFF",{x:359,y:53});
  var cta=crd(home,"CTA",{w:350,h:80,x:20,y:120,corner:20,layout:"HORIZONTAL",crossAlign:"CENTER",gap:14,pl:16,pr:16,pt:16,pb:16});
  var ctaI=af(cta,"Icon",{w:48,h:48,corner:14,fills:rgb(C.primary,0.1),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});
  await txt(ctaI,"🍽",20,400,C.primary);
  var ctaT=af(cta,"Txt",{w:220,layout:"VERTICAL",gap:4});ctaT.layoutGrow=1;
  await txt(ctaT,"グループを作ろう",16,700,C.text1);await txt(ctaT,"みんなで行くお店をAIが提案",13,400,C.text2);
  await txt(cta,"→",18,400,C.text3);
  await txt(home,"進行中のグループ",18,700,C.text1,{x:20,y:224});
  // GroupCard1
  var gc1=crd(home,"GroupCard1",{w:350,h:140,x:20,y:260,corner:20,layout:"VERTICAL",gap:10,pad:18});
  var gh1=af(gc1,"H",{w:314,layout:"HORIZONTAL",crossAlign:"CENTER",gap:8});gh1.layoutAlign="STRETCH";
  await txt(gh1,"金曜ランチ会",17,700,C.text1);
  var sb1=af(gh1,"S",{h:24,corner:100,fills:rgb(C.success,0.1),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:10,pr:10});
  await txt(sb1,"回答中",11,600,C.success);
  var gm1=af(gc1,"M",{w:314,layout:"HORIZONTAL",gap:12,crossAlign:"CENTER"});gm1.layoutAlign="STRETCH";
  await txt(gm1,"4人のメンバー",13,400,C.text2);await txt(gm1,"2025/03/28",13,400,C.text3);
  var ar1=af(gc1,"Av",{w:314,layout:"HORIZONTAL",gap:-8});ar1.layoutAlign="STRETCH";
  var avC=["#C26A4A","#6B7A52","#4A6B9A","#9A4A6B"],avI=["Y","T","K","S"];
  for(var ai=0;ai<4;ai++){var a=af(ar1,"a"+ai,{w:32,h:32,corner:100,fills:rgb(avC[ai]),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});a.strokes=rgb(C.surface);a.strokeWeight=2;await txt(a,avI[ai],13,700,"#FFFFFF");}
  // GroupCard2
  var gc2=crd(home,"GroupCard2",{w:350,h:140,x:20,y:414,corner:20,layout:"VERTICAL",gap:10,pad:18});
  var gh2=af(gc2,"H",{w:314,layout:"HORIZONTAL",crossAlign:"CENTER",gap:8});gh2.layoutAlign="STRETCH";
  await txt(gh2,"チーム飲み会",17,700,C.text1);
  var sb2=af(gh2,"S",{h:24,corner:100,fills:rgb(C.primary,0.1),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:10,pr:10});
  await txt(sb2,"結果あり",11,600,C.primary);
  var gm2=af(gc2,"M",{w:314,layout:"HORIZONTAL",gap:12,crossAlign:"CENTER"});gm2.layoutAlign="STRETCH";
  await txt(gm2,"6人のメンバー",13,400,C.text2);await txt(gm2,"2025/03/25",13,400,C.text3);
  var ar2=af(gc2,"Av",{w:314,layout:"HORIZONTAL",gap:-8});ar2.layoutAlign="STRETCH";
  for(var ai2=0;ai2<4;ai2++){var a2=af(ar2,"a"+ai2,{w:32,h:32,corner:100,fills:rgb(avC[ai2]),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});a2.strokes=rgb(C.surface);a2.strokeWeight=2;await txt(a2,avI[ai2],13,700,"#FFFFFF");}
  var ex=af(ar2,"ex",{w:32,h:32,corner:100,fills:rgb(C.bgSec),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});ex.strokes=rgb(C.surface);ex.strokeWeight=2;await txt(ex,"+2",11,600,C.text2);
  bottomNav(home,"home",H-80);

  // 4. PROFILE
  var prof=af(page,"Profile",{w:W,h:H,fills:rgb(C.bg),x:nx()});
  var hero=af(prof,"Hero",{w:W,h:200,fills:rgb(C.secondary),layout:"VERTICAL",mainAlign:"CENTER",crossAlign:"CENTER",gap:12});
  hero.layoutAlign="STRETCH";
  var pa=af(hero,"Av",{w:80,h:80,corner:100,fills:rgb(C.primary),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});
  await txt(pa,"Y",32,700,"#FFFFFF");
  await txt(hero,"ゆうた",24,700,"#FFFFFF",{align:"CENTER"});
  await txt(hero,"MeshiMatchユーザー",13,400,"#FFFFFF99",{align:"CENTER"});
  var pc=af(prof,"Content",{w:W,x:0,y:200,layout:"VERTICAL",gap:16,pad:20,pt:24});
  await txt(pc,"基本情報",15,700,C.text1);
  var idc=crd(pc,"ID",{w:350,h:50,corner:16,layout:"HORIZONTAL",crossAlign:"CENTER",pl:16,pr:16,gap:8});idc.layoutAlign="STRETCH";
  await txt(idc,"User ID",13,500,C.text2);var idv=await txt(idc,"abc123xyz",13,500,C.text1);idv.layoutGrow=1;
  await txt(pc,"友達に共有",15,700,C.text1);
  var sr=af(pc,"Share",{w:350,layout:"HORIZONTAL",gap:12});sr.layoutAlign="STRETCH";
  var shareItems=["QRコード","ID検索"];
  for(var si=0;si<shareItems.length;si++){
    var l=shareItems[si];
    var b=crd(sr,l,{w:169,h:80,corner:16,layout:"VERTICAL",mainAlign:"CENTER",crossAlign:"CENTER",gap:8});b.layoutGrow=1;
    await txt(b,l==="QRコード"?"📱":"🔍",24,400,C.text2);await txt(b,l,13,500,C.text2,{align:"CENTER"});
  }
  await txt(pc,"繋がり",15,700,C.text1);
  var cc=crd(pc,"Conn",{w:350,h:56,corner:16,layout:"HORIZONTAL",crossAlign:"CENTER",pl:16,pr:16,gap:12});cc.layoutAlign="STRETCH";
  var avs=af(cc,"AvStack",{w:100,h:32,layout:"HORIZONTAL",gap:-8});
  var connAv=[["Y","#C26A4A"],["T","#6B7A52"],["K","#4A6B9A"]];
  for(var ci=0;ci<connAv.length;ci++){var ca=af(avs,"a",{w:32,h:32,corner:100,fills:rgb(connAv[ci][1]),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});ca.strokes=rgb(C.surface);ca.strokeWeight=2;await txt(ca,connAv[ci][0],13,700,"#FFFFFF");}
  var ct=await txt(cc,"3人の繋がり",14,500,C.text2);ct.layoutGrow=1;await txt(cc,"→",16,400,C.text3);
  await txt(pc,"食の好み",15,700,C.text1);
  var pf=crd(pc,"Prefs",{w:350,corner:16,layout:"VERTICAL",gap:0});pf.layoutAlign="STRETCH";
  var dr=af(pf,"Dis",{w:350,layout:"HORIZONTAL",crossAlign:"CENTER",pl:16,pr:16,pt:14,pb:14,gap:8});dr.layoutAlign="STRETCH";
  await txt(dr,"苦手なジャンル",14,500,C.text2);var dc=af(dr,"chips",{layout:"HORIZONTAL",gap:6});dc.layoutGrow=1;chip(dc,"パクチー",false);chip(dc,"辛いもの",false);
  var dv=figma.createRectangle();dv.resize(350,1);dv.fills=rgb(C.border,0.5);dv.layoutAlign="STRETCH";pf.appendChild(dv);
  var alr=af(pf,"Allergy",{w:350,layout:"HORIZONTAL",crossAlign:"CENTER",pl:16,pr:16,pt:14,pb:14,gap:8});alr.layoutAlign="STRETCH";
  await txt(alr,"アレルギー",14,500,C.text2);var at2=await txt(alr,"設定なし",14,400,C.text3);at2.layoutGrow=1;
  var lb=af(pc,"Logout",{w:350,h:52,corner:100,fills:rgb(C.danger,0.08),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});lb.layoutAlign="STRETCH";
  await txt(lb,"ログアウト",15,600,C.danger,{align:"CENTER"});
  bottomNav(prof,"profile",H-80);

  // 5. GROUP CREATE - NAME
  var cr1=af(page,"Create-Name",{w:W,h:H,fills:rgb(C.bg),x:nx()});
  var cb1=af(cr1,"Close",{w:36,h:36,x:340,y:16,corner:100,fills:rgb(C.bgSec),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});await txt(cb1,"×",18,400,C.text2);
  await txt(cr1,"グループを作ろう",24,700,C.text1,{x:20,y:80,w:350});
  await txt(cr1,"メンバーの好みを合わせて\nAIがベストなお店を提案します",15,400,C.text2,{x:20,y:120,w:350});
  await txt(cr1,"グループ名",14,500,C.text2,{x:20,y:190});
  var ni=af(cr1,"Input",{w:350,h:52,x:20,y:216,corner:16,fills:rgb(C.surface),strokes:rgb(C.border),strokeW:1.5,layout:"HORIZONTAL",crossAlign:"CENTER",pl:16,pr:16});
  await txt(ni,"例：金曜ランチ会",14,400,C.text3);
  await pill(cr1,"Next",350,52,C.primary,"次へ",16,"#FFFFFF",600);var nb=cr1.children[cr1.children.length-1];nb.x=20;nb.y=H-100;

  // 6. GROUP CREATE - MEMBERS
  var cr2=af(page,"Create-Members",{w:W,h:H,fills:rgb(C.bg),x:nx()});
  await txt(cr2,"←",20,400,C.primary,{x:20,y:20});
  var cb2=af(cr2,"Close",{w:36,h:36,x:340,y:16,corner:100,fills:rgb(C.bgSec),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});await txt(cb2,"×",18,400,C.text2);
  await txt(cr2,"メンバーを追加",24,700,C.text1,{x:20,y:72,w:350});
  var mc=af(cr2,"Chips",{w:350,x:20,y:116,layout:"HORIZONTAL",gap:8});
  var memberNames=["たかし","みさき"];
  for(var mi=0;mi<memberNames.length;mi++){var mn=memberNames[mi];var m=af(mc,"m-"+mn,{h:36,corner:100,fills:rgb(C.primary,0.1),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:14,pr:10,gap:6});await txt(m,mn,14,500,C.primary);await txt(m,"×",14,400,C.primary);}
  var adr=af(cr2,"Add",{w:350,x:20,y:170,layout:"HORIZONTAL",gap:8,crossAlign:"CENTER"});
  var adi=af(adr,"In",{w:270,h:48,corner:16,fills:rgb(C.surface),strokes:rgb(C.border),strokeW:1.5,layout:"HORIZONTAL",crossAlign:"CENTER",pl:16});adi.layoutGrow=1;
  await txt(adi,"メンバー名",14,400,C.text3);await pill(adr,"Add",72,48,C.bgSec,"追加",14,C.text2,600);
  var shc=crd(cr2,"Share",{w:350,x:20,y:240,corner:16,layout:"VERTICAL",gap:12,pad:16});
  await txt(shc,"招待リンクを共有",15,600,C.text1);
  var lr=af(shc,"Link",{w:318,layout:"HORIZONTAL",gap:8,crossAlign:"CENTER"});lr.layoutAlign="STRETCH";
  var lbx=af(lr,"L",{h:40,corner:10,fills:rgb(C.bgSec),layout:"HORIZONTAL",crossAlign:"CENTER",pl:12,pr:12});lbx.layoutGrow=1;
  await txt(lbx,"meshimatch.app/invite/abc123",12,400,C.text2);await pill(lr,"Copy",64,40,C.bgSec,"コピー",13,C.text2,500);
  await pill(cr2,"Next2",350,52,C.primary,"次へ（アンケートに回答する）",15,"#FFFFFF",600);var nb2=cr2.children[cr2.children.length-1];nb2.x=20;nb2.y=H-100;

  // 7. SURVEY
  var sv=af(page,"Survey",{w:W,h:1200,fills:rgb(C.bg),x:nx()});
  await txt(sv,"←",20,400,C.primary,{x:20,y:20});
  await txt(sv,"今日の気分は？",24,700,C.text1,{x:20,y:64,w:350});
  await txt(sv,"金曜ランチ会 · ジャンルをドラッグしてティアに分けてください",14,400,C.text2,{x:20,y:100,w:350});
  var ac=crd(sv,"Area",{w:350,x:20,y:150,corner:16,layout:"VERTICAL",gap:12,pad:16});
  await txt(ac,"希望エリア",15,700,C.text1);await txt(ac,"複数選択OK",12,400,C.text3);
  var ach=af(ac,"Chips",{w:318,layout:"HORIZONTAL",gap:8});ach.layoutAlign="STRETCH";ach.layoutWrap="WRAP";
  var areas=[["新宿",true],["渋谷",false],["池袋",false],["六本木",true],["銀座",false]];
  for(var ari=0;ari<areas.length;ari++){chip(ach,areas[ari][0],areas[ari][1]);}
  await txt(sv,"未ランク",14,600,C.text2,{x:20,y:340});
  var pool=af(sv,"Pool",{w:350,x:20,y:366,corner:14,fills:rgb(C.bgSec),layout:"HORIZONTAL",gap:8,pad:14});pool.layoutWrap="WRAP";
  var genres=["和食","中華","フレンチ","カフェ","焼肉"];
  for(var gi=0;gi<genres.length;gi++){chip(pool,genres[gi],false);}
  // Tiers
  var ts=af(sv,"TierS",{w:350,x:20,y:470,corner:16,fills:rgb(C.surface),strokes:rgb(C.primary,0.3),strokeW:2,layout:"VERTICAL",gap:10,pad:14});
  var tsh=af(ts,"H",{w:322,layout:"HORIZONTAL",crossAlign:"CENTER",gap:8});tsh.layoutAlign="STRETCH";
  await pill(tsh,"SB",60,28,C.primary,"🔥 S",13,"#FFFFFF",700);await txt(tsh,"めっちゃ食べたい",13,500,C.text2);
  var tsc=af(ts,"C",{w:322,layout:"HORIZONTAL",gap:6});tsc.layoutAlign="STRETCH";chip(tsc,"イタリアン",true);chip(tsc,"寿司",true);
  var ta=af(sv,"TierA",{w:350,x:20,y:600,corner:16,fills:rgb(C.surface),strokes:rgb(C.warning,0.3),strokeW:2,layout:"VERTICAL",gap:10,pad:14});
  var tah=af(ta,"H",{w:322,layout:"HORIZONTAL",crossAlign:"CENTER",gap:8});tah.layoutAlign="STRETCH";
  await pill(tah,"AB",60,28,C.warning,"👍 A",13,"#FFFFFF",700);await txt(tah,"食べたい",13,500,C.text2);
  var tac=af(ta,"C",{w:322,layout:"HORIZONTAL",gap:6});tac.layoutAlign="STRETCH";chip(tac,"韓国料理",true);
  var tb=af(sv,"TierB",{w:350,x:20,y:720,corner:16,fills:rgb(C.surface),strokes:rgb(C.text3,0.3),strokeW:2,layout:"VERTICAL",gap:10,pad:14});
  var tbh=af(tb,"H",{w:322,layout:"HORIZONTAL",crossAlign:"CENTER",gap:8});tbh.layoutAlign="STRETCH";
  await pill(tbh,"BB",60,28,C.text3,"👌 B",13,"#FFFFFF",700);await txt(tbh,"まぁいいよ",13,500,C.text2);
  var tbz=af(tb,"Drop",{w:322,h:60,corner:10,fills:rgb(C.bgSec,0.5),strokes:rgb(C.border),strokeW:1,layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});tbz.layoutAlign="STRETCH";tbz.dashPattern=[6,4];
  await txt(tbz,"ここにドロップ",13,400,C.text3,{align:"CENTER"});
  await txt(sv,"5/13 ジャンルをランク付け済み",13,500,C.text2,{x:20,y:850});
  await pill(sv,"Submit",350,52,C.primary,"回答を送信する",16,"#FFFFFF",600);var smb=sv.children[sv.children.length-1];smb.x=20;smb.y=1130;

  // 8. WAITING
  var wt=af(page,"Waiting",{w:W,h:H,fills:rgb(C.bg),x:nx()});
  await txt(wt,"← ホーム",16,500,C.primary,{x:20,y:20});await txt(wt,"金曜ランチ会",22,700,C.text1,{x:20,y:56});
  var cnt=af(wt,"Count",{w:110,h:110,x:140,y:110,corner:100,fills:rgb(C.surface),strokes:rgb(C.primary),strokeW:4,layout:"VERTICAL",mainAlign:"CENTER",crossAlign:"CENTER",gap:2});
  await txt(cnt,"3",32,700,C.primary,{align:"CENTER"});await txt(cnt,"/ 4",13,400,C.text2,{align:"CENTER"});
  await txt(wt,"回答件数",14,500,C.text2,{x:155,y:230});
  var mmc=crd(wt,"Members",{w:350,x:20,y:270,corner:16,layout:"VERTICAL",gap:0});
  var mems=[["Y","#C26A4A","ゆうた","幹事",true],["T","#6B7A52","たかし","",true],["M","#4A6B9A","みさき","",true],["K","#9A4A6B","けいこ","",false]];
  for(var mi2=0;mi2<mems.length;mi2++){
    var mem=mems[mi2];
    var init=mem[0],col=mem[1],nm=mem[2],role=mem[3],ans=mem[4];
    var row=af(mmc,"m-"+nm,{w:350,h:56,layout:"HORIZONTAL",crossAlign:"CENTER",pl:16,pr:16,gap:12});row.layoutAlign="STRETCH";
    avatar(row,init,col,36);var nc=af(row,"info",{layout:"VERTICAL",gap:2});nc.layoutGrow=1;
    await txt(nc,nm,15,600,C.text1);if(role)await txt(nc,role,11,400,C.text3);
    var bg2=af(row,"st",{h:24,corner:100,fills:rgb(ans?C.success:C.text3,0.1),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:10,pr:10});
    await txt(bg2,ans?"回答済み":"未回答",11,600,ans?C.success:C.text3);
    if(mi2<mems.length-1){var d=figma.createRectangle();d.resize(350,1);d.fills=rgb(C.border,0.3);d.layoutAlign="STRETCH";mmc.appendChild(d);}
  }
  await pill(wt,"Share",350,52,C.surface,"招待リンクを共有",15,C.text1,600);var shb=wt.children[wt.children.length-1];shb.x=20;shb.y=H-180;shb.strokes=rgb(C.border);shb.strokeWeight=1.5;
  await pill(wt,"Search",350,52,C.primary,"お店を探す",16,"#FFFFFF",600);var srb=wt.children[wt.children.length-1];srb.x=20;srb.y=H-116;

  // 9. SEARCHING
  var srch=af(page,"Searching",{w:W,h:H,fills:rgb(C.bg),x:nx()});
  var sctr=af(srch,"Center",{w:W,h:H,layout:"VERTICAL",mainAlign:"CENTER",crossAlign:"CENTER",gap:24});
  var pls=af(sctr,"Pulse",{w:120,h:120});
  var r1=figma.createEllipse();r1.resize(120,120);r1.fills=rgb(C.primary,0.06);pls.appendChild(r1);
  var r2=figma.createEllipse();r2.resize(100,100);r2.fills=rgb(C.primary,0.08);r2.x=10;r2.y=10;pls.appendChild(r2);
  var r3=figma.createEllipse();r3.resize(80,80);r3.fills=rgb(C.primary,0.12);r3.x=20;r3.y=20;pls.appendChild(r3);
  var sib=af(pls,"Icon",{w:60,h:60,x:30,y:30,corner:100,fills:rgb(C.primary,0.15),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});
  await txt(sib,"🔍",24,400,C.primary);
  var pw=af(sctr,"Prog",{w:280,h:6,corner:6,fills:rgb(C.border)});
  var pfl=figma.createRectangle();pfl.resize(180,6);pfl.cornerRadius=6;pfl.fills=rgb(C.primary);pw.appendChild(pfl);
  await txt(sctr,"64%",13,500,C.text3,{align:"CENTER"});
  await txt(sctr,"レストランを検索中...",16,600,C.text1,{align:"CENTER"});
  await txt(sctr,"AIがベストマッチを探しています",14,400,C.text2,{align:"CENTER"});

  // 10. RESULTS
  var res=af(page,"Results",{w:W,h:1400,fills:rgb(C.bg),x:nx()});
  await txt(res,"← ホーム",16,500,C.primary,{x:20,y:20});await txt(res,"金曜ランチ会",20,700,C.text1,{x:20,y:52});
  var ab=af(res,"Areas",{w:200,x:20,y:82,layout:"HORIZONTAL",gap:6});
  var areaLabels=["新宿","六本木"];
  for(var ali=0;ali<areaLabels.length;ali++){var al=areaLabels[ali];var abtn=af(ab,al,{h:24,corner:100,fills:rgb(C.primary,0.08),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:10,pr:10});await txt(abtn,al,12,500,C.primary);}
  var avst=af(res,"AvStack",{w:80,h:32,x:270,y:52,layout:"HORIZONTAL",gap:-8});
  var resAv=[["Y","#C26A4A"],["T","#6B7A52"],["M","#4A6B9A"]];
  for(var ri=0;ri<resAv.length;ri++){var ra=af(avst,"a",{w:32,h:32,corner:100,fills:rgb(resAv[ri][1]),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});ra.strokes=rgb(C.surface);ra.strokeWeight=2;await txt(ra,resAv[ri][0],13,700,"#FFFFFF");}
  var dots=af(res,"Menu",{w:32,h:32,x:346,y:52,corner:100,fills:rgb(C.bgSec),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});await txt(dots,"⋮",18,700,C.text2);
  // Decided
  var dec=af(res,"Decided",{w:350,x:20,y:118,corner:14,fills:rgb(C.success,0.06),strokes:rgb(C.success,0.2),strokeW:1,layout:"HORIZONTAL",crossAlign:"CENTER",gap:10,pl:14,pr:14,pt:12,pb:12});
  await txt(dec,"✓",14,700,C.success);var dci=af(dec,"Info",{layout:"VERTICAL",gap:2});dci.layoutGrow=1;
  await txt(dci,"決定済み",12,700,C.success);await txt(dci,"鳥貴族 新宿東口店",15,600,C.text1);
  // Tabs
  var atb=af(res,"Tabs",{w:350,x:20,y:186,layout:"HORIZONTAL",gap:8});
  var tabItems=[["すべて",true],["新宿",false],["六本木",false]];
  for(var ti=0;ti<tabItems.length;ti++){var tl=tabItems[ti][0],ts2=tabItems[ti][1];var t2=af(atb,tl,{h:36,corner:100,fills:ts2?rgb(C.secondary):rgb(C.surface),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:18,pr:18});if(!ts2){t2.strokes=rgb(C.border);t2.strokeWeight=1;}await txt(t2,tl,14,ts2?600:400,ts2?"#FFFFFF":C.text2);}
  // Sort
  var srt=af(res,"Sort",{w:350,x:20,y:236,layout:"HORIZONTAL",mainAlign:"SPACE_BETWEEN",crossAlign:"CENTER"});
  await txt(srt,"8件の結果",13,400,C.text3);
  var stg=af(srt,"Toggle",{h:36,corner:100,fills:rgb(C.bgSec),layout:"HORIZONTAL",gap:0,pt:4,pb:4,pl:4,pr:4});
  var sm=af(stg,"Match",{h:28,corner:100,fills:rgb(C.surface),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:14,pr:14,shadow:shadow(0,1,2,0,0.06)});await txt(sm,"一致度",13,600,C.text1);
  var sra=af(stg,"Rate",{h:28,corner:100,layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:14,pr:14});await txt(sra,"評価",13,400,C.text3);
  // Restaurant cards
  var ry=290;
  var rests=[
    {n:"鳥貴族 新宿東口店",g:"居酒屋",b:"2000〜3000円",s:0.92,r:4.2,a:"新宿駅 徒歩3分",gc:"#6E6E7A",pr:true},
    {n:"AFURI 六本木ヒルズ",g:"ラーメン",b:"1000〜2000円",s:0.85,r:4.5,a:"六本木駅 徒歩2分",gc:"#C26A4A",pr:false},
    {n:"叙々苑 新宿小田急店",g:"焼肉",b:"5000〜8000円",s:0.78,r:4.3,a:"新宿駅 徒歩1分",gc:"#B33A3A",pr:true}
  ];
  for(var rri=0;rri<rests.length;rri++){
    var rt=rests[rri];
    var rc=crd(res,rt.n,{w:350,x:20,y:ry,corner:20,layout:"VERTICAL",gap:0});
    var br=figma.createRectangle();br.resize(350,4);br.fills=rgb(rt.gc,0.6);br.topLeftRadius=20;br.topRightRadius=20;br.layoutAlign="STRETCH";rc.appendChild(br);
    var co=af(rc,"Co",{w:350,layout:"VERTICAL",gap:12,pl:18,pr:18,pt:16,pb:16});co.layoutAlign="STRETCH";
    var nr=af(co,"NR",{w:314,layout:"HORIZONTAL",mainAlign:"SPACE_BETWEEN",crossAlign:"MIN",gap:8});nr.layoutAlign="STRETCH";
    var nt=await txt(nr,rt.n,17,700,C.text1,{w:240});nt.layoutGrow=1;
    var sp=Math.round(rt.s*100),sc2=rt.s>=0.8?C.primary:rt.s>=0.6?C.warning:C.text3;
    var sbg=af(nr,"Score",{h:24,corner:100,fills:rgb(sc2),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:10,pr:10});await txt(sbg,sp+"%",11,700,"#FFFFFF");
    var cr=af(co,"Chips",{w:314,layout:"HORIZONTAL",gap:6});cr.layoutAlign="STRETCH";cr.layoutWrap="WRAP";
    var chipLabels=[rt.g,rt.b];
    for(var cli=0;cli<chipLabels.length;cli++){var cf=af(cr,chipLabels[cli],{h:28,corner:100,fills:rgb(C.bgSec),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:12,pr:12});await txt(cf,chipLabels[cli],12,500,C.text2);}
    if(rt.pr){var prv=af(cr,"PR",{h:28,corner:8,fills:rgb(C.secondary,0.06),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER",pl:10,pr:10});await txt(prv,"個室あり",12,500,C.secondary);}
    var ms=af(co,"Match",{w:314,layout:"VERTICAL",gap:4});ms.layoutAlign="STRETCH";await txt(ms,"一致度",12,500,C.text2);
    var brr=af(ms,"Bar",{w:314,layout:"HORIZONTAL",crossAlign:"CENTER",gap:8});brr.layoutAlign="STRETCH";
    var bbg=af(brr,"Bg",{w:260,h:8,corner:8,fills:rgb("#F0F0EC")});bbg.layoutGrow=1;
    var bf=figma.createRectangle();bf.resize(260*rt.s,8);bf.cornerRadius=8;bf.fills=rgb(sc2);bbg.appendChild(bf);
    await txt(brr,sp+"%",13,600,sc2,{w:40,align:"RIGHT"});
    var bt=af(co,"Bot",{w:314,layout:"HORIZONTAL",mainAlign:"SPACE_BETWEEN",crossAlign:"CENTER"});bt.layoutAlign="STRETCH";
    var sts=af(bt,"Stars",{layout:"HORIZONTAL",crossAlign:"CENTER",gap:4});
    for(var si2=1;si2<=5;si2++){var star=figma.createRectangle();star.resize(12,12);star.cornerRadius=2;star.fills=rgb(C.warning,si2<=Math.floor(rt.r)?1:0.2);sts.appendChild(star);}
    await txt(sts,rt.r.toFixed(1),13,600,C.warning);await txt(bt,rt.a,12,400,C.text2,{align:"RIGHT"});
    ry+=rc.height+14;
  }

  // 11. CONFIRM DIALOG
  var cdlg=af(page,"ConfirmDialog",{w:W,h:H,fills:rgb("#000000",0.5),x:nx()});
  var dlg=crd(cdlg,"Dlg",{w:320,x:35,y:300,corner:24,layout:"VERTICAL",crossAlign:"CENTER",gap:16,pad:28});
  var wc=af(dlg,"Warn",{w:48,h:48,corner:100,fills:rgb(C.danger,0.1),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});await txt(wc,"⚠",20,400,C.danger);
  await txt(dlg,"グループを削除しますか？",18,700,C.text1,{align:"CENTER",w:264});
  await txt(dlg,"この操作は取り消せません。\nグループのすべてのデータが削除されます。",14,400,C.text2,{align:"CENTER",w:264});
  var dbs=af(dlg,"Btns",{w:264,layout:"HORIZONTAL",gap:10});dbs.layoutAlign="STRETCH";
  var cnb=af(dbs,"Cancel",{h:48,corner:100,fills:rgb(C.bgSec),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});cnb.layoutGrow=1;await txt(cnb,"キャンセル",15,600,C.text2,{align:"CENTER"});
  var dlb=af(dbs,"Del",{h:48,corner:100,fills:rgb(C.danger),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});dlb.layoutGrow=1;await txt(dlb,"削除する",15,600,"#FFFFFF",{align:"CENTER"});

  // 12. INVITE
  var inv=af(page,"Invite",{w:W,h:H,fills:rgb(C.bg),x:nx()});
  await txt(inv,"MeshiMatch",22,700,C.text1,{x:0,y:40,w:W,align:"CENTER"});
  var ic=crd(inv,"Card",{w:350,x:20,y:100,corner:24,layout:"VERTICAL",crossAlign:"CENTER",gap:20,pad:32,strokes:rgb(C.border,0.5),strokeW:1});
  await txt(ic,"グループに招待されました",13,400,C.text3,{align:"CENTER"});
  await txt(ic,"金曜ランチ会",22,700,C.primary,{align:"CENTER"});
  await txt(ic,"4人が参加中",14,400,C.text2,{align:"CENTER"});
  var ib=af(ic,"Info",{w:286,corner:14,fills:rgb(C.primary,0.06),layout:"VERTICAL",crossAlign:"CENTER",gap:8,pad:18});ib.layoutAlign="STRETCH";
  await txt(ib,"アンケートに答えてね",13,700,C.primary,{align:"CENTER"});
  await txt(ib,"好きなジャンルや気分を答えると、\nAIがみんなに合うお店を提案します",13,400,C.text2,{align:"CENTER",w:250});
  await pill(ic,"Join",286,52,C.primary,"アンケートに答える →",16,"#FFFFFF",600);
  await txt(ic,"ログインが必要です",12,400,C.text3,{align:"CENTER"});

  // 13. NOTIFICATIONS
  var ntf=af(page,"Notifications",{w:W,h:H,fills:rgb("#000000",0.5),x:nx()});
  var sht=af(ntf,"Sheet",{w:W,h:560,x:0,y:H-560,fills:rgb(C.surface),corner:24,layout:"VERTICAL",gap:16,pl:20,pr:20,pt:12,pb:24});
  sht.topLeftRadius=24;sht.topRightRadius=24;sht.bottomLeftRadius=0;sht.bottomRightRadius=0;
  var hdl=af(sht,"Handle",{w:40,h:4,corner:4,fills:rgb(C.border)});hdl.layoutAlign="CENTER";
  var nh=af(sht,"Header",{w:350,layout:"HORIZONTAL",mainAlign:"SPACE_BETWEEN",crossAlign:"CENTER"});nh.layoutAlign="STRETCH";
  await txt(nh,"通知",20,700,C.text1);var cn=af(nh,"Close",{w:32,h:32,corner:100,fills:rgb(C.bgSec),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});await txt(cn,"×",16,400,C.text2);
  // Inv1
  var iv1=af(sht,"Inv1",{w:350,layout:"VERTICAL",gap:12});iv1.layoutAlign="STRETCH";
  var ir1=af(iv1,"Row",{w:350,layout:"HORIZONTAL",crossAlign:"CENTER",gap:10});ir1.layoutAlign="STRETCH";avatar(ir1,"T","#6B7A52",40);
  var ii1=af(ir1,"Info",{layout:"VERTICAL",gap:2});ii1.layoutGrow=1;
  var il1=af(ii1,"Line",{layout:"HORIZONTAL",gap:4});await txt(il1,"たかし",14,600,C.primary);await txt(il1,"さんからの招待",14,400,C.text1);
  await txt(ii1,"2時間前",12,400,C.text3);
  var gi1=af(iv1,"Group",{w:350,corner:12,fills:rgb(C.bgSec),layout:"HORIZONTAL",crossAlign:"CENTER",gap:8,pad:14});gi1.layoutAlign="STRETCH";
  await txt(gi1,"🍽",16,400,C.text2);var gd1=af(gi1,"D",{layout:"VERTICAL",gap:2});gd1.layoutGrow=1;
  await txt(gd1,"金曜ランチ会",14,600,C.text1);await txt(gd1,"4人のメンバー",12,400,C.text2);
  await pill(iv1,"Join1",350,46,C.primary,"参加してアンケートに回答する",14,"#FFFFFF",600);var jb1=iv1.children[iv1.children.length-1];jb1.layoutAlign="STRETCH";
  var dvn=figma.createRectangle();dvn.resize(350,1);dvn.fills=rgb(C.border,0.3);dvn.layoutAlign="STRETCH";sht.appendChild(dvn);
  // Inv2
  var iv2=af(sht,"Inv2",{w:350,layout:"VERTICAL",gap:12});iv2.layoutAlign="STRETCH";
  var ir2=af(iv2,"Row",{w:350,layout:"HORIZONTAL",crossAlign:"CENTER",gap:10});ir2.layoutAlign="STRETCH";avatar(ir2,"M","#4A6B9A",40);
  var ii2=af(ir2,"Info",{layout:"VERTICAL",gap:2});ii2.layoutGrow=1;
  var il2=af(ii2,"Line",{layout:"HORIZONTAL",gap:4});await txt(il2,"みさき",14,600,C.primary);await txt(il2,"さんからの招待",14,400,C.text1);
  await txt(ii2,"1日前",12,400,C.text3);
  var gi2=af(iv2,"Group",{w:350,corner:12,fills:rgb(C.bgSec),layout:"HORIZONTAL",crossAlign:"CENTER",gap:8,pad:14});gi2.layoutAlign="STRETCH";
  await txt(gi2,"🍽",16,400,C.text2);var gd2=af(gi2,"D",{layout:"VERTICAL",gap:2});gd2.layoutGrow=1;
  await txt(gd2,"チーム飲み会",14,600,C.text1);await txt(gd2,"6人のメンバー",12,400,C.text2);
  await pill(iv2,"Join2",350,46,C.primary,"参加してアンケートに回答する",14,"#FFFFFF",600);var jb2=iv2.children[iv2.children.length-1];jb2.layoutAlign="STRETCH";

  // 14. SURVEY COMPLETE
  var cmp=af(page,"SurveyComplete",{w:W,h:H,fills:rgb(C.bg),x:nx()});
  var cctr=af(cmp,"Center",{w:W,h:H,layout:"VERTICAL",mainAlign:"CENTER",crossAlign:"CENTER",gap:20});
  var scc=af(cctr,"OK",{w:80,h:80,corner:100,fills:rgb(C.success,0.12),layout:"HORIZONTAL",mainAlign:"CENTER",crossAlign:"CENTER"});
  await txt(scc,"✓",36,700,C.success);
  await txt(cctr,"回答完了！",24,700,C.text1,{align:"CENTER"});
  await txt(cctr,"みんなの回答を待っています...",15,400,C.text2,{align:"CENTER"});
  var spr=af(cctr,"Spin",{layout:"HORIZONTAL",crossAlign:"CENTER",gap:8});
  var spn=figma.createEllipse();spn.resize(20,20);spn.fills=[];spn.strokes=rgb(C.border);spn.strokeWeight=3;
  spn.arcData={startingAngle:0,endingAngle:4.71,innerRadius:0.7};spr.appendChild(spn);
  await txt(spr,"待機室に移動中...",14,400,C.text2);

  figma.notify("全15画面を生成しました！");
  figma.closePlugin();
})();
