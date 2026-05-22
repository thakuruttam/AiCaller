import express from 'express';
import { prisma } from '../db.js';
import { VoiceAgent } from '../telephony/VoiceAgent.js';

const router = express.Router();

// In-memory store for active sandbox sessions. 
// For production, this would be Redis.
const activeSessions = new Map();

router.post('/start', async (req, res) => {
  try {
    const { campaignId, contactName } = req.body;
    
    // Fetch campaign rules
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        dataToCollect: true,
        endCallIf: true,
        callModule: {
          select: {
            goal: true,
            callIntro: true,
            callSignOff: true,
            successCriteria: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const sessionId = `sandbox_${Date.now()}`;
    
    // Create new agent instance
    const agent = new VoiceAgent({
      name: campaign.name,
      contactName: contactName || 'Sandbox Tester',
      goal: campaign.callModule?.goal,
      callIntro: campaign.callModule?.callIntro,
      callSignOff: campaign.callModule?.callSignOff,
      dataToCollect: campaign.dataToCollect,
      endCallIf: campaign.endCallIf,
      successCriteria: campaign.callModule?.successCriteria
    });

    activeSessions.set(sessionId, agent);

    // Initial greeting using the specific intro
    const greeting = await agent.processInput(`(System: The call has just been connected. Say this EXACT introduction to the user: "${campaign.callModule?.callIntro || 'Hello, this is an AI assistant calling.'}")`);

    res.json({ sessionId, reply: greeting });
  } catch (error) {
    console.error("Sandbox start error:", error);
    res.status(500).json({ error: "Failed to start Sandbox session" });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const agent = activeSessions.get(sessionId);

    if (!agent) {
      return res.status(404).json({ error: "Session not found or expired" });
    }

    const reply = await agent.processInput(message);
    res.json({ reply });
  } catch (error) {
     console.error("Sandbox chat error:", error);
     res.status(500).json({ error: "Failed to process chat" });
  }
});

export default router;
