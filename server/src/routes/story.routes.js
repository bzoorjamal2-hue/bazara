import { Router } from 'express';
import { createStory, deleteStory } from '../controllers/story.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, createStory);
router.delete('/:id', requireAuth, deleteStory);

export default router;
