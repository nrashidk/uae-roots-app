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
milk AS (
  SELECT r.tree_id, r.person1_id AS a, r.person2_id AS b
  FROM relationships r WHERE r.type = 'sibling' AND r.is_breastfeeding IS TRUE
  UNION
  SELECT r.tree_id, r.person2_id, r.person1_id
  FROM relationships r WHERE r.type = 'sibling' AND r.is_breastfeeding IS TRUE
),
sib AS (
  SELECT DISTINCT x.tree_id, x.child AS a, y.child AS b
  FROM pc x JOIN pc y ON x.tree_id = y.tree_id AND x.parent = y.parent AND x.child <> y.child
),
anc AS (
  SELECT tree_id, child AS person, parent AS ancestor FROM pc
  UNION
  SELECT a.tree_id, a.person, pc.parent FROM anc a
    JOIN pc ON pc.tree_id = a.tree_id AND pc.child = a.ancestor
),
des AS (
  SELECT tree_id, parent AS person, child AS descendant FROM pc
  UNION
  SELECT d.tree_id, d.person, pc.child FROM des d
    JOIN pc ON pc.tree_id = d.tree_id AND pc.parent = d.descendant
),
findings AS (
  SELECT 'ancestor' AS rule, m.tree_id, m.rel_id, m.a, m.b
  FROM mar m JOIN anc ON anc.tree_id = m.tree_id AND anc.person = m.a AND anc.ancestor = m.b

  UNION ALL
  SELECT 'descendant', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m JOIN des ON des.tree_id = m.tree_id AND des.person = m.a AND des.descendant = m.b

  UNION ALL
  SELECT 'sibling', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m JOIN sib s ON s.tree_id = m.tree_id AND s.a = m.a AND s.b = m.b

  UNION ALL
  SELECT 'milk sibling', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m JOIN milk k ON k.tree_id = m.tree_id AND k.a = m.a AND k.b = m.b

  UNION ALL
  SELECT 'niece/nephew line', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m
  JOIN pc ON pc.tree_id = m.tree_id AND pc.child = m.a
  JOIN des ON des.tree_id = m.tree_id AND des.person = pc.parent AND des.descendant = m.b
  WHERE NOT EXISTS (SELECT 1 FROM sib s2
                    WHERE s2.tree_id = m.tree_id AND s2.a = m.a AND s2.b = m.b)

  UNION ALL
  SELECT 'aunt/uncle line', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m
  JOIN anc ON anc.tree_id = m.tree_id AND anc.person = m.a
  JOIN pc ON pc.tree_id = m.tree_id AND pc.parent = anc.ancestor AND pc.child = m.b
  WHERE NOT EXISTS (SELECT 1 FROM sib s3
                    WHERE s3.tree_id = m.tree_id AND s3.a = m.a AND s3.b = m.b)

  UNION ALL
  SELECT 'wife mother or stepdaughter', m1.tree_id, m1.rel_id, m1.a, m1.b
  FROM mar m1
  JOIN mar m2 ON m2.tree_id = m1.tree_id AND m2.a = m1.a AND m2.b <> m1.b
  JOIN pc ON pc.tree_id = m1.tree_id AND pc.parent = m1.b AND pc.child = m2.b

  UNION ALL
  SELECT 'father wife', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m
  JOIN pc ON pc.tree_id = m.tree_id AND pc.child = m.a
  JOIN mar pm ON pm.tree_id = m.tree_id AND pm.a = pc.parent AND pm.b = m.b

  UNION ALL
  SELECT 'son wife', m.tree_id, m.rel_id, m.a, m.b
  FROM mar m
  JOIN pc ON pc.tree_id = m.tree_id AND pc.parent = m.a
  JOIN mar cm ON cm.tree_id = m.tree_id AND cm.a = pc.child AND cm.b = m.b

  UNION ALL
  SELECT 'two sisters concurrently', m1.tree_id, m1.rel_id, m1.a, m1.b
  FROM mar m1
  JOIN mar m2 ON m2.tree_id = m1.tree_id AND m2.a = m1.a AND m2.b <> m1.b
  JOIN (SELECT tree_id, a, b FROM sib UNION SELECT tree_id, a, b FROM milk) s
       ON s.tree_id = m1.tree_id AND s.a = m1.b AND s.b = m2.b
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
