WITH RECURSIVE
mar AS (
  SELECT r.id AS rel_id, r.tree_id, r.person1_id AS a, r.person2_id AS b, r.status
  FROM relationships r WHERE r.type = 'partner'
    AND r.person1_id IS NOT NULL AND r.person2_id IS NOT NULL
  UNION ALL
  SELECT r.id, r.tree_id, r.person2_id, r.person1_id, r.status
  FROM relationships r WHERE r.type = 'partner'
    AND r.person1_id IS NOT NULL AND r.person2_id IS NOT NULL
),
pc AS (
  SELECT r.tree_id, r.parent_id AS parent, r.child_id AS child
  FROM relationships r WHERE r.type = 'parent-child'
    AND r.parent_id IS NOT NULL AND r.child_id IS NOT NULL
),
sib AS (
  SELECT DISTINCT x.tree_id, x.child AS a, y.child AS b
  FROM pc x JOIN pc y ON x.tree_id = y.tree_id AND x.parent = y.parent AND x.child <> y.child
),
milk AS (
  SELECT r.tree_id, r.person1_id AS a, r.person2_id AS b
  FROM relationships r WHERE r.type = 'sibling' AND r.is_breastfeeding IS TRUE
  UNION
  SELECT r.tree_id, r.person2_id, r.person1_id
  FROM relationships r WHERE r.type = 'sibling' AND r.is_breastfeeding IS TRUE
),
allsib AS (SELECT tree_id, a, b FROM sib UNION SELECT tree_id, a, b FROM milk),
anc AS (
  SELECT tree_id, child AS person, parent AS ancestor FROM pc
  UNION
  SELECT a.tree_id, a.person, pc.parent FROM anc a
    JOIN pc ON pc.tree_id = a.tree_id AND pc.child = a.ancestor
),
findings AS (
  SELECT 'ancestor/descendant' AS rule, m.tree_id, m.rel_id, m.a, m.b
  FROM mar m JOIN anc ON anc.tree_id = m.tree_id AND anc.person = m.a AND anc.ancestor = m.b
  UNION ALL
  SELECT CASE WHEN EXISTS (SELECT 1 FROM sib s2
                           WHERE s2.tree_id = m.tree_id AND s2.a = m.a AND s2.b = m.b)
              THEN 'sibling' ELSE 'milk sibling' END,
         m.tree_id, m.rel_id, m.a, m.b
  FROM mar m JOIN allsib s ON s.tree_id = m.tree_id AND s.a = m.a AND s.b = m.b
  UNION ALL
  SELECT 'aunt-uncle/niece-nephew', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m
  JOIN pc ON pc.tree_id = m.tree_id AND pc.child = m.a
  JOIN allsib s ON s.tree_id = m.tree_id AND s.a = pc.parent AND s.b = m.b
  UNION ALL
  SELECT 'married to parent and child', m1.tree_id, m1.rel_id, m1.a, m1.b
  FROM mar m1
  JOIN mar m2 ON m2.tree_id = m1.tree_id AND m2.a = m1.a AND m2.b <> m1.b
  JOIN pc ON pc.tree_id = m1.tree_id AND pc.parent = m1.b AND pc.child = m2.b
  UNION ALL
  SELECT 'parent''s spouse', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m
  JOIN pc ON pc.tree_id = m.tree_id AND pc.child = m.a
  JOIN mar pm ON pm.tree_id = m.tree_id AND pm.a = pc.parent AND pm.b = m.b
  UNION ALL
  SELECT 'child''s spouse', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m
  JOIN pc ON pc.tree_id = m.tree_id AND pc.parent = m.a
  JOIN mar cm ON cm.tree_id = m.tree_id AND cm.a = pc.child AND cm.b = m.b
  UNION ALL
  SELECT 'two sisters concurrently', m1.tree_id, m1.rel_id, m1.a, m1.b
  FROM mar m1
  JOIN mar m2 ON m2.tree_id = m1.tree_id AND m2.a = m1.a AND m2.b <> m1.b
  JOIN allsib s ON s.tree_id = m1.tree_id AND s.a = m1.b AND s.b = m2.b
  JOIN people w1 ON w1.id = m1.b
  JOIN people w2 ON w2.id = m2.b
  WHERE m1.status IS DISTINCT FROM 'divorced'
    AND m2.status IS DISTINCT FROM 'divorced'
    AND w1.is_living IS NOT FALSE
    AND w2.is_living IS NOT FALSE
)
SELECT DISTINCT
  f.tree_id,
  f.rule,
  f.rel_id,
  pa.first_name AS person_a,
  pb.first_name AS person_b,
  f.a AS a_id,
  f.b AS b_id
FROM findings f
JOIN people pa ON pa.id = f.a
JOIN people pb ON pb.id = f.b
ORDER BY f.tree_id, f.rule, f.rel_id;
