DELETE FROM people WHERE tree_id = 65;
DELETE FROM deletions WHERE tree_id = 65;

INSERT INTO people (id, tree_id, first_name, gender, is_living, is_breastfed, birth_order) VALUES
 (9001,65,'سالم','male',   true,  false, NULL),
 (9002,65,'نورة','female', true,  false, NULL),
 (9003,65,'خالد','male',   true,  false, NULL),
 (9004,65,'مريم','female', true,  false, -1),
 (9005,65,'فيصل','male',   true,  false, -2),
 (9006,65,'هيا','female',  true,  false, -3),
 (9007,65,'عبير','female', true,  false, NULL),
 (9008,65,'لطيفة','female',true,  false, NULL),
 (9009,65,'فاطمة','female',false, false, NULL),
 (9010,65,'راشد','male',   true,  false, NULL),
 (9011,65,'طارق','male',   true,  false, NULL),
 (9012,65,'حصة','female',  true,  false, -1),
 (9013,65,'جمال','male',   true,  false, NULL),
 (9014,65,'سارة','female', true,  false, NULL),
 (9015,65,'بدر','male',    true,  false, NULL),
 (9016,65,'شمة','female',  true,  false, -1),
 (9017,65,'ماجد','male',   true,  false, NULL),
 (9018,65,'عمر','male',    true,  false, NULL),
 (9019,65,'دانة','female', true,  false, -1),
 (9020,65,'نجلاء','female',true,  false, NULL),
 (9021,65,'لولوة','female',true,  true,  NULL),
 (9022,65,'جمعة','male',   true,  false, NULL),
 (9023,65,'وضحة','female', true,  false, NULL);

INSERT INTO relationships (tree_id, type, person1_id, person2_id, status) VALUES
 (65,'partner',9001,9002,NULL),
 (65,'partner',9003,9007,NULL),
 (65,'partner',9003,9008,NULL),
 (65,'partner',9003,9009,NULL),
 (65,'partner',9004,9010,NULL),
 (65,'partner',9006,9011,NULL),
 (65,'partner',9010,9012,'divorced'),
 (65,'partner',9013,9014,NULL),
 (65,'partner',9015,9020,NULL),
 (65,'partner',9022,9023,NULL),
 (65,'partner',9018,9016,NULL);

INSERT INTO relationships (tree_id, type, parent_id, child_id) VALUES
 (65,'parent-child',9001,9003),
 (65,'parent-child',9002,9003),
 (65,'parent-child',9001,9004),
 (65,'parent-child',9002,9004),
 (65,'parent-child',9001,9005),
 (65,'parent-child',9002,9005),
 (65,'parent-child',9001,9006),
 (65,'parent-child',9002,9006),
 (65,'parent-child',9013,9007),
 (65,'parent-child',9014,9007),
 (65,'parent-child',9013,9012),
 (65,'parent-child',9014,9012),
 (65,'parent-child',9003,9015),
 (65,'parent-child',9007,9015),
 (65,'parent-child',9003,9016),
 (65,'parent-child',9007,9016),
 (65,'parent-child',9003,9017),
 (65,'parent-child',9008,9017),
 (65,'parent-child',9004,9018),
 (65,'parent-child',9010,9018),
 (65,'parent-child',9004,9019),
 (65,'parent-child',9010,9019),
 (65,'parent-child',9022,9021),
 (65,'parent-child',9023,9021);

INSERT INTO relationships (tree_id, type, person1_id, person2_id, is_breastfeeding) VALUES
 (65,'sibling',9015,9021,true);

SELECT setval(pg_get_serial_sequence('people','id'),
              GREATEST(COALESCE((SELECT MAX(id) FROM people),1),1));
SELECT setval(pg_get_serial_sequence('relationships','id'),
              GREATEST(COALESCE((SELECT MAX(id) FROM relationships),1),1));
