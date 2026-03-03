import QRCode from "qrcode";

/**
 * Generates a QR PNG data URL that includes the student's full name below the QR.
 * Works with Latin + Amharic if the font is available in the browser (see globals.css @font-face).
 */
export async function makeStudentQrDataUrl(payloadObj: any, fullName: string) {
  const payload = JSON.stringify(payloadObj);

  // Generate base QR
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, scale: 7 });

  // Compose into one image with name below
  const qrImg = await loadImage(qrDataUrl);

  // Canvas sizes
  const padding = 16;
  const nameHeight = 44;
  const width = qrImg.width + padding * 2;
  const height = qrImg.height + padding * 2 + nameHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  // background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // draw QR centered
  const qrX = (width - qrImg.width) / 2;
  const qrY = padding;
  ctx.drawImage(qrImg, qrX, qrY);

  // draw name under QR
  const name = (fullName ?? "").toString().trim();
  if (name) {
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Prefer Ethiopic font if present
    ctx.font = "600 18px 'Noto Sans Ethiopic', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

    // Simple wrapping (2 lines max)
    const maxWidth = width - 24;
    const lines = wrapText(ctx, name, maxWidth, 2);
    const lineHeight = 20;
    const blockHeight = lines.length * lineHeight;
    let y = qrImg.height + padding + (nameHeight - blockHeight) / 2 + lineHeight / 2;

    for (const line of lines) {
      ctx.fillText(line, width / 2, y);
      y += lineHeight;
    }
  }

  return canvas.toDataURL("image/png");
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  // If we truncated, add ellipsis
  if (words.length && lines.length === maxLines) {
    const joined = lines.join(" ");
    if (joined.replace(/\s+/g, " ").trim() !== text.replace(/\s+/g, " ").trim()) {
      let last = lines[lines.length - 1];
      while (last.length > 3 && ctx.measureText(last + "…").width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = last + "…";
    }
  }

  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
