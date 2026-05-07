import { AttachmentBuilder } from 'discord.js'; import { createCanvas, loadImage, registerFont } from 'canvas'; import path from 'path'; import fs from 'fs';

// ============================================================================ // MODULE CONFIG (FIXED FOR LOADER) // ============================================================================

const configSchema = { type: 'object', properties: {} };

const events = [];

// ============================================================================ // PATHS // ============================================================================

const ROOT = process.cwd(); const FONT_DIR = path.join(ROOT, 'src', 'modules', 'leveling', 'assets', 'fonts');

// ============================================================================ // LOG // ============================================================================

const log = (...a) => console.log('[LEVELING]', ...a); const err = (...a) => console.error('[LEVELING]', ...a);

// ============================================================================ // FONTS // ============================================================================

function loadFont(name, file, weight='normal') { try { const p = path.join(FONT_DIR, file); if (!fs.existsSync(p)) return; registerFont(p, { family: name, weight }); log('Font loaded', file); } catch (e) { err('Font error', file, e); } }

loadFont('Satoshi','Satoshi-Black.otf','900'); loadFont('Satoshi','Satoshi-Bold.otf','700'); loadFont('Inter','Inter_24pt-SemiBold.ttf','600'); loadFont('Inter','Inter_24pt-Regular.ttf','400');

// ============================================================================ // CARD SIZE // ============================================================================

const CARD = { w: 1034, h: 491 };

// ============================================================================ // HELPERS // ============================================================================

const rr = (ctx,x,y,w,h,r)=>{ const R=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+R,y); ctx.arcTo(x+w,y,x+w,y+h,R); ctx.arcTo(x+w,y+h,x,y+h,R); ctx.arcTo(x,y+h,x,y,R); ctx.arcTo(x,y,x+w,y,R); ctx.closePath(); };

const fr = (ctx,...a)=>{rr(ctx,...a);ctx.fillStyle=a[5];ctx.fill();}; const sr = (ctx,x,y,w,h,r,c,l=1)=>{rr(ctx,x,y,w,h,r);ctx.strokeStyle=c;ctx.lineWidth=l;ctx.stroke();};

const rgba=(h,a)=>{ const v=parseInt(h.slice(1),16); return rgba(${v>>16&255},${v>>8&255},${v&255},${a}); };

const font=(ctx,w,s,f='Satoshi')=>ctx.font=${w} ${s}px "${f}";

const fit=(ctx,t,x,y,m)=>{ let s=String(t); while(ctx.measureText(s).width>m&&s.length>0)s=s.slice(0,-1); if(s!==t)s+='...'; ctx.fillText(s,x,y); };

const k=num=>num>=1000?(num/1000).toFixed(num%1000?1:0)+'K':String(num);

// ============================================================================ // STATS // ============================================================================

function stats(id){ const seed=Number(String(id).slice(-6)); const cur=2900+(seed%450); const need=5000; return { rank:1+(seed%99), current:cur, needed:need, progress:cur/need, daily:3500, lifetime:89121 }; }

// ============================================================================ // AVATAR // ============================================================================

async function avatar(u){ try{ const url=u.displayAvatarURL({extension:'png',size:512}); const r=await fetch(url); if(!r.ok)return null; return await loadImage(Buffer.from(await r.arrayBuffer())); }catch{return null;} }

// ============================================================================ // BACKGROUND (GLASS + NEON GRID) // ============================================================================

