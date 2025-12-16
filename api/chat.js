// api/chat.js  (CommonJS for Vercel serverless functions)
async function readJson(req) {
  return new Promise((resolve, reject) => {
    try {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => resolve(body ? JSON.parse(body) : {}));
    } catch (e) { reject(e); }
  });
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages = [], maxTurns = 14 } = await readJson(req);

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY on server' });
    }

    const systemPrompt = `
You are a supportive interview practice coach for high school students, running a 5–7 minute activity with ~10–15 interactions. Follow two phases:

PHASE 1 — STRENGTH DISCOVERY
- Start warm, reduce nervousness.
- If student struggles, gently guide: teamwork, problem-solving, communication, organization, adaptability, creativity, learning quickly.
- Encourage 1–2 strengths in their own words with a short example from school, sports, volunteering, or home.

PHASE 2 — MOCK INTERVIEW (stay in character as a real interviewer)
- Ask 4–5 questions like:
  1) What are your greatest strengths? (Parenthetical hint: (Try to include a brief example.))
  2) How would you use that strength in a workplace setting?
  3) Tell me about a challenge you faced and how your strength helped you.
  4) Why does this strength make you a valuable employee?
- Keep hints subtle and in parentheses. Stay concise; keep the pace.

CLOSING — FEEDBACK & OUTPUT
- Provide a short final summary with scores (1–5) on: Clarity, Specificity, Transferability, Confidence.
- Give 1–2 encouraging positives and 1–2 improvement suggestions.
- Provide 1–2 resume-ready lines tailored to the strengths they discussed.
- Keep tone encouraging, professional, and age-appropriate.

CONSTRAINTS
- Keep total interactions around ${maxTurns}.
- Avoid long monologues. Ask one focused question at a time.
- If student goes off track, kindly steer back.
    `.trim();

    const trimmed = messages.slice(-30);

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...trimmed
      ],
      temperature: 0.7,
    };

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await oaiRes.text();
    if (!oaiRes.ok) {
      // Surface OpenAI errors to help debugging
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(500).json({ error: "OpenAI error", details: text });
    }

    const data = JSON.parse(text);
    const reply = data?.choices?.[0]?.message?.content ?? "(No response)";

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).json({ reply });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: String(err) });
  }
};
