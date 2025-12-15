/**
 * Data Transformation Utilities
 * Converts between main-app format and family-tree-layout.js format
 */

/**
 * Convert main-app people/relationships to algorithm format
 * @param {Array} people - Array of person objects from main-app
 * @param {Array} relationships - Array of relationship objects from main-app
 * @param {number} treeId - Current tree ID to filter by
 * @returns {Object} - Family data in algorithm format
 */
export function convertToAlgorithmFormat(people, relationships, treeId) {
    const familyData = {};

    // Filter by tree ID
    const treePeople = people.filter((p) => p.treeId === treeId);
    const treeRels = relationships.filter((r) => r.treeId === treeId);

    // Build relationship maps
    const parentChildMap = {}; // parentId -> [childIds]
    const spouseMap = {}; // personId -> [spouseIds]
    const siblingMap = {}; // personId -> [siblingIds]

    treeRels.forEach((rel) => {
        if (rel.type === "parent-child") {
            if (!parentChildMap[rel.parentId]) {
                parentChildMap[rel.parentId] = [];
            }
            if (!parentChildMap[rel.parentId].includes(rel.childId)) {
                parentChildMap[rel.parentId].push(rel.childId);
            }
        } else if (rel.type === "partner") {
            if (!spouseMap[rel.person1Id]) {
                spouseMap[rel.person1Id] = [];
            }
            if (!spouseMap[rel.person2Id]) {
                spouseMap[rel.person2Id] = [];
            }
            if (!spouseMap[rel.person1Id].includes(rel.person2Id)) {
                spouseMap[rel.person1Id].push(rel.person2Id);
            }
            if (!spouseMap[rel.person2Id].includes(rel.person1Id)) {
                spouseMap[rel.person2Id].push(rel.person1Id);
            }
        } else if (rel.type === "sibling") {
            if (!siblingMap[rel.person1Id]) {
                siblingMap[rel.person1Id] = [];
            }
            if (!siblingMap[rel.person2Id]) {
                siblingMap[rel.person2Id] = [];
            }
            siblingMap[rel.person1Id].push(rel.person2Id);
            siblingMap[rel.person2Id].push(rel.person1Id);
        }
    });

    // Find parents for each person
    const childParentMap = {}; // childId -> {mother, father}
    Object.entries(parentChildMap).forEach(([parentIdStr, childIds]) => {
        const parentId = parseInt(parentIdStr);
        const parent = treePeople.find((p) => p.id === parentId);
        if (!parent) return;

        childIds.forEach((childId) => {
            if (!childParentMap[childId]) {
                childParentMap[childId] = {};
            }

            if (parent.gender === "female") {
                childParentMap[childId].mother = parentId;
            } else if (parent.gender === "male") {
                childParentMap[childId].father = parentId;
            } else {
                // If gender is not specified or is 'other', assign to the first available parent slot
                if (!childParentMap[childId].mother) {
                    childParentMap[childId].mother = parentId;
                } else if (!childParentMap[childId].father) {
                    childParentMap[childId].father = parentId;
                } else {
                }
            }
        });
    });

    // Handle sibling relationships by connecting them through common parents
    // For siblings, we need to ensure they share the same parents
    Object.entries(siblingMap).forEach(([personIdStr, siblingIds]) => {
        const personId = parseInt(personIdStr);
        const personParents = childParentMap[personId];

        siblingIds.forEach((siblingId) => {
            // If the person has parents, assign the same parents to the sibling
            if (personParents) {
                if (!childParentMap[siblingId]) {
                    childParentMap[siblingId] = {};
                }

                // Copy parents from person to sibling
                if (personParents.mother && !childParentMap[siblingId].mother) {
                    childParentMap[siblingId].mother = personParents.mother;

                    // Also add sibling to parent's children list
                    if (!parentChildMap[personParents.mother]) {
                        parentChildMap[personParents.mother] = [];
                    }
                    if (
                        !parentChildMap[personParents.mother].includes(
                            siblingId,
                        )
                    ) {
                        parentChildMap[personParents.mother].push(siblingId);
                    }
                }

                if (personParents.father && !childParentMap[siblingId].father) {
                    childParentMap[siblingId].father = personParents.father;

                    // Also add sibling to parent's children list
                    if (!parentChildMap[personParents.father]) {
                        parentChildMap[personParents.father] = [];
                    }
                    if (
                        !parentChildMap[personParents.father].includes(
                            siblingId,
                        )
                    ) {
                        parentChildMap[personParents.father].push(siblingId);
                    }
                }
            }
        });
    });

    // Convert each person
    treePeople.forEach((person) => {
        const personId = `P${person.id}`;
        const parents = childParentMap[person.id] || {};
        const spouses = spouseMap[person.id] || [];
        const children = parentChildMap[person.id]
            ? Array.from(new Set(parentChildMap[person.id]))
            : [];

        // Build display name
        const displayName =
            person.firstName && person.lastName
                ? `${person.firstName} ${person.lastName}`.trim()
                : person.firstName || person.lastName || `Person ${person.id}`;

        // Build person object in algorithm format (matching data-large.js structure EXACTLY)
        const personData = {
            // Person ID (required)
            i: personId,

            // Name (use 'p' for person name)
            p: displayName,

            // Display name (same as p in data-large.js)
            h: displayName,

            // Gender
            g:
                person.gender === "male"
                    ? "m"
                    : person.gender === "female"
                      ? "f"
                      : "o",

            // Birth date (convert to YYYYMMDD format if available)
            b: person.birthDate
                ? person.birthDate.replace(/-/g, "")
                : undefined,

            // Death date (if not living)
            d:
                !person.isLiving && person.deathDate
                    ? person.deathDate.replace(/-/g, "")
                    : undefined,

            // Short parent properties (used by algorithm for positioning)
            m: parents.mother ? `P${parents.mother}` : undefined,
            f: parents.father ? `P${parents.father}` : undefined,

            // Current spouse (primary spouse is first in array) - Keep for algorithm traversal
            s: spouses.length > 0 ? `P${spouses[0]}` : null,

            // Property 'l' (always null in data-large.js)
            l: null,

            // Children (using 'c' property as expected by algorithm) - MUST be present (empty array if no children)
            c: children.length > 0 ? children.map((cid) => `P${cid}`) : [],

            // Partners object (all partners) - MUST be present (empty object if no partners)
            pc:
                spouses.length > 0
                    ? Object.fromEntries(
                          spouses.map((sid) => [`P${sid}`, true]),
                      )
                    : {},

            // Flag properties (from data-large.js)
            fg: true, // Always true in data-large.js for most people

            // First parent set (MUST always be present, even if null)
            m1: parents.mother ? `P${parents.mother}` : null,
            f1: parents.father ? `P${parents.father}` : null,
            t1: parents.mother || parents.father ? "b" : null, // 'b' for biological, null if no parents

            // Second parent set (MUST always be present as null)
            m2: null,
            f2: null,
            t2: null,

            // Third parent set (MUST always be present as null)
            m3: null,
            f3: null,
            t3: null,

            // Auto-generated index for sorting
            ai: person.id,

            // Order field for custom ordering (used by layout algorithm for sibling ordering)
            O: person.birthOrder !== undefined && person.birthOrder !== null 
                ? person.birthOrder 
                : undefined,

            // Partner count - MUST be present (0 if no partners)
            cp: spouses.length,

            // Primary spouse - MUST be present (null if no spouse)
            es: spouses.length > 0 ? `P${spouses[0]}` : null,

            // Flag property (from data-large.js)
            nf: person.gender === "male" ? false : true, // false for males, true for females

            // Additional fields (only include if present)
            photo: person.photo || undefined,
            notes: person.notes || undefined,
            birthPlace: person.birthPlace || undefined,
            profession: person.profession || undefined,
            company: person.company || undefined,
            email: person.email || undefined,
            phone: person.phone || undefined,
            address: person.address || undefined,
        };

        // Remove undefined values (but keep null, 0, [], {})
        Object.keys(personData).forEach((key) => {
            if (personData[key] === undefined) {
                delete personData[key];
            }
        });

        familyData[personId] = personData;
    });

    return familyData;
}

