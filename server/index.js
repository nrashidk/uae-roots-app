import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import { db } from './db.js';
import { users, trees, people, relationships } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const verificationCodes = new Map();

async function getTwilioCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings || !connectionSettings.settings.account_sid) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

app.post('/api/sms/send-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+971' + phoneNumber.replace(/^0/, '');
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    verificationCodes.set(formattedPhone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    const { accountSid, apiKey, apiKeySecret, phoneNumber: fromNumber } = await getTwilioCredentials();
    const client = twilio(apiKey, apiKeySecret, { accountSid });

    await client.messages.create({
      body: `رمز التحقق الخاص بك في جذور الإمارات: ${code}`,
      from: fromNumber,
      to: formattedPhone
    });

    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('SMS send error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sms/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and code are required' });
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+971' + phoneNumber.replace(/^0/, '');
    
    const stored = verificationCodes.get(formattedPhone);
    
    if (!stored) {
      return res.status(400).json({ error: 'No verification code found. Please request a new code.' });
    }
    
    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(formattedPhone);
      return res.status(400).json({ error: 'Verification code expired. Please request a new code.' });
    }
    
    if (stored.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    verificationCodes.delete(formattedPhone);
    
    res.json({ 
      success: true, 
      verified: true,
      phoneNumber: formattedPhone
    });
  } catch (error) {
    console.error('SMS verify error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { id, email, displayName, phoneNumber, provider } = req.body;
    
    const existingUser = await db.select().from(users).where(eq(users.id, id));
    
    if (existingUser.length > 0) {
      const [updatedUser] = await db.update(users)
        .set({ lastLoginAt: new Date(), displayName, email })
        .where(eq(users.id, id))
        .returning();
      return res.json(updatedUser);
    }
    
    const [user] = await db.insert(users).values({
      id,
      email,
      displayName,
      phoneNumber,
      provider
    }).returning();
    res.json(user);
  } catch (error) {
    console.error('User create/update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/trees', async (req, res) => {
  try {
    const { userId } = req.query;
    let query = db.select().from(trees);
    if (userId) {
      query = query.where(eq(trees.createdBy, userId));
    }
    const allTrees = await query;
    res.json(allTrees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trees', async (req, res) => {
  try {
    const { name, description, createdBy } = req.body;
    if (!createdBy) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    const [tree] = await db.insert(trees).values({
      name,
      description,
      createdBy
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
