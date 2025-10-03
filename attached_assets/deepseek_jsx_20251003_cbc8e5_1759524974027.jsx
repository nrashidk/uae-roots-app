{/* Enhanced Connection Lines - FamilyEcho Style */}
<svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
  
  {/* 1. PARTNER RELATIONSHIPS - Clean horizontal lines */}
  {relationships
    .filter(r => r.type === REL.PARTNER && r.treeId === currentTree?.id)
    .map((r, i) => {
      const p1 = treePeople.find(p => p.id === r.person1Id);
      const p2 = treePeople.find(p => p.id === r.person2Id);
      
      if (!p1 || !p2) return null;

      // Determine left and right partners
      const leftPerson = p1.x < p2.x ? p1 : p2;
      const rightPerson = p1.x < p2.x ? p2 : p1;

      // Connect from right edge of left person to left edge of right person
      const startX = leftPerson.x + stylingOptions.boxWidth;
      const endX = rightPerson.x;
      
      // Use center Y of both boxes
      const centerY = leftPerson.y + CARD.h / 2;

      return (
        <line
          key={`partner-${i}`}
          x1={startX}
          y1={centerY}
          x2={endX}
          y2={centerY}
          stroke="#dc2626"
          strokeWidth={3}
          strokeLinecap="round"
        />
      );
    })}

  {/* 2. PARENT-CHILD RELATIONSHIPS - Hierarchical tree structure */}
  {(() => {
    // Build comprehensive parent-child map
    const parentChildMap = {};
    relationships
      .filter(r => r.type === REL.PARENT_CHILD && r.treeId === currentTree?.id)
      .forEach(r => {
        if (!parentChildMap[r.parentId]) parentChildMap[r.parentId] = [];
        parentChildMap[r.parentId].push(r.childId);
      });

    // Group children by their parent sets
    const childrenByParentSet = {};
    
    treePeople.forEach(child => {
      const parentIds = relationships
        .filter(r => r.type === REL.PARENT_CHILD && r.childId === child.id && r.treeId === currentTree?.id)
        .map(r => r.parentId)
        .sort((a, b) => a - b);
      
      if (parentIds.length > 0) {
        const key = parentIds.join('-');
        if (!childrenByParentSet[key]) childrenByParentSet[key] = { parents: parentIds, children: [] };
        childrenByParentSet[key].children.push(child);
      }
    });

    return Object.values(childrenByParentSet).map((group, groupIndex) => {
      if (group.children.length === 0) return null;

      const parents = group.parents.map(id => treePeople.find(p => p.id === id)).filter(Boolean);
      if (parents.length === 0) return null;

      // Sort children by birth order (right to left - Arabic order)
      const children = group.children.sort((a, b) => (b.birthOrder || 0) - (a.birthOrder || 0));

      // Calculate parent connection point
      let parentConnectionX, parentConnectionY;
      
      if (parents.length === 2) {
        // Center between two parents
        const p1CenterX = parents[0].x + stylingOptions.boxWidth / 2;
        const p2CenterX = parents[1].x + stylingOptions.boxWidth / 2;
        parentConnectionX = (p1CenterX + p2CenterX) / 2;
        parentConnectionY = Math.min(parents[0].y, parents[1].y) + CARD.h;
      } else {
        // Single parent - use center bottom
        parentConnectionX = parents[0].x + stylingOptions.boxWidth / 2;
        parentConnectionY = parents[0].y + CARD.h;
      }

      // Calculate children positions
      const childrenCenters = children.map(child => ({
        x: child.x + stylingOptions.boxWidth / 2,
        y: child.y
      }));

      const leftmostChild = Math.min(...childrenCenters.map(c => c.x));
      const rightmostChild = Math.max(...childrenCenters.map(c => c.x));
      const topChildY = Math.min(...childrenCenters.map(c => c.y));

      // Position horizontal line 40px above the top child
      const horizontalLineY = topChildY - 40;

      return (
        <g key={`parent-group-${groupIndex}`}>
          {/* Vertical line from parent to horizontal bar */}
          <line
            x1={parentConnectionX}
            y1={parentConnectionY}
            x2={parentConnectionX}
            y2={horizontalLineY}
            stroke="#059669"
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Horizontal bar spanning all children */}
          <line
            x1={leftmostChild}
            y1={horizontalLineY}
            x2={rightmostChild}
            y2={horizontalLineY}
            stroke="#059669"
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Vertical lines from horizontal bar to each child */}
          {childrenCenters.map((childCenter, idx) => (
            <line
              key={`child-line-${idx}`}
              x1={childCenter.x}
              y1={horizontalLineY}
              x2={childCenter.x}
              y2={childCenter.y}
              stroke="#059669"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </g>
      );
    });
  })()}

  {/* 3. SIBLING CONNECTIONS - Only for siblings without shared parents */}
  {(() => {
    const siblingsWithoutParents = [];
    const processedPairs = new Set();

    relationships
      .filter(r => r.type === REL.SIBLING && r.treeId === currentTree?.id)
      .forEach(r => {
        const key = [r.person1Id, r.person2Id].sort().join('-');
        if (processedPairs.has(key)) return;
        
        const p1 = treePeople.find(p => p.id === r.person1Id);
        const p2 = treePeople.find(p => p.id === r.person2Id);
        
        if (p1 && p2) {
          // Check if neither has parents in this tree
          const p1HasParents = relationships.some(rel => 
            rel.type === REL.PARENT_CHILD && rel.childId === p1.id && rel.treeId === currentTree?.id
          );
          const p2HasParents = relationships.some(rel => 
            rel.type === REL.PARENT_CHILD && rel.childId === p2.id && rel.treeId === currentTree?.id
          );
          
          if (!p1HasParents && !p2HasParents) {
            siblingsWithoutParents.push([p1, p2]);
            processedPairs.add(key);
          }
        }
      });

    return siblingsWithoutParents.map(([p1, p2], i) => {
      const siblings = [p1, p2].sort((a, b) => a.x - b.x);
      const y = siblings[0].y - 25;
      const minX = Math.min(...siblings.map(s => s.x + stylingOptions.boxWidth / 2));
      const maxX = Math.max(...siblings.map(s => s.x + stylingOptions.boxWidth / 2));
      
      return (
        <path
          key={`sibling-${i}`}
          d={`M ${minX} ${y} Q ${(minX + maxX) / 2} ${y - 15} ${maxX} ${y}`}
          stroke="#7c3aed"
          strokeWidth={1.5}
          strokeDasharray="4,2"
          fill="none"
        />
      );
    });
  })()}
</svg>