/**
 * Find a sensible root person for rendering.
 * Priority:
 *  1) A person with BOTH parents (to enable upward traversal and siblings)
 *  2) A person with ANY parent
 *  3) Otherwise, a person with NO parents (original behavior)
 *  4) Fallback to first person
 * @param {Object} familyData - Family data in algorithm format
 * @returns {string} - Root person ID
 */
export function findRootPerson(familyData) {
    const ids = Object.keys(familyData);

    const withBothParents = ids.filter(
        (id) => !!(familyData[id].m1 && familyData[id].f1),
    );
    const withAnyParent = ids.filter(
        (id) => !!(familyData[id].m1 || familyData[id].f1),
    );
    const withoutParents = ids.filter(
        (id) => !familyData[id].m1 && !familyData[id].f1,
    );

    if (withBothParents.length > 0) {
        return withBothParents[0];
    }
    if (withAnyParent.length > 0) {
        return withAnyParent[0];
    }
    if (withoutParents.length > 0) {
        return withoutParents[0];
    }

    // Ultimate fallback
    const fallbackRoot = ids.length > 0 ? ids[0] : "START";
    return fallbackRoot;
}

/**
 * Convert algorithm layout result back to main-app format
 * Updates the x, y coordinates of people based on layout
 * @param {Array} people - Original people array
 * @param {Object} layout - Layout result from FamilyTreeLayout.generateLayout()
 * @returns {Array} - Updated people array with new coordinates
 */
