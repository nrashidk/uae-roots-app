import { useRef, useEffect, useCallback } from "react";
import { formatAge } from "@/lib/utils";

const TreeCanvas = ({
  layout,
  familyData,
  people,
  selectedPerson,
  highlightedPerson,
  onPersonClick,
  onBackgroundClick,
  zoom = 1,
  panOffset = { x: 0, y: 0 },
  autoPan = { x: 0, y: 0 },
  stylingOptions,
  displayOptions,
  cardDimensions = { w: 140, h: 90 },
}) => {
  const canvasRef = useRef(null);

  // Draw the tree on canvas
  const drawTree = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || !layout.e) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    // Set canvas size to match display size
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(
      panOffset.x + (autoPan?.x || 0),
      panOffset.y + (autoPan?.y || 0),
    );
    ctx.scale(zoom, zoom);

    // Draw connection lines first (so they appear behind boxes)
    drawConnectionLines(ctx, layout);

    // Draw person boxes
    drawPersonBoxes(ctx, layout);

    ctx.restore();
  }, [
    layout,
    people,
    selectedPerson,
    zoom,
    panOffset,
    autoPan,
    stylingOptions,
    displayOptions,
    cardDimensions,
  ]);

  // Draw connection lines
  const drawConnectionLines = useCallback(
    (ctx, layout) => {
      if (!layout.n || layout.n.length === 0) return;

      const BOX_WIDTH = stylingOptions?.boxWidth || cardDimensions.w;
      const BOX_HEIGHT = cardDimensions.h;

      ctx.strokeStyle = stylingOptions?.lineColor || "#8b8b8b";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      layout.n.forEach((line) => {
        // Convert grid units to pixels
        const x1 = line.x1 * BOX_WIDTH;
        const y1 = line.y1 * BOX_HEIGHT;
        const x2 = line.x2 * BOX_WIDTH;
        const y2 = line.y2 * BOX_HEIGHT;

        // Dotted/dashed styling for collapsed/truncated connectors
        const t = line.t || "";
        const isDashed = typeof t === "string" && t === t.toLowerCase();
        // SPIKE: milk (رضاعة) connectors get their own colour so they can never
        // be read as a marriage line.
        const isMilk = t === "r" || t === "R";
        ctx.strokeStyle = isMilk
          ? "#16a34a"
          : stylingOptions?.lineColor || "#8b8b8b";
        if (isDashed) {
          ctx.setLineDash([6, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      // Reset line dash
      ctx.setLineDash([]);
    },
    [stylingOptions, cardDimensions],
  );

  // Draw person boxes
  const drawPersonBoxes = useCallback(
    (ctx, layout) => {
      if (!layout.e) return;

      const BOX_WIDTH = stylingOptions?.boxWidth || cardDimensions.w;
      const BOX_HEIGHT = cardDimensions.h;

      Object.entries(layout.e).forEach(([entityId, entity]) => {
        // Get person data from familyData (algorithm format) or entity
        const personData = familyData?.[entityId] || entity.p;
        if (!personData) {
          return;
        }

        // Extract numeric person ID for looking up in people array (for additional data).
        // A person shown in two places (cousin marriage) gets a SECOND entity keyed
        // `${baseKey}${Math.random()}` by addEntity, which parseInt cannot resolve.
        // addEntity stores the original key on `.d`, so prefer that when present.
        const baseEntityId = entity.d || entityId;
        const personId = parseInt(baseEntityId.replace("P", ""));
        const person = people.find((p) => p.id === personId);

        // Calculate how many lines of text will be shown
        let lineCount = 1; // Name line
        const isLiving = person?.isLiving !== false;
        const isBreastfed = person?.isBreastfed === true;
        // Line heights DERIVED from the fonts actually drawn.
        //
        // lineHeight was a constant 12 while textSize is a USER SLIDER running
        // 10..20, and detail lines are drawn at (textSize - 2). At the top of
        // that slider it was 18px text advancing 12px: lines overlapped each
        // other and the block ran outside the box. Even at the default 14 the
        // bold name got 12px of room, so the birth date sat on its descender.
        const textSize = stylingOptions?.textSize || 14;
        const lineHeight = Math.round((textSize - 2) * 1.35);
        const nameLineHeight = Math.round(textSize * 1.45);

        // ONE line carries the years and the age, because they can never
        // co-occur: both years render together as "١٩٦٥ – ٢٠٠٠", and age only
        // shows for a living person, who has no death year.
        //
        // YEAR, not full date — the tree is a navigation surface; the full ISO
        // date is record detail and lives on الأفراد.
        const yr = (d) => (d ? String(d).slice(0, 4) : null);
        const bYear = displayOptions?.showBirthDate ? yr(person?.birthDate) : null;
        const dYear =
          displayOptions?.showDeathDate && !isLiving
            ? yr(person?.deathDate)
            : null;

        let ageText = null;
        if (displayOptions?.showAge && person?.birthDate && isLiving) {
          const age =
            new Date().getFullYear() - Number(yr(person.birthDate));
          if (age > 0) ageText = formatAge(age);
        }

        // Still ONE line, but the year and the age now sit on it together.
        //
        // The old rule was "years OR age, years win", which meant age could not
        // be shown at all while a birth year was enabled — and switching the
        // year off to see the age left a deceased person reading «– ٢٠٠٠».
        //
        // Living:   ١٩٩٠ · ٣٦ سنة   /  ١٩٩٠  /  ٣٦ سنة
        // Deceased: ١٩٦٥ – ٢٠٠٠     /  ١٩٦٥  /  ٢٠٠٠
        //
        // A lone death year prints plain: the leading dash read as an error, and
        // the box already renders a deceased person in grey.
        let yearsLine = null;
        if (!isLiving) {
          if (bYear && dYear) yearsLine = `${bYear} – ${dYear}`;
          else yearsLine = bYear || dYear;
        } else if (bYear && ageText) {
          yearsLine = `${bYear} · ${ageText}`;
        } else {
          yearsLine = bYear || ageText;
        }

        if (person) {
          if (yearsLine) lineCount++;
          if (displayOptions?.showBirthPlace && person.birthPlace) lineCount++;
        }

        // Calculate dynamic height based on content
        const padding = 10;
        const calculatedHeight =
          padding * 2 + nameLineHeight + (lineCount - 1) * lineHeight;

        // Convert grid units to pixels
        const x = entity.x * BOX_WIDTH;
        const y = entity.y * BOX_HEIGHT;
        const w = BOX_WIDTH * 0.8; // 80% of grid width for box
        const h = Math.max(calculatedHeight, BOX_HEIGHT * 0.6); // Use dynamic height or minimum

        // Center the box on the grid position
        const boxX = x - w / 2;
        const boxY = y - h / 2;

        // Determine box color based on gender (from personData or person)
        const gender = personData.g || person?.gender;
        let boxColor = "#e5e7eb"; // default gray
        if (isBreastfed) {
          boxColor = stylingOptions?.breastfedBoxColor || "#d1fae5"; // light green highlight for breastfed flag
        } else if (gender === "m" || gender === "male") {
          boxColor = stylingOptions?.maleBoxColor || "#e6f3ff";
        } else if (gender === "f" || gender === "female") {
          boxColor = stylingOptions?.femaleBoxColor || "#ffe4e1";
        }

        // Draw box background
        ctx.fillStyle = boxColor;
        ctx.fillRect(boxX, boxY, w, h);

        // Draw border (highlight if this person is the highlighted one).
        // A dashed border marks someone whose marriages have ALL ended — the
        // gender fill is kept so male/female is still readable, and a dashed
        // BORDER can't be mistaken for the green dashed رضاعة LINE. The
        // connector itself is left alone, because the other partner may still
        // have current marriages of their own.
        const allEnded = personData.allMarriagesEnded === true;
        if (highlightedPerson === personId) {
          ctx.strokeStyle = "#22c55e"; // green for selected
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = "#d1d5db"; // gray
          ctx.lineWidth = 2;
        }
        if (allEnded && highlightedPerson !== personId) {
          ctx.setLineDash([5, 3]);
        }
        ctx.strokeRect(boxX, boxY, w, h);
        ctx.setLineDash([]);

        // Draw text
        ctx.fillStyle = isLiving
          ? stylingOptions?.livingTextColor || "#000000"
          : stylingOptions?.deceasedTextColor || "#6b7280";
        ctx.font = `bold ${stylingOptions?.textSize || 14}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Calculate starting position - center vertically based on total content
        let yOffset;
        const totalContentHeight = nameLineHeight + (lineCount - 1) * lineHeight;

        // Always center the text block vertically
        yOffset = boxY + (h - totalContentHeight) / 2 + nameLineHeight / 2;
        ctx.textBaseline = "middle";

        // Build name text based on display options
        let nameText = "";
        if (person) {
          // Always show firstName
          if (person.firstName) {
            nameText = person.firstName;
          }
          // Show lastName only if showSurname option is enabled
          if (displayOptions?.showSurname && person.lastName) {
            if (nameText) nameText += " ";
            nameText += person.lastName;
          }
        } else if (personData.p) {
          // Fallback to algorithm's person name if person data not available
          nameText = personData.p;
        }

        if (nameText) {
          // Truncate if too long
          const maxWidth = w - 10;
          let displayText = nameText;
          const textWidth = ctx.measureText(displayText).width;
          if (textWidth > maxWidth) {
            while (
              ctx.measureText(displayText + "...").width > maxWidth &&
              displayText.length > 0
            ) {
              displayText = displayText.slice(0, -1);
            }
            displayText += "...";
          }

          ctx.fillText(displayText, x, yOffset);
          // Half of each: from the name's centre to the first detail centre.
          yOffset += nameLineHeight / 2 + lineHeight / 2;
        }

        // Draw additional info (birth date, etc.) - only if person data is available
        if (person) {
          ctx.font = `${(stylingOptions?.textSize || 14) - 2}px sans-serif`;

          if (yearsLine) {
            ctx.fillText(yearsLine, x, yOffset);
            yOffset += lineHeight;
          }

          if (displayOptions?.showBirthPlace && person.birthPlace) {
            const placeText =
              person.birthPlace.length > 15
                ? person.birthPlace.substring(0, 12) + "..."
                : person.birthPlace;
            ctx.fillText(placeText, x, yOffset);
            yOffset += lineHeight;
          }
        }
      });
    },
    [
      familyData,
      people,
      selectedPerson,
      highlightedPerson,
      stylingOptions,
      displayOptions,
      cardDimensions,
    ],
  );

  // Handle canvas click to detect person clicks
  const handleCanvasClick = useCallback(
    (e) => {
      if (!layout || !layout.e) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      // Use provided autoPan from App (already handles single→multi transition)
      const clickX =
        (e.clientX - rect.left - (panOffset.x + (autoPan?.x || 0))) / zoom;
      const clickY =
        (e.clientY - rect.top - (panOffset.y + (autoPan?.y || 0))) / zoom;

      const BOX_WIDTH = stylingOptions?.boxWidth || cardDimensions.w;
      const BOX_HEIGHT = cardDimensions.h;

      // Check if click is on any person box
      for (const [entityId, entity] of Object.entries(layout.e)) {
        // Duplicate boxes carry the original key on `.d` — see the render path above.
        const personId = parseInt((entity.d || entityId).replace("P", ""));
        const x = entity.x * BOX_WIDTH;
        const y = entity.y * BOX_HEIGHT;
        const w = BOX_WIDTH * 0.8;
        const h = BOX_HEIGHT * 0.6;
        const boxX = x - w / 2;
        const boxY = y - h / 2;

        if (
          clickX >= boxX &&
          clickX <= boxX + w &&
          clickY >= boxY &&
          clickY <= boxY + h
        ) {
          onPersonClick && onPersonClick(personId);
          return;
        }
      }

      // If no person was clicked, treat as background click
      if (onBackgroundClick) onBackgroundClick();
    },
    [
      layout,
      onPersonClick,
      onBackgroundClick,
      zoom,
      panOffset,
      autoPan,
      stylingOptions,
      cardDimensions,
    ],
  );

  // Redraw when dependencies change
  useEffect(() => {
    // TEMPORARY DIAGNOSTIC — remove once the undo repaint is understood.
    // Logs the birthOrder the canvas is about to draw with, so we can see
    // whether this effect fires after an undo and what data it holds.
    if (typeof window !== "undefined" && window.__TREE_DEBUG) {
      // Positions come from LAYOUT, names from PEOPLE. A repaint proves people
      // changed; it does not prove the layout did. Log both for the same ids.
      const ids = (people || [])
        .filter((p) => p.birthOrder != null)
        .slice(0, 6)
        .map((p) => p.id);
      console.log(
        "[TreeCanvas] repaint",
        ids
          .map((id) => {
            const per = people.find((p) => p.id === id);
            const ent = layout?.e?.[`P${id}`];
            return `${per?.firstName}[o=${per?.birthOrder} x=${ent?.x}]`;
          })
          .join(" "),
      );
    }
    drawTree();
  }, [drawTree]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      drawTree();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawTree]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        cursor: "pointer",
      }}
    />
  );
};

export default TreeCanvas;
