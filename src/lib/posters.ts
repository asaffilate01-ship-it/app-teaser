/** 1080×1350 social posters (Instagram portrait) drawn on a canvas. Browser-only: call from event handlers. */
import type { TopPerformers } from "./social-posts.ts";

// Brand colours for shareable images (canvas cannot read CSS tokens reliably).
const navy = "#141a2e";
const navyDeep = "#0c1020";
const panel = "#1d2540";
const gold = "#e3b341";
const text = "#f2f3f7";
const muted = "#a3a9bf";
const crimson = "#e0475b";
const W = 1080;
const H = 1350;

const display = (size: number) => `600 ${size}px Oswald, 'Arial Narrow', Arial, sans-serif`;
const body = (size: number, weight = 400) => `${weight} ${size}px Arial, sans-serif`;

async function loadFonts() {
  try {
    await document.fonts?.load(display(64));
    await document.fonts?.ready;
  } catch {
    // Falls back to Arial Narrow / Arial.
  }
}

function base(kicker: string) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, navy);
  sky.addColorStop(1, navyDeep);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Pitch stripe motif.
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = gold;
  for (let x = -H; x < W; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 50, H);
    ctx.lineTo(x + 50 + H, 0);
    ctx.lineTo(x + H, 0);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, W, 14);
  ctx.textAlign = "center";
  ctx.fillStyle = gold;
  ctx.font = body(30, 700);
  ctx.fillText(kicker.split("").join(String.fromCharCode(8202)), W / 2, 110);
  return { canvas, ctx };
}

function fit(ctx: CanvasRenderingContext2D, value: string, max: number, start: number, font: (size: number) => string) {
  let size = start;
  ctx.font = font(size);
  while (size > 28 && ctx.measureText(value).width > max) {
    size -= 4;
    ctx.font = font(size);
  }
  return size;
}

async function finish(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, logoUrl: string | null, footer: string) {
  if (logoUrl) {
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = logoUrl;
      await image.decode();
      const h = 70;
      const w = (image.width / image.height) * h;
      ctx.drawImage(image, (W - w) / 2, H - 170, w, h);
    } catch {
      // The poster is still useful without the logo.
    }
  }
  ctx.textAlign = "center";
  ctx.fillStyle = muted;
  ctx.font = body(24);
  ctx.fillText(footer, W / 2, H - 60, W - 120);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Poster could not be created"))), "image/png"),
  );
}

export async function resultPoster(input: {
  innings: { team: string; total: string; overs: string }[];
  result: string | null;
  subtitle: string;
  top: TopPerformers;
  logoUrl: string | null;
}): Promise<Blob> {
  await loadFonts();
  const { canvas, ctx } = base(input.result ? "FULL TIME" : "SCORE UPDATE");
  ctx.fillStyle = muted;
  ctx.font = body(28);
  ctx.fillText(input.subtitle, W / 2, 160, W - 120);

  let y = 220;
  const rows = input.innings.slice(0, 4);
  const rowH = rows.length > 2 ? 150 : 210;
  for (const inn of rows) {
    ctx.fillStyle = panel;
    ctx.beginPath();
    ctx.roundRect(80, y, W - 160, rowH - 24, 28);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = text;
    fit(ctx, inn.team, 520, rows.length > 2 ? 54 : 64, display);
    ctx.fillText(inn.team, 120, y + (rowH - 24) / 2 + 20, 540);
    ctx.textAlign = "right";
    ctx.fillStyle = gold;
    ctx.font = display(rows.length > 2 ? 72 : 96);
    ctx.fillText(inn.total, W - 120, y + (rowH - 24) / 2 + 18);
    ctx.fillStyle = muted;
    ctx.font = body(24);
    ctx.fillText(`${inn.overs} overs`, W - 120, y + rowH - 46);
    y += rowH;
  }
  ctx.textAlign = "center";
  if (input.result) {
    y += 40;
    ctx.fillStyle = text;
    fit(ctx, input.result, W - 160, 64, display);
    ctx.fillText(input.result, W / 2, y + 30, W - 160);
    y += 80;
  }
  const performers = [
    input.top.batter && ["TOP BAT", input.top.batter.name, `${input.top.batter.runs}${input.top.batter.notOut ? "*" : ""} (${input.top.batter.balls})`],
    input.top.bowler && ["TOP BOWL", input.top.bowler.name, `${input.top.bowler.wickets}/${input.top.bowler.runs}`],
  ].filter(Boolean) as string[][];
  if (performers.length) {
    y += 30;
    const width = (W - 160 - (performers.length - 1) * 30) / performers.length;
    performers.forEach(([label, name, figure], index) => {
      const x = 80 + index * (width + 30);
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, width, 200, 24);
      ctx.stroke();
      ctx.fillStyle = crimson;
      ctx.font = body(24, 700);
      ctx.fillText(label!, x + width / 2, y + 50);
      ctx.fillStyle = text;
      fit(ctx, name!, width - 40, 40, display);
      ctx.fillText(name!, x + width / 2, y + 105, width - 40);
      ctx.fillStyle = gold;
      ctx.font = display(52);
      ctx.fillText(figure!, x + width / 2, y + 170);
    });
  }
  return finish(canvas, ctx, input.logoUrl, "Scored live with CricLume · criclume.com");
}

export async function fixturePoster(input: {
  home: string;
  away: string;
  when: string | null;
  ground: string | null;
  competition: string | null;
  link: string | null;
  logoUrl: string | null;
}): Promise<Blob> {
  await loadFonts();
  const { canvas, ctx } = base("MATCH DAY");
  if (input.competition) {
    ctx.fillStyle = muted;
    ctx.font = body(30);
    ctx.fillText(input.competition, W / 2, 165, W - 120);
  }
  ctx.fillStyle = text;
  fit(ctx, input.home, W - 160, 120, display);
  ctx.fillText(input.home, W / 2, 400, W - 160);
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(W / 2, 510, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = navy;
  ctx.font = display(64);
  ctx.fillText("V", W / 2, 534);
  ctx.fillStyle = text;
  fit(ctx, input.away, W - 160, 120, display);
  ctx.fillText(input.away, W / 2, 720, W - 160);

  let y = 840;
  for (const line of [input.when, input.ground].filter(Boolean) as string[]) {
    ctx.fillStyle = panel;
    ctx.beginPath();
    ctx.roundRect(140, y, W - 280, 90, 45);
    ctx.fill();
    ctx.fillStyle = text;
    ctx.font = display(44);
    ctx.fillText(line, W / 2, y + 60, W - 340);
    y += 115;
  }
  if (input.link) {
    ctx.fillStyle = crimson;
    ctx.font = body(28, 700);
    ctx.fillText("● FOLLOW LIVE", W / 2, y + 40);
    ctx.fillStyle = muted;
    ctx.font = body(26);
    ctx.fillText(input.link.replace(/^https?:\/\//, ""), W / 2, y + 80, W - 160);
  }
  return finish(canvas, ctx, input.logoUrl, "criclume.com");
}

/** Share a poster through the phone's share sheet, or download it on desktop. */
export async function sharePoster(blob: Blob, fileName: string, title: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