export function applyLayoutToPeople(people, layout) {
    if (!layout || !layout.entities) {
        return people;
    }

    const updatedPeople = people.map((person) => {
        const personId = `P${person.id}`;
        const entity = layout.entities[personId];

        if (entity) {
            return {
                ...person,
                x: entity.x,
                y: entity.y,
            };
        }

        return person;
    });

    return updatedPeople;
}

/**
 * Generate a unique ID for new people
 * @returns {number} - Unique ID
 */
export function generatePersonId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * Add a person to the data structure with proper relationships
 * @param {Array} people - Current people array
 * @param {Array} relationships - Current relationships array
 * @param {Object} personData - New person data
 * @param {string} relationshipType - Type: 'spouse', 'child', 'parent', 'sibling', or null
 * @param {number} relatedPersonId - ID of person to relate to
 * @param {number} treeId - Current tree ID
 * @returns {Object} - {updatedPeople, updatedRelationships, newPersonId}
 */
export function addPersonWithRelationship(
    people,
    relationships,
    personData,
    relationshipType,
    relatedPersonId,
    treeId,
) {
    const newPersonId = generatePersonId();
    const newPerson = {
        id: newPersonId,
        ...personData,
        treeId,
        x: 0, // Will be set by layout algorithm
        y: 0,
        isLiving: personData.isLiving !== false,
    };

    const updatedPeople = [...people, newPerson];
    let updatedRelationships = [...relationships];

    if (relatedPersonId && relationshipType) {
        const relatedPerson = people.find((p) => p.id === relatedPersonId);

        switch (relationshipType) {
            case "spouse": {
                // Add partner relationship
                updatedRelationships.push({
                    id: Date.now() + 1,
                    type: "partner",
                    person1Id: relatedPersonId,
                    person2Id: newPersonId,
                    treeId,
                });
                break;
            }

            case "child": {
                // Add parent-child relationship
                updatedRelationships.push({
                    id: Date.now() + 1,
                    type: "parent-child",
                    parentId: relatedPersonId,
                    childId: newPersonId,
                    treeId,
                });

                // If related person has a spouse, also add them as parent
                const spouseRel = relationships.find(
                    (r) =>
                        r.type === "partner" &&
                        (r.person1Id === relatedPersonId ||
                            r.person2Id === relatedPersonId) &&
                        r.treeId === treeId,
                );

                if (spouseRel) {
                    const spouseId =
                        spouseRel.person1Id === relatedPersonId
                            ? spouseRel.person2Id
                            : spouseRel.person1Id;

                    updatedRelationships.push({
                        id: Date.now() + 2,
                        type: "parent-child",
                        parentId: spouseId,
                        childId: newPersonId,
                        treeId,
                    });
                }
                break;
            }

            case "parent": {
                // Add parent-child relationship (reversed)
                updatedRelationships.push({
                    id: Date.now() + 1,
                    type: "parent-child",
                    parentId: newPersonId,
                    childId: relatedPersonId,
                    treeId,
                });
                break;
            }

            case "sibling": {
                // Add sibling relationship
                updatedRelationships.push({
                    id: Date.now() + 1,
                    type: "sibling",
                    person1Id: relatedPersonId,
                    person2Id: newPersonId,
                    treeId,
                });
                break;
            }
        }
    }

    return {
        updatedPeople,
        updatedRelationships,
        newPersonId,
    };
}
