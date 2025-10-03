// In computeTreeLayout function, replace the child grouping section:
const parentSetGroups = {};
const orphans = [];

row.forEach(person => {
  const parents = relationships
    .filter(r => r.type === REL.PARENT_CHILD && r.childId === person.id && r.treeId === currentTree?.id)
    .map(r => r.parentId)
    .sort((a, b) => a - b);

  if (parents.length > 0) {
    const parentKey = parents.join('-');
    if (!parentSetGroups[parentKey]) {
      parentSetGroups[parentKey] = [];
    }
    parentSetGroups[parentKey].push(person);
  } else {
    orphans.push(person);
  }
});