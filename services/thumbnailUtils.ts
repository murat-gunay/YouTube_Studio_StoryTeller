/**
 * Client-side utility to burn localized High-CTR text overlays directly onto the thumbnail base image.
 * Canvas dimensions are locked to 1280x720 (YouTube standard 720p).
 */
export const burnThumbnailText = (
  baseImageUrl: string,
  titleText: string,       // Centered big yellow font near bottom
  subtitleText: string,    // Bottom-left white font
  topRightText: string,    // Top-right white font
  topLeftText?: string,    // Top-left dynamic teaser/drama badge
  teamA?: string,          // Optional team A name for drawing flags
  teamB?: string           // Optional team B name for drawing flags
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
      (async () => {
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

          // Top-left gradient overlay for top-left text
          if (topLeftText) {
            const topLeftGrad = ctx.createLinearGradient(0, 0, 320, 240);
            topLeftGrad.addColorStop(0, "rgba(0, 0, 0, 0.5)");
            topLeftGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = topLeftGrad;
            ctx.fillRect(0, 0, 380, 240);
          }

          // Configure general font properties
          ctx.lineJoin = "round";
          ctx.miterLimit = 2;

          // 3a. Top Left, White Font with Beautiful High-Contrast Glassmorphism Badge Background (Drama/Teaser)
          if (topLeftText) {
            ctx.font = "bold 38px 'Outfit', 'Inter', 'Helvetica Neue', sans-serif";
            
            const textWidth = ctx.measureText(topLeftText).width;
            const paddingX = 28;
            const paddingY = 16;
            const badgeWidth = textWidth + paddingX * 2;
            const badgeHeight = 38 + paddingY * 2;
            
            // Align the badge so its left edge is at x=60, and top edge is at y=50
            const startX = 60;
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

            // High-contrast gradient fill: premium neon/red/orange accent colors for drama (Emerald green, Neon red, or Warning Orange)
            // Red-Orange to Deep Slate for maximum drama (Red-500: #ef4444, Rose-600: #e11d48, Slate-950: #0f172a)
            const badgeGrad = ctx.createLinearGradient(startX, startY, startX + badgeWidth, startY + badgeHeight);
            badgeGrad.addColorStop(0, "rgba(239, 68, 68, 0.7)");   // Neon Red with 70% opacity
            badgeGrad.addColorStop(0.5, "rgba(225, 29, 72, 0.65)"); // Rose with 65% opacity
            badgeGrad.addColorStop(1, "rgba(15, 23, 42, 0.75)");    // Dark slate with 75% opacity
            ctx.fillStyle = badgeGrad;
            ctx.fill();

            // Disable drop shadow before drawing the stroke and gloss
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Sleek gradient border
            const borderGrad = ctx.createLinearGradient(startX, startY, startX + badgeWidth, startY + badgeHeight);
            borderGrad.addColorStop(0, "rgba(255, 255, 255, 0.75)");  // Bright top-left edge
            borderGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.25)");
            borderGrad.addColorStop(1, "rgba(255, 255, 255, 0.05)");
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
            glossGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
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

            // Text shadow
            ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 3;

            // Soft black outline (4px)
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 4;
            ctx.strokeText(topLeftText, centerX, centerY);

            // White text fill
            ctx.fillStyle = "#ffffff";
            ctx.fillText(topLeftText, centerX, centerY);
            
            ctx.restore();
          }

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

          // Draw country flags if team names are provided
          if (teamA && teamB) {
            try {
              const normalizeTeamName = (name: string): string => {
                return name.toLowerCase()
                  .replace(/ç/g, 'c')
                  .replace(/ö/g, 'o')
                  .replace(/ü/g, 'u')
                  .replace(/ı/g, 'i')
                  .replace(/ğ/g, 'g')
                  .replace(/ş/g, 's')
                  .replace(/[^a-z0-9\s-]/g, '')
                  .trim()
                  .replace(/\s+/g, '-');
              };

              const loadImg = (url: string): Promise<HTMLImageElement> => {
                return new Promise((res, rej) => {
                  const fImg = new Image();
                  fImg.crossOrigin = "anonymous";
                  fImg.onload = () => res(fImg);
                  fImg.onerror = () => rej(new Error(`Failed to load flag at ${url}`));
                  fImg.src = url;
                });
              };

              const nameA = normalizeTeamName(teamA);
              const nameB = normalizeTeamName(teamB);

              // Load both flag PNGs (which are placed in local public/flags/)
              const [flagA, flagB] = await Promise.all([
                loadImg(`/flags/${nameA}.png`),
                loadImg(`/flags/${nameB}.png`)
              ]);

              // Default horizontal and vertical centers
              let centerA = 640 - 160;
              let centerB = 640 + 160;
              let flagsY = titleTargetY - 145; // Place flags vertically above the first line of the title

              if (titleText) {
                ctx.font = "900 102px 'Outfit', 'Inter', 'Impact', 'Helvetica Neue', Arial, sans-serif";
                const vsMatch = titleText.match(/\s+(vs\.?|v\.?|-)\s+/i);

                if (titleLines.length > 1) {
                  const lineSpacing = 110;
                  flagsY = titleTargetY - (lineSpacing / 2);
                  centerA = 120;
                  centerB = 1160;
                } else if (vsMatch && vsMatch.index !== undefined) {
                  const vsIndex = vsMatch.index;
                  const vsStr = vsMatch[0];
                  const leftPart = titleText.substring(0, vsIndex).trim();
                  const rightPart = titleText.substring(vsIndex + vsStr.length).trim();

                  const totalWidth = ctx.measureText(titleText).width;
                  const startX = 640 - totalWidth / 2;

                  const leftWidth = ctx.measureText(leftPart).width;
                  const vsWidth = ctx.measureText(vsStr).width;
                  const rightWidth = ctx.measureText(rightPart).width;

                  centerA = startX + leftWidth / 2;
                  centerB = startX + leftWidth + vsWidth + rightWidth / 2;
                }
              }


              const drawFlag = (flagImg: HTMLImageElement, cx: number, cy: number) => {
                const w = 140;
                const h = 93;
                const x = cx - w / 2;
                const y = cy - h / 2;
                const radius = 10;

                ctx.save();
                
                // 1. Draw flag shadow for depth
                ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
                ctx.shadowBlur = 12;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 5;

                // 2. Draw clipping path for rounded corners
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.arcTo(x + w, y, x + w, y + h, radius);
                ctx.arcTo(x + w, y + h, x, y + h, radius);
                ctx.arcTo(x, y + h, x, y, radius);
                ctx.arcTo(x, y, x + w, y, radius);
                ctx.closePath();
                ctx.clip();

                // 3. Draw flag image
                ctx.drawImage(flagImg, x, y, w, h);
                ctx.restore();

                // 4. Draw a premium white border outline on top
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.arcTo(x + w, y, x + w, y + h, radius);
                ctx.arcTo(x + w, y + h, x, y + h, radius);
                ctx.arcTo(x, y + h, x, y, radius);
                ctx.arcTo(x, y, x + w, y, radius);
                ctx.closePath();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.restore();
              };

              drawFlag(flagA, centerA, flagsY);
              drawFlag(flagB, centerB, flagsY);
            } catch (err) {
              console.warn("Failed to load and draw flags for thumbnail:", err);
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
      })();
    };

    img.onerror = (err) => {
      reject(err);
    };

    img.src = baseImageUrl;
  });
};
