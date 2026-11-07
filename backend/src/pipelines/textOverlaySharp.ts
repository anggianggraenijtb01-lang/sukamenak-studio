/**
 * Pipeline Step 4: Tempel Teks Layout Sharp (textOverlaySharp.ts)
 * Merender hasil akhir rasio 4:5 (1080x1350) berkualitas HD menggunakan HTML5 Canvas
 * dengan tipografi presisi dan palet ketat Royal Blue (#2563EB), Deep Slate Navy (#0F172A),
 * Light Slate (#F8FAFC), dan Pure White (#FFFFFF).
 */

export interface SharpOverlayConfig {
  title: string;
  remarks: string;
  categoryBadge: string;
  mode: 'i2i' | 't2i';
  subjectType: 'Produk UMKM' | 'Human Model';
  referenceImageDataUrl?: string;
  textZonePosition: 'Top Header + Bottom CTA' | 'Bottom Card Overlay' | 'Split Editorial Frame';
}

export async function renderSharpTextOverlayCanvas(config: SharpOverlayConfig): Promise<string> {
  if (typeof document === 'undefined') {
    return '';
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Background Deep Slate Navy to Royal Blue Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1350);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(0.55, '#1E293B');
  bgGrad.addColorStop(1, '#1D4ED8');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1350);

  // Subtle architectural grid lines
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.06)';
  ctx.lineWidth = 2;
  for (let x = 90; x < 1080; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1350);
    ctx.stroke();
  }
  for (let y = 90; y < 1350; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1080, y);
    ctx.stroke();
  }

  // Decorative Royal Blue glow circle
  const radialGrad = ctx.createRadialGradient(540, 560, 40, 540, 560, 460);
  radialGrad.addColorStop(0, 'rgba(37, 99, 235, 0.55)');
  radialGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = radialGrad;
  ctx.fillRect(0, 0, 1080, 1350);

  // 2. Center Subject Stage Card (4:5 Visual Stage)
  ctx.save();
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(96, 230, 888, 690, 28);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2563EB';
  ctx.stroke();
  ctx.restore();

  // If user uploaded a reference photo, draw it inside the stage card
  if (config.referenceImageDataUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = config.referenceImageDataUrl!;
      });

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(112, 246, 856, 658, 20);
      ctx.clip();

      const scale = Math.max(856 / img.width, 658 / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = 112 + (856 - drawW) / 2;
      const drawY = 246 + (658 - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Subtle Royal Blue / Navy studio grade tint at bottom of photo
      const photoGrad = ctx.createLinearGradient(0, 680, 0, 904);
      photoGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      photoGrad.addColorStop(1, 'rgba(15, 23, 42, 0.72)');
      ctx.fillStyle = photoGrad;
      ctx.fillRect(112, 680, 856, 224);
      ctx.restore();
    } catch {
      // Fallback visual illustration if image load fails
    }
  } else {
    // Clean geometric studio product/model illustration inside stage
    ctx.save();
    const innerGrad = ctx.createLinearGradient(112, 246, 968, 904);
    innerGrad.addColorStop(0, '#EFF6FF');
    innerGrad.addColorStop(1, '#DBEAFE');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.roundRect(112, 246, 856, 658, 20);
    ctx.fill();

    // Pedestal & Studio Subject Silhouette in Royal Blue & Deep Slate Navy
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.ellipse(540, 770, 230, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(380, 390, 320, 360, 28);
    ctx.fill();

    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.roundRect(415, 435, 250, 180, 18);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(config.subjectType.toUpperCase(), 540, 525);
    ctx.font = '500 20px Inter, sans-serif';
    ctx.fillStyle = '#DBEAFE';
    ctx.fillText(`AI ${config.mode.toUpperCase()} STUDIO RENDER`, 540, 562);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 20px JetBrains Mono, monospace';
    ctx.fillText('SUKAMENAK STUDIO HD STAGE • 1080x1350 (4:5)', 540, 680);
    ctx.restore();
  }

  // 3. Top Header Badge (Safe Text Zone 1)
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.roundRect(96, 86, 430, 58, 29);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SUKAMENAK STUDIO • ${config.categoryBadge.toUpperCase()}`, 126, 123);

  // Top-right Mode Pill
  ctx.fillStyle = 'rgba(248, 250, 252, 0.14)';
  ctx.beginPath();
  ctx.roundRect(750, 86, 234, 58, 29);
  ctx.fill();
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '600 20px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${config.mode.toUpperCase()} • ${config.subjectType === 'Produk UMKM' ? 'UMKM' : 'MODEL'}`, 867, 122);

  // 4. Bottom Sharp Typography Overlay Card (Safe Text Zone 2)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(96, 960, 888, 300, 28);
  ctx.fill();

  // Accent bar on left of typography card
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.roundRect(126, 996, 10, 228, 5);
  ctx.fill();

  // Title text
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 44px Inter, sans-serif';
  ctx.textAlign = 'left';
  const cleanTitle = (config.title || 'Produk Unggulan UMKM Desa Sukamenak').slice(0, 38);
  ctx.fillText(cleanTitle, 162, 1054);

  // Subtitle / Remarks text
  ctx.fillStyle = '#475569';
  ctx.font = '500 26px Inter, sans-serif';
  const cleanRemarks = (
    config.remarks || 'Kualitas terbaik karya warga RW 15 & pelaku UMKM Desa Sukamenak'
  ).slice(0, 62);
  ctx.fillText(cleanRemarks, 162, 1112);

  // Bottom Footer Pill inside Card
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(162, 1152, 784, 72, 16);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#2563EB';
  ctx.font = '700 22px Inter, sans-serif';
  ctx.fillText('RW 15 & UMKM DESA SUKAMENAK', 190, 1196);

  ctx.fillStyle = '#0F172A';
  ctx.font = '600 20px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('100% GRATIS • HD 4:5 VERIFIED', 920, 1196);

  return canvas.toDataURL('image/png');
}

