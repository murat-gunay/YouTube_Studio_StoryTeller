/**
 * Client-side utility to burn localized High-CTR text overlays directly onto the thumbnail base image.
 * Canvas dimensions are locked to 1280x720 (YouTube standard 720p).
 */
export const burnThumbnailText = (
  baseImageUrl: string,
  titleText: string,       // Centered big yellow font near bottom
  subtitleText: string,    // Bottom-left white font
  topRightText: string     // Top-right white font
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!baseImageUrl) {
      reject("No base image URL provided");
      return;
    }

    const img = new Image();
    // Allow cross-origin images (useful if baseImageUrl is an external HTTPS link, e.g. from Google Imagen 3)
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject("Failed to get 2D canvas context");
          return;
        }

        // 1. Draw base image scaled to fill 1280x720
        ctx.drawImage(img, 0, 0, 1280, 720);

        // 2. Add subtle vignette/gradients to ensure text legibility
        // Bottom gradient overlay for centered title and bottom-left subtitle
        const bottomGrad = ctx.createLinearGradient(0, 720, 0, 380);
        bottomGrad.addColorStop(0, "rgba(0, 0, 0, 0.85)");
        bottomGrad.addColorStop(0.6, "rgba(0, 0, 0, 0.3)");
        bottomGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = bottomGrad;
        ctx.fillRect(0, 380, 1280, 340);

        // Top-right gradient overlay for top-right text
        if (topRightText) {
          const topRightGrad = ctx.createLinearGradient(1280, 0, 960, 240);
          topRightGrad.addColorStop(0, "rgba(0, 0, 0, 0.5)");
          topRightGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = topRightGrad;
          ctx.fillRect(900, 0, 380, 240);
        }

        // Configure general font properties
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;

        // 3. Top Right, White Font with Beautiful Glassmorphism Badge Background
        if (topRightText) {
          ctx.font = "bold 38px 'Outfit', 'Inter', 'Helvetica Neue', sans-serif";
          
          // Measure text width for badge sizing
          const textWidth = ctx.measureText(topRightText).width;
          const paddingX = 28;
          const paddingY = 16;
          const badgeWidth = textWidth + paddingX * 2;
          const badgeHeight = 38 + paddingY * 2;
          
          // Align the badge so its right edge is at x=1220, and top edge is at y=50
          const startX = 1220 - badgeWidth;
          const startY = 50;

          ctx.save();
          
          // Enable drop shadow for the badge to create depth
          ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
          ctx.shadowBlur = 18;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 6;

          // Draw rounded rectangle path
          ctx.beginPath();
          const radius = 18;
          ctx.moveTo(startX + radius, startY);
          ctx.arcTo(startX + badgeWidth, startY, startX + badgeWidth, startY + badgeHeight, radius);
          ctx.arcTo(startX + badgeWidth, startY + badgeHeight, startX, startY + badgeHeight, radius);
          ctx.arcTo(startX, startY + badgeHeight, startX, startY, radius);
          ctx.arcTo(startX, startY, startX + badgeWidth, startY, radius);
          ctx.closePath();

          // 50% opacity gradient fill: premium aesthetic colors (Indigo-500 / Violet-600 / Slate-950)
          const badgeGrad = ctx.createLinearGradient(startX, startY, startX + badgeWidth, startY + badgeHeight);
          badgeGrad.addColorStop(0, "rgba(99, 102, 241, 0.5)");   // Indigo with 50% opacity
          badgeGrad.addColorStop(0.5, "rgba(124, 58, 237, 0.45)"); // Violet with 45% opacity
          badgeGrad.addColorStop(1, "rgba(15, 23, 42, 0.55)");    // Dark slate with 55% opacity
          ctx.fillStyle = badgeGrad;
          ctx.fill();

          // Disable drop shadow before drawing the stroke and gloss (so they don't double shadow)
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          // Sleek gradient border simulating light hitting the top-left edge
          const borderGrad = ctx.createLinearGradient(startX, startY, startX + badgeWidth, startY + badgeHeight);
          borderGrad.addColorStop(0, "rgba(255, 255, 255, 0.6)");   // Bright top-left edge
          borderGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.2)"); // Mid-body
          borderGrad.addColorStop(1, "rgba(255, 255, 255, 0.05)");  // Darker bottom-right edge
          ctx.strokeStyle = borderGrad;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Add a beautiful glossy reflection diagonal highlight
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(startX + badgeWidth * 0.5, startY);
          ctx.lineTo(startX + badgeWidth * 0.3, startY + badgeHeight);
          ctx.lineTo(startX, startY + badgeHeight);
          ctx.closePath();
          
          const glossGrad = ctx.createLinearGradient(startX, startY, startX + badgeWidth * 0.4, startY + badgeHeight);
          glossGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
          glossGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = glossGrad;
          ctx.fill();

          ctx.restore();

          // Render Text perfectly centered inside the badge
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          
          const centerX = startX + badgeWidth / 2;
          const centerY = startY + badgeHeight / 2 + 1; // minor optical offset adjustment

          // Text shadow for high contrast & premium legibility
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 3;

          // Soft black outline (4px)
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 4;
          ctx.strokeText(topRightText, centerX, centerY);

          // White text fill
          ctx.fillStyle = "#ffffff";
          ctx.fillText(topRightText, centerX, centerY);
          
          ctx.restore();
        }

        // 4. Centered Near Bottom, Big Yellow Font
        let subtitleFontSize = 41;
        let subtitleY = 670;
        let subtitleX = 60;
        let titleTargetY = 560;

        let titleLines: string[] = [];
        if (titleText) {
          ctx.font = "900 102px 'Outfit', 'Inter', 'Impact', 'Helvetica Neue', Arial, sans-serif";
          const maxLineWidth = 1150;
          if (ctx.measureText(titleText).width > maxLineWidth) {
            // Try to split by "vs" first
            const vsMatch = titleText.match(/\s+(vs\.?|v\.?)\s+/i);
            if (vsMatch && vsMatch.index !== undefined) {
              const splitIndex = vsMatch.index;
              const separator = vsMatch[0];
              const line1 = titleText.substring(0, splitIndex + separator.length).trim();
              const line2 = titleText.substring(splitIndex + separator.length).trim();
              titleLines = [line1, line2];
            } else {
              // Split by words to balance the width of both lines
              const words = titleText.split(/\s+/);
              if (words.length > 1) {
                let bestDiff = Infinity;
                let bestIndex = 1;
                for (let i = 1; i < words.length; i++) {
                  const line1 = words.slice(0, i).join(" ");
                  const line2 = words.slice(i).join(" ");
                  const w1 = ctx.measureText(line1).width;
                  const w2 = ctx.measureText(line2).width;
                  const diff = Math.abs(w1 - w2);
                  if (diff < bestDiff) {
                    bestDiff = diff;
                    bestIndex = i;
                  }
                }
                titleLines = [
                  words.slice(0, bestIndex).join(" "),
                  words.slice(bestIndex).join(" ")
                ];
              } else {
                titleLines = [titleText];
              }
            }
          } else {
            titleLines = [titleText];
          }

          // If we have 2 lines, check for collision with the subtitle
          if (titleLines.length > 1 && subtitleText) {
            const line2Width = ctx.measureText(titleLines[1]).width;
            const titleLeft = 640 - line2Width / 2 - 8;

            ctx.font = `bold ${subtitleFontSize}px 'Outfit', 'Inter', 'Helvetica Neue', sans-serif`;
            const subtitleWidth = ctx.measureText(subtitleText).width;
            const subtitleRight = subtitleX + subtitleWidth;

            // If they overlap horizontally, adjust layout to prevent vertical collision
            if (titleLeft < subtitleRight) {
              subtitleFontSize = 30;
              subtitleY = 695;
              subtitleX = 40;
              titleTargetY = 540; // Shift title center upwards
            }
          }
        }

        if (titleText) {
          ctx.font = "900 102px 'Outfit', 'Inter', 'Impact', 'Helvetica Neue', Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const targetX = 640;

          // Render lines
          if (titleLines.length === 1) {
            // Thick Black Outline
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 16;
            ctx.strokeText(titleLines[0], targetX, titleTargetY);

            // Gradient Fill: Yellow (top) to Dark Orange/Yellow (bottom)
            const textGrad = ctx.createLinearGradient(targetX, titleTargetY - 55, targetX, titleTargetY + 55);
            textGrad.addColorStop(0, "#ffea00"); // Bright yellow
            textGrad.addColorStop(1, "#f59e0b"); // Warm amber/orange
            ctx.fillStyle = textGrad;

            ctx.fillText(titleLines[0], targetX, titleTargetY);
          } else {
            // Two lines rendering - shift Y slightly to center them vertically
            const lineSpacing = 110;
            const startY = titleTargetY - (lineSpacing / 2);

            titleLines.forEach((line, idx) => {
              const currentY = startY + idx * lineSpacing;

              // Thick Black Outline
              ctx.strokeStyle = "#000000";
              ctx.lineWidth = 16;
              ctx.strokeText(line, targetX, currentY);

              // Gradient Fill: Yellow (top) to Dark Orange/Yellow (bottom)
              const textGrad = ctx.createLinearGradient(targetX, currentY - 55, targetX, currentY + 55);
              textGrad.addColorStop(0, "#ffea00"); // Bright yellow
              textGrad.addColorStop(1, "#f59e0b"); // Warm amber/orange
              ctx.fillStyle = textGrad;

              ctx.fillText(line, targetX, currentY);
            });
          }
        }

        // 5. Bottom Left, White Font
        if (subtitleText) {
          ctx.font = `bold ${subtitleFontSize}px 'Outfit', 'Inter', 'Helvetica Neue', sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";

          // Black Outline
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 8;
          ctx.strokeText(subtitleText, subtitleX, subtitleY);

          // White Fill
          ctx.fillStyle = "#ffffff";
          ctx.fillText(subtitleText, subtitleX, subtitleY);
        }

        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      reject(err);
    };

    img.src = baseImageUrl;
  });
};
