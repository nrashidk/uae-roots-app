import { useRef, useEffect, useCallback } from "react";

// Arabic number agreement. `${age} سنة` is only correct for 11 and above —
// it read "1 سنة" and "2 سنة", both wrong.
//
//   1        → سنة واحدة   (mufrad)
//   2        → سنتان       (muthanna, its own dual form)
//   3–10     → N سنوات     (jamʿ qilla — plural noun)
//   11+      → N سنة       (tamyīz — singular again)
//
// Module scope: no component state involved, and it must exist before the
// draw callbacks that use it.
const formatAge = (age) => {
  if (age === 1) return "سنة واحدة";
  if (age === 2) return "سنتان";
  if (age >= 3 && age <= 10) return `${age} سنوات`;
  return `${age} سنة`;
};

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

        // Box height comes from the ENABLED OPTIONS, not from what this person
        // happens to have filled in.
        //
        // It used to count only the fields this person actually had, so a man
        // with no profession got a shorter box than his brother who had one —
        // and because the text is top-anchored inside the box, their NAMES sat
        // at different heights in the same row. Ticking one option moved some
        // boxes and not others.
        //
        // Sizing from the option set makes every box in the tree identical, so
        // names line up and a person missing a field simply leaves the space
        // blank instead of shrinking the box. The DRAWING below stays per
        // person — absent fields are still skipped.
        //
        // This MIRRORS the CARD memo in App.jsx, which sets the row pitch. The
        // two must agree or boxes overlap.
        const opt = (k) => (displayOptions?.[k] ? 1 : 0);
        const lineCount =
          1 + // name
          opt("showBirthDate") +
          opt("showBirthPlace") +
          opt("showProfession") +
          opt("showTelephone") +
          opt("showEmail") +
          // A person is living or deceased, never both, so these two can never
          // occupy a line at the same time.
          Math.max(opt("showDeathDate"), opt("showAge"));

        const isLiving = person?.isLiving !== false;
        const isBreastfed = person?.isBreastfed === true;

        // Line heights DERIVED from the fonts actually drawn, not a fixed 12.
        //
        // The name is drawn bold at `textSize` (14 by default) and the detail
        // lines at `textSize - 2`. Advancing every line by a flat 12px meant a
        // 14px glyph got 12px of room, so the line beneath landed inside it —
        // the name visibly touched the birth date — and 12px text on a 12px
        // advance has no leading at all, which is why the block looked crammed.
        const textSize = stylingOptions?.textSize || 14;
        const detailSize = textSize - 2;
        const nameLineHeight = Math.round(textSize * 1.45);
        const detailLineHeight = Math.round(detailSize * 1.35);
        const boxPadding = 10; // equal above the name and below the last line

        // Calculate dynamic height based on content.
        // Symmetric by construction: boxPadding above the name and the same
        // below the last line. The old formula mixed a 30px "base" with a 10px
        // padding applied once, which left the gap under the name and the gap
        // under the final line visibly unequal.
        const contentHeight =
          nameLineHeight + (lineCount - 1) * detailLineHeight;
        const calculatedHeight = contentHeight + boxPadding * 2;

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

        // Split the box's spare height EVENLY above and below the text block.
        //
        // `h` is not always the content height: line 197 clamps it to a
        // minimum, so with only one or two options ticked the box is padded out
        // and there is leftover room. Anchoring the text at a fixed offset from
        // the top dumped ALL of that leftover underneath, which sat the name
        // high in a sparse box and low in a full one — the name moved every time
        // an option was toggled.
        //
        // Measuring against the actual `h` keeps the name in the same place
        // whatever is enabled, and still leaves the gap above the name equal to
        // the gap below the last line, since contentHeight is now correct.
        const verticalPad = Math.max(boxPadding, (h - contentHeight) / 2);
        let yOffset = boxY + verticalPad + nameLineHeight / 2;
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
          // Half of each line's height: from the name's centre down to the
          // first detail line's centre.
          yOffset += nameLineHeight / 2 + detailLineHeight / 2;
        }

        // Draw additional info (birth date, etc.) - only if person data is available
        if (person) {
          ctx.font = `${(stylingOptions?.textSize || 14) - 2}px sans-serif`;

          if (displayOptions?.showBirthDate && person.birthDate) {
            ctx.fillText(person.birthDate, x, yOffset);
            yOffset += detailLineHeight;
          }

          if (displayOptions?.showDeathDate && person.deathDate && !isLiving) {
            ctx.fillText(` ${person.deathDate}`, x, yOffset);
            yOffset += detailLineHeight;
          }

          if (displayOptions?.showBirthPlace && person.birthPlace) {
            const placeText =
              person.birthPlace.length > 15
                ? person.birthPlace.substring(0, 12) + "..."
                : person.birthPlace;
            ctx.fillText(placeText, x, yOffset);
            yOffset += detailLineHeight;
          }

          if (displayOptions?.showAge && person.birthDate && isLiving) {
            const birthYear = new Date(person.birthDate).getFullYear();
            const currentYear = new Date().getFullYear();
            const age = currentYear - birthYear;
            if (age > 0) {
              ctx.fillText(formatAge(age), x, yOffset);
              yOffset += detailLineHeight;
            }
          }

          if (displayOptions?.showProfession && person.profession) {
            const profText =
              person.profession.length > 15
                ? person.profession.substring(0, 12) + "..."
                : person.profession;
            ctx.fillText(profText, x, yOffset);
            yOffset += detailLineHeight;
          }

          if (displayOptions?.showTelephone && person.phone) {
            const phoneText =
              person.phone.length > 15
                ? person.phone.substring(0, 12) + "..."
                : person.phone;
            ctx.fillText(phoneText, x, yOffset);
            yOffset += detailLineHeight;
          }

          if (displayOptions?.showEmail && person.email) {
            const emailText =
              person.email.length > 20
                ? person.email.substring(0, 17) + "..."
                : person.email;
            ctx.fillText(emailText, x, yOffset);
            yOffset += detailLineHeight;
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
