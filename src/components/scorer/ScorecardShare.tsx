import { useState } from "react";
import { Copy, FileDown, ImageDown, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { CricketMatch } from "@/lib/cricket";
import { scorecardHtml, scorecardSheet, scorecardText, type ScorecardSheet } from "@/lib/scorecard-share";

const fileSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "scorecard";

/** Draws the scorecard as a 1080px-wide image, ready for WhatsApp, Instagram or a club website. */
function drawScorecard(sheet: ScorecardSheet): Promise<Blob> {
  const width = 1080;
  const pad = 56;
  const rowH = 40;
  const heights = sheet.innings.map((inn) => 150 + (inn.batting.length + 1) * rowH + 70 + (inn.bowling.length + 1) * rowH + 40);
  const height = 260 + (sheet.result ? 50 : 0) + heights.reduce((sum, h) => sum + h, 0) + 90;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // Brand colours for a shareable image (canvas cannot read CSS tokens reliably).
  const navy = "#141a2e";
  const panel = "#1d2540";
  const gold = "#e3b341";
  const text = "#f2f3f7";
  const muted = "#a3a9bf";
  const crimson = "#e0475b";
  const display = "600 1px Oswald, 'Arial Narrow', Arial, sans-serif";
  const font = (size: number, weight = 400, family = "Arial, sans-serif") => `${weight} ${size}px ${family}`;
  const displayFont = (size: number) => display.replace("1px", `${size}px`);

  ctx.fillStyle = navy;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, width, 10);

  let y = 90;
  ctx.fillStyle = gold;
  ctx.font = font(22, 700);
  ctx.fillText("SCORECARD", pad, y - 30);
  ctx.fillStyle = text;
  ctx.font = displayFont(52);
  ctx.fillText(sheet.title, pad, y + 20, width - pad * 2);
  y += 64;
  ctx.fillStyle = muted;
  ctx.font = font(24);
  ctx.fillText(sheet.subtitle, pad, y, width - pad * 2);
  y += 20;
  if (sheet.result) {
    y += 40;
    ctx.fillStyle = gold;
    ctx.font = displayFont(34);
    ctx.fillText(sheet.result, pad, y, width - pad * 2);
  }
  y += 50;

  const cols = (positions: number[], values: (string | number)[], colour: string, weight = 400) => {
    ctx.font = font(24, weight);
    values.forEach((value, index) => {
      const left = index === 0;
      ctx.fillStyle = index === 0 ? text : colour;
      ctx.textAlign = left ? "left" : "right";
      ctx.fillText(String(value), positions[index]!, y, left ? 420 : 120);
    });
    ctx.textAlign = "left";
  };

  for (const inn of sheet.innings) {
    ctx.fillStyle = panel;
    ctx.beginPath();
    ctx.roundRect(pad - 20, y - 10, width - pad * 2 + 40, 84, 18);
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.font = font(20, 700);
    ctx.fillText(inn.title.toUpperCase(), pad, y + 22);
    ctx.fillStyle = text;
    ctx.font = displayFont(36);
    ctx.fillText(inn.team, pad, y + 60, 600);
    ctx.textAlign = "right";
    ctx.fillStyle = gold;
    ctx.font = displayFont(44);
    ctx.fillText(inn.total, width - pad, y + 50);
    ctx.fillStyle = muted;
    ctx.font = font(20);
    ctx.fillText(`${inn.overs} ov · RR ${inn.runRate}`, width - pad, y + 72);
    ctx.textAlign = "left";
    y += 130;

    const batCols = [pad, 760, 840, 910, 970, width - pad];
    cols(batCols, ["Batter", "R", "B", "4s", "6s", "SR"], muted, 700);
    y += rowH;
    for (const row of inn.batting) {
      cols(batCols, [row.name, row.runs, row.balls, row.fours, row.sixes, row.strikeRate], text);
      ctx.fillStyle = muted;
      ctx.font = font(18);
      ctx.fillText(row.howOut, 330, y, 380);
      y += rowH;
    }
    ctx.fillStyle = muted;
    ctx.font = font(20);
    ctx.fillText(`Extras ${inn.extrasTotal} (${inn.extras})`, pad, y);
    y += 60;
    const bowlCols = [pad, 760, 840, 910, 970, width - pad];
    cols(bowlCols, ["Bowler", "O", "M", "R", "W", "Econ"], muted, 700);
    y += rowH;
    for (const row of inn.bowling) {
      cols(bowlCols, [row.name, row.overs, row.maidens, row.runs, row.wickets, row.economy], text);
      if (row.wickets > 0) {
        ctx.fillStyle = crimson;
        ctx.fillRect(pad - 18, y - 20, 5, 24);
      }
      y += rowH;
    }
    y += 40;
  }
  ctx.fillStyle = muted;
  ctx.font = font(20);
  ctx.fillText("Scored with CricLume · criclume.com", pad, height - 40);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image could not be created"))), "image/png"),
  );
}

/** Share the scorecard as an image, a PDF (via print) or text. Optional initials-only mode for junior cricket. */
export function ScorecardShare({ match }: { match: CricketMatch }) {
  const [initials, setInitials] = useState(false);
  const [busy, setBusy] = useState(false);
  const sheet = () => scorecardSheet(match, { initials });
  const name = fileSlug(`${match.teams[0].name}-v-${match.teams[1].name}`);

  const shareImage = async () => {
    setBusy(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const blob = await drawScorecard(sheet());
      const file = new File([blob], `${name}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${match.teams[0].name} v ${match.teams[1].name}` });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Scorecard image downloaded");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("The image could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const savePdf = () => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) {
      frame.remove();
      toast.error("Printing is not available in this browser.");
      return;
    }
    doc.open();
    doc.write(scorecardHtml(sheet()));
    doc.close();
    window.setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 60_000);
    }, 250);
  };

  const shareText = async () => {
    const text = scorecardText(sheet());
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Scorecard copied — paste it into WhatsApp or email");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Scorecard copied");
      } catch {
        toast.error("Could not share the scorecard text.");
      }
    }
  };

  return (
    <div className="card-share" aria-label="Share scorecard">
      <p className="panel-kicker">Share scorecard</p>
      <div className="card-share-actions">
        <button type="button" className="app-chip-button" onClick={() => void shareImage()} disabled={busy}>
          {typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="size-4" /> : <ImageDown className="size-4" />}
          Image
        </button>
        <button type="button" className="app-chip-button" onClick={savePdf}>
          <FileDown className="size-4" /> PDF
        </button>
        <button type="button" className="app-chip-button" onClick={() => void shareText()}>
          <Copy className="size-4" /> Text
        </button>
      </div>
      <label className="card-share-toggle">
        <input type="checkbox" checked={initials} onChange={(event) => setInitials(event.target.checked)} />
        Initials only (junior matches)
      </label>
    </div>
  );
}
