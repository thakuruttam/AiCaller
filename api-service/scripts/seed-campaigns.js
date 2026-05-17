import { prisma } from '../src/db.js';

const generateTranscripts = (type, contactName) => {
  const transcripts = {
    SALES: [
      // 1. Highly Positive, Long
      `ASSISTANT: Hello! This is Alex from CloudTech Solutions. Am I speaking with ${contactName}?\n\nUSER: Yes, this is ${contactName}. How can I help you?\n\nASSISTANT: Great! I'm calling because we've just launched a new enterprise cloud storage platform that reduces latency by 40% globally. I noticed your company has been scaling rapidly. Are you currently facing any challenges with your data retrieval speeds?\n\nUSER: You know, it's funny you mention that. We actually had a major outage last week because our current database couldn't handle the read volume during a flash sale. It was a nightmare. Queries were taking up to 5 seconds.\n\nASSISTANT: Oh no, 5 seconds is an eternity in e-commerce. I totally understand how stressful that must have been. Our platform integrates seamlessly with existing SQL and NoSQL databases, using a proprietary edge caching layer. We guarantee sub-10 millisecond response times.\n\nUSER: Sub-10 milliseconds? Really? Even under heavy load?\n\nASSISTANT: Yes, absolutely. We have an auto-scaling architecture that spins up new read replicas instantly. Would you be open to a 10-minute technical demo next Tuesday to see it in action?\n\nUSER: Honestly, yes. If it does what you say it does, we need it yesterday. Tuesday morning at 10 AM works for me.\n\nASSISTANT: Fantastic. I've got you down for 10 AM next Tuesday. I'll send over a calendar invite with the Zoom link right now. I'll also include a one-pager on the architecture.\n\nUSER: Sounds great, Alex. I'm looking forward to it.\n\nASSISTANT: Excellent, I'll send over a calendar invite. Have a great day!`,
      
      // 2. Negative / Annoyed, Short
      `ASSISTANT: Hi, is this ${contactName}?\n\nUSER: Yeah, who is this?\n\nASSISTANT: Hi ${contactName}, I'm calling from Solarify. We help homeowners reduce their energy bills by up to 50% with zero upfront cost. Have you ever considered solar panels?\n\nUSER: Look, I've told you guys three times already, I rent this house! I can't put solar panels on a roof I don't own. Stop calling me!\n\nASSISTANT: I am so sorry for the inconvenience, ${contactName}. I will remove your number from our list immediately so you won't receive any more calls.\n\nUSER: Just take me off the list. Goodbye.\n\nASSISTANT: Will do. Have a good day.`,
      
      // 3. Confused, Long
      `ASSISTANT: Hello, am I speaking with ${contactName}?\n\nUSER: Yes... who is calling?\n\nASSISTANT: Hi ${contactName}, I'm calling about your recent inquiry regarding our premium CRM software. Are you still looking for a solution for your sales team?\n\nUSER: CRM? I don't... wait, are you from the cable company? My internet has been down all morning.\n\nASSISTANT: Oh, no, I'm so sorry for the confusion! This is Alex from SalesForcePro. We provide customer relationship management software. It looks like someone from your company filled out a form on our website yesterday.\n\nUSER: Oh, CRM. Sorry, my head is all over the place because of the internet outage. Honestly, my partner handles the software stuff. I just deal with the inventory. I think she might have been looking into it.\n\nASSISTANT: No problem at all! Would you mind if I sent an email with some information that you can pass along to your partner when she's available?\n\nUSER: Yeah, that's fine. Just send it to the main info email address. But I really can't talk right now, I have to figure out this router.\n\nASSISTANT: Completely understand. I'll send that email over. Good luck with the internet! Have a wonderful day.\n\nUSER: Thanks.`
    ],
    HR: [
      // 1. Solid Candidate, Long
      `ASSISTANT: Hello, this is the AI recruiter from TechCorp. Am I speaking with ${contactName}?\n\nUSER: Yes, hi! Good afternoon.\n\nASSISTANT: Hi ${contactName}. I'm calling to conduct a brief preliminary interview for the Full Stack Developer position. Are you still interested in this role?\n\nUSER: Yes, absolutely. I've been following TechCorp for a while and I really love the open-source projects your team has been putting out recently.\n\nASSISTANT: That's great to hear! We love passionate developers. Could you tell me how many years of experience you have with React and Node.js?\n\nUSER: Let's see. I started using React back in 2018, so about 6 years now. I've been using Node.js for backend services for about 4 years. At my last job, I actually migrated our entire legacy PHP monolith to a Node microservices architecture.\n\nASSISTANT: That sounds like a massive project! Managing microservices can be complex. What is your current notice period if we were to move forward?\n\nUSER: My current company requires a 4-week notice, but I have a lot of unused vacation time, so I might be able to negotiate it down to 2 weeks if necessary.\n\nASSISTANT: Excellent. That works perfectly with our timeline. Our team will review your responses and get back to you within 48 hours to schedule a technical interview. Thank you for your time!\n\nUSER: Awesome, thanks so much. Talk to you soon.`,

      // 2. Unqualified, Negative
      `ASSISTANT: Hi, am I speaking with ${contactName}?\n\nUSER: Yeah, speaking.\n\nASSISTANT: Hello ${contactName}. I'm calling regarding your application for the Marketing Manager role. Could you briefly describe a successful campaign you led recently?\n\nUSER: Uh, well, I actually haven't worked in marketing before. I was mostly a cashier, but I have a lot of followers on TikTok so I figured I could be a manager. I posted a video last week that got like 10,000 views.\n\nASSISTANT: I see. While social media experience is valuable, this specific role requires at least 3 years of experience managing B2B enterprise marketing budgets. Are you open to entry-level positions instead?\n\nUSER: Entry level? No way. I want the manager salary. If you aren't going to make me a manager, just forget it. This is a waste of time.\n\nASSISTANT: I understand. We will keep your resume on file for future opportunities. Thank you for your time and have a great day.\n\nUSER: Whatever. *hangs up*`,

      // 3. Busy, Rescheduling
      `ASSISTANT: Hello, is ${contactName} available?\n\nUSER: This is ${contactName}. Can you make it quick? I'm driving.\n\nASSISTANT: Hi! I'm reaching out from the hiring team at Global Logistics regarding your application. I can call back later if you are driving.\n\nUSER: Yeah, please. I'm literally merging onto the highway right now. Call me back tomorrow at 5 PM.\n\nASSISTANT: I will absolutely do that. I'll note your file to call back tomorrow at 5 PM. Please drive safe!\n\nUSER: Thanks.`
    ],
    PARENT_TEACHER: [
      // 1. Positive, Long
      `ASSISTANT: Hello, this is an automated call from Springfield Elementary. Am I speaking with the parent of ${contactName}?\n\nUSER: Yes, this is her father. Is everything alright? She's not sick is she?\n\nASSISTANT: Hello. Everything is perfectly fine! I'm actually calling to schedule a parent-teacher conference for next week to discuss her recent term project. Would you prefer a meeting on Wednesday afternoon or Thursday morning?\n\nUSER: Oh, phew! Sorry, you always assume the worst when the school calls. Her term project? The one on the solar system?\n\nASSISTANT: Yes, exactly! Her teacher, Mrs. Krabappel, was extremely impressed with the 3D model she built. We'd love to show it to you and discuss her progress. What time works best for you?\n\nUSER: That's so wonderful to hear. She worked on that for three weeks straight. I would love to come in. Thursday morning would be best for my work schedule.\n\nASSISTANT: Great. I have a slot available at 9:30 AM on Thursday. Does that work for you?\n\nUSER: Actually, could we do 8:30 AM? I have a stand-up meeting at 10 AM.\n\nASSISTANT: Let me check... Yes, 8:30 AM on Thursday is available. You are all set. We look forward to seeing you then. Have a great day!\n\nUSER: Thank you so much!`,

      // 2. Angry Parent
      `ASSISTANT: Hi, is this the parent of ${contactName}?\n\nUSER: Yes, who is this?\n\nASSISTANT: I'm calling on behalf of Mr. Smith, ${contactName}'s math teacher. He wanted to inform you that ${contactName} has been struggling with the recent algebra homework and missed the last two assignments.\n\nUSER: Are you kidding me? We sit at the kitchen table every night for two hours doing homework! If he's missing assignments, it's because the teacher's online portal is completely broken. We uploaded them on Sunday!\n\nASSISTANT: I sincerely apologize for the frustration. The online portal has had some intermittent issues recently. I will leave a note for Mr. Smith to check the server logs and accept physical copies in the meantime.\n\nUSER: Yeah, he better. I'm not having my son's grade drop because of some stupid website. Have the principal call me tomorrow.\n\nASSISTANT: I will pass that message along immediately. Thank you for letting us know, and have a good evening.`,

      // 3. Neutral, Missing fields
      `ASSISTANT: Hello, am I speaking with the guardian of ${contactName}?\n\nUSER: Hello? Yes, speaking.\n\nASSISTANT: This is a courtesy call from the school nurse's office. ${contactName} has missed three consecutive days of school. Is everything okay?\n\nUSER: Oh, yes, sorry. We are out of town visiting family. It was a sudden family emergency.\n\nASSISTANT: I understand. Family comes first. Could you provide a timeline for when ${contactName} might return to class so we can prepare their makeup work?\n\nUSER: Um, I have someone on the other line, I have to go. I'll email the school later. Bye.\n\nASSISTANT: Thank you, we will look out for your email. Goodbye.`
    ],
    SURVEY: [
      // 1. Detailed Feedback, Mixed Sentiment
      `ASSISTANT: Hello! This is a quick customer satisfaction survey from Ocean Bank. Am I speaking with ${contactName}?\n\nUSER: Yes, this is me.\n\nASSISTANT: Thank you for banking with us. On a scale of 1 to 10, how satisfied are you with our mobile banking app?\n\nUSER: I guess I'd give it a 6.\n\nASSISTANT: Thank you. What is one feature you would like to see improved or added in the future?\n\nUSER: Well, the UI is really nice, I like the dark mode. But honestly, the core functionality is lacking. Every time I try to transfer money between my checking and savings, the app freezes for like 10 seconds. I never know if the transfer actually went through until I refresh the app. It makes me really anxious about my money.\n\nASSISTANT: I completely understand why that would be concerning. Trust and reliability are the most important things when it comes to banking apps. I am logging this critical feedback regarding transfer freezing for our engineering team right now. Is there anything else you'd like to add?\n\nUSER: Also, maybe add biometric login? Typing my password every time is annoying. Other than that, the customer service in the actual branch has been great.\n\nASSISTANT: We appreciate that feedback, and biometric login is actually coming in the next update! Thank you for your time and have a wonderful day!\n\nUSER: Oh nice. You too.`,

      // 2. Extremely Happy
      `ASSISTANT: Hi, is this ${contactName}?\n\nUSER: Yes it is! Hi!\n\nASSISTANT: I'm calling from the feedback team at FreshCart Groceries. We noticed you recently placed your first online order with us. Did your delivery arrive on time?\n\nUSER: Oh my gosh, yes it did! Not only was it on time, but the driver was so sweet. He carried all the heavy water bottles right into my kitchen because he saw I had my hands full with my baby.\n\nASSISTANT: That is absolutely wonderful to hear! We pride ourselves on going the extra mile. Were all the items you ordered included and in good condition?\n\nUSER: Everything was perfect. The produce looked even better than when I pick it myself at the store. The strawberries were huge. I'm definitely going to use FreshCart every week now. It's a lifesaver for a new mom.\n\nASSISTANT: That makes us so happy. I've added a $10 credit to your account as a thank you for being such a wonderful customer. Have a great day, ${contactName}!\n\nUSER: Thank you so much! Bye!`
    ]
  };

  const options = transcripts[type];
  const randomTranscript = options[Math.floor(Math.random() * options.length)];
  return `[Twilio_SID:CA${Math.random().toString(36).substring(2, 15)}]\n\n${randomTranscript}`;
};

