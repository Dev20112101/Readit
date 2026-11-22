import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './db.js';
import Note from './contentModel.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS first so all responses and preflight requests include headers
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json());

// Ensure database connection is ready before handling API requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

// GET all posts/notes
app.get('/notes', async (req, res) => {
  try {
    const notes = await Note.find().sort({ date: -1, _id: -1 });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching notes: ' + error.message });
  }
});

// POST a new anonymous post
app.post('/notes', async (req, res) => {
  try {
    const { note, content, anonymousName = 'anonymous' } = req.body || {};
    const text = (note ?? content ?? '').trim();

    if (!text) {
      return res.status(400).json({ error: 'Post content cannot be empty.' });
    }

    const cleanName = (anonymousName || 'anonymous').trim() || 'anonymous';

    const newNote = await Note.create({
      content: text,
      anonymousName: cleanName,
      score: 0,
      date: new Date(),
    });

    res.status(201).json(newNote);
  } catch (error) {
    res.status(500).json({ error: 'Error adding post: ' + error.message });
  }
});

// PATCH upvote / downvote a post
app.patch('/notes/:id/vote', async (req, res) => {
  try {
    const { delta } = req.body || {};
    const numericDelta = Number(delta);

    if (![1, -1, 0].includes(numericDelta)) {
      return res.status(400).json({ error: 'Invalid vote delta.' });
    }

    const updated = await Note.findByIdAndUpdate(
      req.params.id,
      { $inc: { score: numericDelta } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating vote: ' + error.message });
  }
});

// DELETE a post
app.delete('/notes/:id', async (req, res) => {
  try {
    const deleted = await Note.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    res.json({ message: 'Post deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting post: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});