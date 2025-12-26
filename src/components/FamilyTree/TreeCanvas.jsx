import { useRef, useEffect, useCallback } from "react";

const TreeCanvas = ({
  layout,
  familyData,
  people,
  selectedPerson,
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

        // Extract numeric person ID for looking up in people array (for additional data)
        const personId = parseInt(entityId.replace("P", ""));
        const person = people.find((p) => p.id === personId);

        // Convert grid units to pixels
        const x = entity.x * BOX_WIDTH;
        const y = entity.y * BOX_HEIGHT;
        const w = BOX_WIDTH * 0.8; // 80% of grid width for box
        const h = BOX_HEIGHT * 0.6; // 60% of grid height for box

        // Center the box on the grid position
        const boxX = x - w / 2;
        const boxY = y - h / 2;

        // Determine box color based on gender (from personData or person)
        const gender = personData.g || person?.gender;
        let boxColor = "#e5e7eb"; // default gray
        if (gender === "m" || gender === "male") {
          boxColor = stylingOptions?.maleBoxColor || "#e6f3ff";
        } else if (gender === "f" || gender === "female") {
          boxColor = stylingOptions?.femaleBoxColor || "#ffe4e1";
        }

        // Draw box background
        ctx.fillStyle = boxColor;
        ctx.fillRect(boxX, boxY, w, h);

        // Draw border (highlight if selected)
        if (selectedPerson === personId) {
          ctx.strokeStyle = "#22c55e"; // green for selected
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = "#d1d5db"; // gray
          ctx.lineWidth = 2;
        }
        ctx.strokeRect(boxX, boxY, w, h);

        // Draw text
        const isLiving = person?.isLiving !== false; // default to living if not specified
        ctx.fillStyle = isLiving
          ? stylingOptions?.livingTextColor || "#000000"
          : stylingOptions?.deceasedTextColor || "#6b7280";
        ctx.font = `bold ${stylingOptions?.textSize || 14}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Draw name (use personData.p from algorithm or construct from person)
        let nameText = personData.p || "";
        if (!nameText && person) {
          if (displayOptions?.showName && person.firstName) {
            nameText += person.firstName;
          }
          if (displayOptions?.showSurname && person.lastName) {
            if (nameText) nameText += " ";
            nameText += person.lastName;
          }
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

          ctx.fillText(displayText, x, y);
        }

        // Draw additional info (birth date, etc.) - only if person data is available
        if (person) {
          let yOffset = 15;
          ctx.font = `${(stylingOptions?.textSize || 14) - 2}px sans-serif`;

          if (displayOptions?.showBirthDate && person.birthDate) {
            ctx.fillText(person.birthDate, x, y + yOffset);
            yOffset += 12;
          }

          if (displayOptions?.showBirthPlace && person.birthPlace) {
            const placeText =
              person.birthPlace.length > 15
                ? person.birthPlace.substring(0, 12) + "..."
                : person.birthPlace;
            ctx.fillText(placeText, x, y + yOffset);
          }
        }
      });
    },
    [
      familyData,
      people,
      selectedPerson,
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
        const personId = parseInt(entityId.replace("P", ""));
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