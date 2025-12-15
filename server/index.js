import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { trees, people, relationships } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/trees', async (req, res) => {
  try {
    const allTrees = await db.select().from(trees);
    res.json(allTrees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trees', async (req, res) => {
  try {
    const { name, description, createdBy } = req.body;
    const [tree] = await db.insert(trees).values({
      name,
      description,
      createdBy: createdBy || 'test-user'
    }).returning();
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/trees/:id', async (req, res) => {
  try {
    await db.delete(trees).where(eq(trees.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/people', async (req, res) => {
  try {
    const { treeId } = req.query;
    let query = db.select().from(people);
    if (treeId) {
      query = query.where(eq(people.treeId, parseInt(treeId)));
    }
    const allPeople = await query;
    res.json(allPeople);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/people', async (req, res) => {
  try {
    const personData = {
      treeId: req.body.treeId,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      gender: req.body.gender,
      birthDate: req.body.birthDate || null,
      deathDate: req.body.deathDate || null,
      isLiving: req.body.isLiving !== undefined ? req.body.isLiving : true,
      phone: req.body.phone || null,
      email: req.body.email || null,
      identificationNumber: req.body.identificationNumber || null,
      birthOrder: req.body.birthOrder || null
    };
    const [person] = await db.insert(people).values(personData).returning();
    res.json(person);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/people/:id', async (req, res) => {
  try {
    const personData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      gender: req.body.gender,
      birthDate: req.body.birthDate || null,
      deathDate: req.body.deathDate || null,
      isLiving: req.body.isLiving,
      phone: req.body.phone || null,
      email: req.body.email || null,
      identificationNumber: req.body.identificationNumber || null,
      birthOrder: req.body.birthOrder || null
    };
    const [person] = await db.update(people)
      .set(personData)
      .where(eq(people.id, parseInt(req.params.id)))
      .returning();
    res.json(person);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/people/:id', async (req, res) => {
  try {
    await db.delete(people).where(eq(people.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/people/:id/birthOrder', async (req, res) => {
  try {
    const { birthOrder } = req.body;
    const [person] = await db.update(people)
      .set({ birthOrder })
      .where(eq(people.id, parseInt(req.params.id)))
      .returning();
    res.json(person);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/relationships', async (req, res) => {
  try {
    const { treeId } = req.query;
    let query = db.select().from(relationships);
    if (treeId) {
      query = query.where(eq(relationships.treeId, parseInt(treeId)));
    }
    const allRelationships = await query;
    res.json(allRelationships);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/relationships', async (req, res) => {
  try {
    const relationshipData = {
      treeId: req.body.treeId,
      type: req.body.type,
      person1Id: req.body.person1Id || null,
      person2Id: req.body.person2Id || null,
      childId: req.body.childId || null,
      parentId: req.body.parentId || null,
      isBreastfeeding: req.body.isBreastfeeding || false,
      isDotted: req.body.isDotted || false
    };
    const [relationship] = await db.insert(relationships).values(relationshipData).returning();
    res.json(relationship);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/relationships/:id', async (req, res) => {
  try {
    await db.delete(relationships).where(eq(relationships.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
