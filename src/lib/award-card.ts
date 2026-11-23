/** Shareable award card / certificate drawn on a canvas (1080×1350, portrait for social posts). */
export interface AwardCardInput {
  title: string;
  playerName: string;
  detail: string;
  team: string;
  date?: string | undefined;
  kind: "card" | "certificate";
}

export const awardCardSize = { width: 1080, height: 1350 } as const;

/** Break text into lines that fit a width (used for long award details). */
export function wrapWords(text: string, fits: (line: string) => boolean, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next) || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/[.,;:]?$/, "")}…`;
    return kept;
  }
  return lines;
}

const token = (name: string, fallback: string) => {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

export function drawAwardCard(canvas: HTMLCanvasElement, input: AwardCardInput) {
  const { width: W, height: H } = awardCardSize;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const gold = token("--gold", "#e6b84a");
  const ink = "#0d1b2e";
  const paper = "#f7f3ea";
  const certificate = input.kind === "certificate";
  ctx.fillStyle = certificate ? paper : ink;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 14;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 3;
  ctx.strokeRect(70, 70, W - 140, H - 140);
  ctx.textAlign = "center";
  const text = certificate ? ink : "#ffffff";
  ctx.fillStyle = gold;
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText(certificate ? "CERTIFICATE OF ACHIEVEMENT" : input.team.toUpperCase(), W / 2, 200);
  // Trophy mark
  ctx.beginPath();
  ctx.arc(W / 2, 400, 120, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.fillStyle = certificate ? paper : ink;
  ctx.font = "700 130px system-ui, sans-serif";
  ctx.fillText("★", W / 2, 445);
  ctx.fillStyle = text;
  ctx.font = "800 86px system-ui, sans-serif";
  const titleLines = wrapWords(input.title, (line) => ctx.measureText(line).width < W - 220, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, 660 + i * 96));
  const afterTitle = 660 + titleLines.length * 96;
  ctx.fillStyle = gold;
  ctx.font = "700 64px system-ui, sans-serif";
  ctx.fillText(input.playerName, W / 2, afterTitle + 60);
  ctx.fillStyle = text;
  ctx.globalAlpha = 0.85;
  ctx.font = "500 42px system-ui, sans-serif";
  wrapWords(input.detail, (line) => ctx.measureText(line).width < W - 260, 3).forEach((line, i) => ctx.fillText(line, W / 2, afterTitle + 160 + i * 56));
  ctx.globalAlpha = 0.7;
  ctx.font = "500 34px system-ui, sans-serif";
  ctx.fillText([certificate ? input.team : "", input.date ?? ""].filter(Boolean).join(" · "), W / 2, H - 190);
  ctx.globalAlpha = 1;
  ctx.fillStyle = gold;
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("CricLume", W / 2, H - 120);
}

/** Share through the phone's share sheet when possible, otherwise download the picture. */
export async function shareAwardCard(input: AwardCardInput) {
  const canvas = document.createElement("canvas");
  drawAwardCard(canvas, input);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const name = `${input.playerName}-${input.title}`.replace(/[^\w-]+/g, "-").slice(0, 80) + ".png";
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: input.title });
      return;
    } catch {
      /* fall back to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