function bg(ctx){ const g=ctx.createLinearGradient(0,0,CARD.w,CARD.h); g.addColorStop(0,'#05060F'); g.addColorStop(1,'#12081F'); ctx.fillStyle=g; ctx.fillRect(0,0,CARD.w,CARD.h);

// glow const glow=ctx.createRadialGradient(850,150,50,850,150,400); glow.addColorStop(0,rgba('#A855F7',0.25)); glow.addColorStop(1,'transparent'); ctx.fillStyle=glow; ctx.fillRect(0,0,CARD.w,CARD.h);

// glass base fr(ctx,20,20,CARD.w-40,CARD.h-40,28,rgba('#0B0F1A',0.75)); sr(ctx,20,20,CARD.w-40,CARD.h-40,28,rgba('#C084FC',0.35),1.2);

// grid ctx.save(); ctx.globalAlpha=0.06; ctx.strokeStyle='#fff'; for(let i=0;i<20;i++){ ctx.beginPath();ctx.moveTo(i60,0);ctx.lineTo(i60,CARD.h);ctx.stroke(); } ctx.restore(); }

// ============================================================================ // AVATAR // ============================================================================

function drawAvatar(ctx,a){ const x=60,y=60,r=85; const cx=x+r,cy=y+r;

ctx.save(); ctx.shadowColor='#A855F7'; ctx.shadowBlur=40; ctx.beginPath();ctx.arc(cx,cy,92,0,Math.PI*2); ctx.strokeStyle=rgba('#A855F7',0.9); ctx.lineWidth=10;ctx.stroke();ctx.restore();

ctx.beginPath();ctx.arc(cx,cy,76,0,Math.PI*2);ctx.clip();

if(a)ctx.drawImage(a,x+8,y+8,160,160); else ctx.fillRect(x,y,160,160); }

// ============================================================================ // MAIN UI // ============================================================================

function draw(ctx,u,s){ const name=u.globalName||u.username;

// username ctx.fillStyle='#fff';font(ctx,'900',54);fit(ctx,name,360,90,400);

ctx.fillStyle='#A78BFA';font(ctx,'600',22,'Inter');ctx.fillText('@'+u.username,360,120);

// rank big ctx.fillStyle='#fff';font(ctx,'900',90);ctx.fillText('#'+s.rank,70,330); ctx.fillStyle='#A855F7';font(ctx,'700',26,'Inter');ctx.fillText('GLOBAL RANK',70,370);

// status pill fr(ctx,70,390,200,42,22,rgba('#14532D',0.35)); ctx.fillStyle='#22C55E';font(ctx,'700',18,'Inter');ctx.fillText('● SUPER ACTIVE',95,418);

// progress const x=360,y=160,w=600,h=40; fr(ctx,x,y,w,h,22,rgba('#111827',0.9));

const p=ctx.createLinearGradient(x,y,x+w,y); p.addColorStop(0,'#9333EA');p.addColorStop(1,'#C084FC');

fr(ctx,x,y,w*s.progress,h,22,p);

ctx.fillStyle='#fff';font(ctx,'700',16,'Inter'); ctx.fillText(${k(s.current)} / ${k(s.needed)},x+20,y+26); ctx.fillText(${Math.round(s.progress*100)}%,x+w-60,y+26);

// stats panel fr(ctx,360,260,600,120,22,rgba('#0B1020',0.75));

ctx.fillStyle='#fff';font(ctx,'900',38); ctx.fillText(k(s.daily),420,320); ctx.fillText(k(s.lifetime),720,320);

ctx.fillStyle='#9CA3AF';font(ctx,'600',14,'Inter'); ctx.fillText('DAILY XP',420,290); ctx.fillText('LIFETIME XP',720,290); }

// ============================================================================ // RENDER // ============================================================================

function render(u,a,s){ const c=createCanvas(CARD.w,CARD.h); const ctx=c.getContext('2d');

bg(ctx); drawAvatar(ctx,a); draw(ctx,u,s);

return c.toBuffer('image/png'); }

// ============================================================================ // BUILD // ============================================================================

async function build(user){ const a=await avatar(user); const s=stats(user.id); return new AttachmentBuilder(render(user,a,s),{name:rank-${user.id}.png}); }

// ============================================================================ // EXPORT MODULE // ============================================================================

export default { name:'leveling', configSchema, events,

commands:[{ name:'rank', description:'rank card',

async execute(i){
  try{
    if(!i.deferred&&!i.replied) await i.deferReply();

    const file=await build(i.user);
    await i.editReply({files:[file]});

  }catch(e){
    console.error('[LEVELING ERROR]',e);

    if(i.deferred||i.replied)
      await i.editReply('❌ Card generation failed');
    else
      await i.reply({content:'❌ Failed',ephemeral:true});
  }
}

]} };
