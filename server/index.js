import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { users, trees, people, relationships } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Twilio connector response:', text);
    throw new Error('Failed to get Twilio credentials: ' + response.status);
  }
  
  const text = await response.text();
  if (!text) {
    throw new Error('Empty response from Twilio connector');
  }
  
  const data = JSON.parse(text);
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
    
    if (!fromNumber) {
      throw new Error('Twilio phone number not configured. Please configure a phone number in Twilio settings.');
    }
    
    const client = twilio(apiKey, apiKeySecret, { accountSid });

    await client.messages.create({
      body: `رمز التحقق الخاص بك في جذور الإمارات: ${code}`,
      from: fromNumber,
      to: formattedPhone
    });

    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('SMS send error:', error);
    let userMessage = 'فشل إرسال رمز التحقق';
    if (error.code === 21608) {
      userMessage = 'رقم الهاتف غير صالح أو غير مدعوم في منطقتك';
    } else if (error.code === 21211) {
      userMessage = 'رقم الهاتف غير صالح. تأكد من إدخال رقم صحيح';
    } else if (error.code === 21614) {
      userMessage = 'رقم الهاتف لا يدعم استقبال الرسائل النصية';
    } else if (error.code === 21408) {
      userMessage = 'خدمة الرسائل النصية غير متوفرة لهذه المنطقة';
    } else if (error.message?.includes('Twilio not connected')) {
      userMessage = 'خدمة الرسائل غير متصلة. يرجى التواصل مع الدعم';
    } else if (error.message?.includes('phone number not configured')) {
      userMessage = 'رقم الإرسال غير مهيأ. يرجى التواصل مع الدعم';
    }
    res.status(500).json({ error: userMessage, details: error.message });
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

app.put('/api/users/:id', async (req, res) => {
  try {
    const { email, phoneNumber, displayName } = req.body;
    const [updatedUser] = await db.update(users)
      .set({ 
        email: email || null,
        phoneNumber: phoneNumber || null,
        displayName: displayName || null
      })
      .where(eq(users.id, req.params.id))
      .returning();
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(updatedUser);
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const userTrees = await db.select().from(trees).where(eq(trees.createdBy, userId));
    
    for (const tree of userTrees) {
      await db.delete(relationships).where(eq(relationships.treeId, tree.id));
      await db.delete(people).where(eq(people.treeId, tree.id));
      await db.delete(trees).where(eq(trees.id, tree.id));
    }
    
    await db.delete(users).where(eq(users.id, userId));
    
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('User delete error:', error);
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  
  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
