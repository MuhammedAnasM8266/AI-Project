require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── JSON CLEANER (🔥 NEW FIX) ─────────────────────────────────────────────
function cleanJSON(raw) {
  return raw
    .replace(/```json|```/g, "")
    .replace(/[\u0000-\u001F]+/g, " ") // remove control chars
    .replace(/\n/g, "\\n")             // escape newlines
    .replace(/\r/g, "")
    .trim();
}

// ─── Business keyword filter ───────────────────────────────────────────────
const BUSINESS_KEYWORDS = [
  "startup","business","market","revenue","product","idea","investment",
  "marketing","growth","monetize","profit","customer","client","brand",
  "strategy","launch","niche","competitor","funding","investor","pitch",
  "saas","b2b","b2c","sales","valuation","equity","mvp","scale","traction",
  "acquisition","retention","conversion","cac","ltv","roi","kpi","vc",
  "entrepreneur","venture","capital","bootstrapping","runway","burn",
  "ecommerce","app","platform","service","model","plan","analysis",
  "opportunity","segment","positioning","differentiation","pricing",
  "distribution","partnership","supply","demand","trend","industry",
  "sector","workflow","automation","digital","tech","innovation","solution",
  "problem","pain point","value proposition","competitive","advantage"
];

function isBusinessQuery(text) {
  const lower = text.toLowerCase();
  return BUSINESS_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Helper: call AI ───────────────────────────────────────────────────────
async function callAI(systemPrompt, userMessage) {
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

  if (OPENROUTER_KEY) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://ai-startup-lab.onrender.com",
        "X-Title": "AI Startup Lab",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" }, // 🔥 FIX
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    const data = await res.json();

    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }

    throw new Error(data.error?.message || "OpenRouter error");
  }

  throw new Error("No API key configured. Add OPENROUTER_API_KEY to .env");
}

// ─── System prompts ────────────────────────────────────────────────────────
const EVAL_SYSTEM = `You are an elite AI Startup Advisor inside "AI Startup Lab".
ONLY answer business-related queries. Reject everything else.

For every startup idea, respond with ONLY this JSON (no markdown, no extra text):
{
  "score": <0-100 integer>,
  "market_demand": { "level": "Low|Medium|High", "reason": "..." },
  "competition": { "level": "Low|Medium|High", "reason": "..." },
  "target_audience": "...",
  "revenue_model": "...",
  "risks": ["risk1","risk2","risk3"],
  "suggestions": ["tip1","tip2","tip3"],
  "one_liner": "A one-sentence punchy pitch for this idea"
}
Be brutally honest, data-driven, and specific. No fluff.`;

// (Other SYSTEM prompts unchanged...)

const IMPROVE_SYSTEM = `You are a startup idea optimizer inside "AI Startup Lab".
Respond with ONLY this JSON:
{
  "improved_idea": "...",
  "niche": "...",
  "differentiation": "...",
  "positioning": "...",
  "new_features": ["feature1","feature2","feature3"],
  "target_market": "..."
}`;

const ROADMAP_SYSTEM = `You are a startup execution strategist inside "AI Startup Lab".
Respond with ONLY this JSON:
{
  "week1": ["task1","task2","task3","task4","task5"],
  "month1": ["milestone1","milestone2","milestone3","milestone4"],
  "quarter1": ["goal1","goal2","goal3"],
  "kpis": ["kpi1","kpi2","kpi3"],
  "first_revenue_tip": "..."
}`;

const INVESTOR_SYSTEM = `You are a VC investor inside "AI Startup Lab".
Respond with ONLY this JSON:
{
  "decision": "Yes|No|Maybe",
  "verdict": "...",
  "biggest_risk": "...",
  "required_improvements": ["imp1","imp2","imp3"],
  "estimated_valuation": "...",
  "investment_amount": "...",
  "exit_strategy": "..."
}`;

const CHAT_SYSTEM = `You are a business advisor chatbot.

Be FLEXIBLE in understanding user intent.

Treat queries like:
- "startup idea"
- "tell me startup idea"
- "business ideas"
- "earn money ideas"

as VALID business queries.

Only reject if clearly unrelated (e.g. jokes, movies, random chat).

If NOT business-related:
{"rejected": true, "message": "❌ Business queries only."}

If asking for ideas or lists:
{"answer": "Give a clear, well-formatted numbered list with line breaks."}

Otherwise:
{"answer": "Give a clear, helpful business answer."}
`;

const SWOT_SYSTEM = `You are a business analyst inside "AI Startup Lab".
Respond with ONLY this JSON:
{
  "strengths": ["s1","s2","s3"],
  "weaknesses": ["w1","w2","w3"],
  "opportunities": ["o1","o2","o3"],
  "threats": ["t1","t2","t3"],
  "summary": "..."
}`;

// ─── Routes ────────────────────────────────────────────────────────────────

app.post("/api/evaluate", async (req, res) => {
  const { idea } = req.body;
  if (!idea) return res.status(400).json({ error: "No idea provided" });
  if (!isBusinessQuery(idea))
    return res.status(403).json({
      error: "❌ Not a business idea.",
    });

  try {
    const raw = await callAI(EVAL_SYSTEM, `Evaluate: ${idea}`);
    const clean = cleanJSON(raw);

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (err) {
      return res.status(500).json({ error: "Invalid JSON", raw: clean });
    }

    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// (Repeat same pattern for all routes)

app.post("/api/improve", async (req, res) => {
  const { idea } = req.body;
  if (!idea) return res.status(400).json({ error: "No idea provided" });

  try {
    const raw = await callAI(IMPROVE_SYSTEM, idea);
    const clean = cleanJSON(raw);

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: "Invalid JSON", raw: clean });
    }

    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



app.post("/api/roadmap", async (req, res) => {
  const { idea } = req.body;
  if (!idea) return res.status(400).json({ error: "No idea provided" });

  try {
      const raw = await callAI(ROADMAP_SYSTEM, idea);
    const clean = cleanJSON(raw);
    
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: "Invalid JSON", raw: clean });
    }

    res.json(parsed);
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});


app.post("/api/swot", async (req, res) => {
  const { idea } = req.body;
  if (!idea) return res.status(400).json({ error: "No idea provided" });
  
  try {
      const raw = await callAI(SWOT_SYSTEM, idea);
      const clean = cleanJSON(raw);
      
      let parsed;
      try {
          parsed = JSON.parse(clean);
    } catch {
        return res.status(500).json({ error: "Invalid JSON", raw: clean });
    }
    
    res.json(parsed);
} catch (e) {
    res.status(500).json({ error: e.message });
}
});


app.post("/api/investor", async (req, res) => {
    const { idea } = req.body;
    if (!idea) return res.status(400).json({ error: "No idea provided" });
    
  try {
    const raw = await callAI(INVESTOR_SYSTEM, idea);
    const clean = cleanJSON(raw);

    let parsed;
    try {
        parsed = JSON.parse(clean);
    } catch {
        return res.status(500).json({ error: "Invalid JSON", raw: clean });
    }
    
    res.json(parsed);
} catch (e) {
    res.status(500).json({ error: e.message });
}
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided" });

  

  try {
    const raw = await callAI(CHAT_SYSTEM, message);
    const clean = cleanJSON(raw);

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: "Invalid JSON", raw: clean });
    }

    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});
// ─── Catch-all ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () =>
  console.log(`🚀 AI Startup Lab running on port ${PORT}`)
);