async function main() {
  console.log("Starting DB seed script...");

  // Get tenant
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { name: 'Demo Tenant' } });
  }

  // Generate campaigns
  const campaignConfigs = [
    {
      name: "Q3 Cloud Solutions Sales Pitch",
      type: "SALES",
      module: {
        goal: "Pitch the new cloud storage platform and schedule a demo.",
        callIntro: "Hello! This is Alex from CloudTech Solutions. Am I speaking with [Name]?",
        callSignOff: "Excellent, I'll send over a calendar invite. Have a great day!",
        successCriteria: "User agrees to a demo or requests more information."
      },
      dataToCollect: [
        { text: "Ask if they are facing slow database queries.", itemType: "question", is_mandatory: true, weight: 50 },
        { text: "Ask if they are open to a 10-minute demo next week.", itemType: "question", is_mandatory: true, weight: 50 }
      ],
      rules: {
        fieldsToExtract: [
          { field: "interested_in_demo", type: "boolean", description: "Whether the user agreed to a demo" },
          { field: "pain_points", type: "string", description: "Any issues the user mentioned with their current setup" }
        ],
        scoringRules: [
          { field: "interested_in_demo", condition: "eq", value: true, score: 100, label: "Agreed to demo" }
        ]
      }
    },
    {
      name: "TechCorp Full Stack Developer Screening",
      type: "HR",
      module: {
        goal: "Screen candidates for the Full Stack Developer position.",
        callIntro: "Hello, this is the AI recruiter from TechCorp. Am I speaking with [Name]?",
        callSignOff: "Thank you for your time! We will be in touch.",
        successCriteria: "Candidate answers experience and notice period questions."
      },
      dataToCollect: [
        { text: "Ask about their years of experience with React and Node.js.", itemType: "question", is_mandatory: true, weight: 60 },
        { text: "Ask about their current notice period.", itemType: "question", is_mandatory: true, weight: 40 }
      ],
      rules: {
        fieldsToExtract: [
          { field: "react_experience", type: "number", description: "Years of React experience" },
          { field: "node_experience", type: "number", description: "Years of Node experience" },
          { field: "notice_period", type: "string", description: "Candidate's notice period" }
        ],
        scoringRules: [
          { field: "react_experience", condition: "gte", value: 3, score: 50, label: "Strong React XP" },
          { field: "node_experience", condition: "gte", value: 2, score: 50, label: "Strong Node XP" }
        ]
      }
    },
    {
      name: "Springfield Elementary Parent Check-ins",
      type: "FEEDBACK",
      module: {
        goal: "Check in with parents regarding student progress or scheduling.",
        callIntro: "Hello, this is an automated call from Springfield Elementary. Am I speaking with the parent of [Name]?",
        callSignOff: "Thank you and have a good day.",
        successCriteria: "Message is delivered and parent responds appropriately."
      },
      dataToCollect: [
        { text: "Deliver the main reason for the call (meeting, good news, or absence check).", itemType: "information", is_mandatory: true, weight: 100 }
      ],
      rules: {
        fieldsToExtract: [
          { field: "parent_response", type: "string", description: "How the parent responded to the information" },
          { field: "action_item", type: "string", description: "Any action item agreed upon (e.g., meeting time, doctor note)" }
        ],
        scoringRules: [
          { field: "action_item", condition: "contains", value: "time", score: 100, label: "Meeting Scheduled" }
        ]
      }
    },
    {
      name: "Ocean Bank Satisfaction Survey",
      type: "FEEDBACK",
      module: {
        goal: "Conduct a brief customer satisfaction survey.",
        callIntro: "Hello! This is a quick customer satisfaction survey from Ocean Bank. Am I speaking with [Name]?",
        callSignOff: "Thank you for your feedback, have a great day!",
        successCriteria: "User provides a rating and qualitative feedback."
      },
      dataToCollect: [
        { text: "Ask for a rating from 1 to 10 on the mobile app.", itemType: "question", is_mandatory: true, weight: 50 },
        { text: "Ask for one feature they would like improved.", itemType: "question", is_mandatory: true, weight: 50 }
      ],
      rules: {
        fieldsToExtract: [
          { field: "satisfaction_rating", type: "number", description: "The 1-10 rating provided by the user" },
          { field: "feature_request", type: "string", description: "Feature the user wants improved" }
        ],
        scoringRules: [
          { field: "satisfaction_rating", condition: "gte", value: 8, score: 100, label: "Promoter" },
          { field: "satisfaction_rating", condition: "gte", value: 5, score: 50, label: "Passive" }
        ]
      }
    }
  ];

  for (const config of campaignConfigs) {
    console.log(`\nCreating campaign: ${config.name}`);

    // Create CallModule
    const callModule = await prisma.callModule.create({
      data: {
        name: config.name + " Module",
        goal: config.module.goal,
        callIntro: config.module.callIntro,
        callSignOff: config.module.callSignOff,
        successCriteria: config.module.successCriteria,
        tenantId: tenant.id
      }
    });

    // Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: config.name,
        type: config.type,
        dataToCollect: config.dataToCollect,
        rules: config.rules,
        tenantId: tenant.id,
        callModuleId: callModule.id
      }
    });

    // Create 20 Contacts and CallLogs
    const typeKey = config.name.includes('Survey') ? 'SURVEY' : config.name.includes('Parent') ? 'PARENT_TEACHER' : config.type;

    for (let i = 1; i <= 20; i++) {
      const contactName = `Dummy Contact ${i} (${typeKey})`;
      const contact = await prisma.contact.create({
        data: {
          name: contactName,
          phone: `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
          tenantId: tenant.id
        }
      });

      await prisma.campaignContact.create({
        data: {
          campaignId: campaign.id,
          contactId: contact.id
        }
      });

      const transcript = generateTranscripts(typeKey, contactName);

      const statuses = ["completed", "completed", "completed", "completed", "no-answer", "failed"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const callLog = await prisma.callLog.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          campaignId: campaign.id,
          status: status,
          transcript: status === 'completed' ? transcript : null,
          durationMs: status === 'completed' ? Math.floor(Math.random() * 120000) + 30000 : 0
        }
      });

      // Queue ALL calls for evaluation (so failed calls appear in the Campaign Report)
      try {
        const { Queue } = await import('bullmq');
        const reportIngestQueue = new Queue('report.ingest', {
          connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379') }
        });
        await reportIngestQueue.add('CALL_COMPLETED', {
          callLogId: callLog.id,
          campaignId: campaign.id,
          tenantId: tenant.id,
          contactName: contact.name,
          transcript: status === 'completed' ? transcript : null,
          campaignName: campaign.name,
          dataToCollect: campaign.dataToCollect,
          fieldsToExtract: campaign.rules.fieldsToExtract,
          scoringRules: campaign.rules.scoringRules,
          successConditions: campaign.rules.successConditions
        });
      } catch(e) {
        console.error("Failed to queue to BullMQ:", e);
      }
    }
    console.log(`Created 20 calls for ${config.name}`);
  }

  console.log("\nSeed script finished successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
