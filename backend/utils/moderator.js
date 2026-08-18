// Gemini API (Google AI Studio free tier) — no SDK needed, uses native fetch

async function moderate(text, context = 'comment') {
    console.log('MODERATE CALLED - context:', context, 'text:', text?.substring(0, 50));
    if (!text || text.trim().length === 0) {
        return { allowed: false, reason: 'This field cannot be empty.' };
    }

    if (text.trim().length < 2) {
        return { allowed: false, reason: 'This is too short.' };
    }

    const limits = {
        comment:     { max: 500,  label: 'Comment' },
        title:       { max: 150,  label: 'Title' },
        description: { max: 5000, label: 'Description' },
        tags:        { max: 200,  label: 'Tags' }
    };

    const limit = limits[context] || limits.comment;
    if (text.length > limit.max) {
        return { allowed: false, reason: `${limit.label} is too long. Maximum ${limit.max} characters.` };
    }

    // Strip HTML tags from description before sending to Gemini
    const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{
                            text: `You are a content moderation system for a university student portfolio platform called GitamTales.
Your job is to decide if the submitted content is appropriate for a professional academic platform.

Reject content that contains:
- Abusive language, slurs, or hate speech in ANY language (English, Hindi, Telugu, Tamil, etc.)
- Threats or violent language
- Sexual or explicit content
- Harassment or bullying
- Spam or gibberish with no meaning
- Highly offensive or inappropriate content for a university setting

Allow content that is:
- Academic or professional in nature
- Genuine project descriptions, achievements, reflections
- Constructive feedback or appreciation
- Normal student conversation

You are moderating a ${context}. Be appropriately lenient for descriptions (they can be long and detailed) but strict for obvious abuse.

Respond ONLY with a JSON object in this exact format, nothing else:
{"allowed": true}
OR
{"allowed": false, "reason": "one sentence explanation for the user"}`
                        }]
                    },
                    contents: [{
                        role: 'user',
                        parts: [{ text: `Moderate this ${context}: "${cleanText}"` }]
                    }],
                    generationConfig: {
                        temperature: 0,
                        maxOutputTokens: 150
                    }
                })
            }
        );

        // Surface HTTP-level errors (400 bad key, 429 rate limit, 500 server error, etc.)
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            console.error('[Moderator] Gemini HTTP error:', res.status, res.statusText, JSON.stringify(errBody));
            throw new Error(`Gemini responded with ${res.status}: ${errBody?.error?.message || res.statusText}`);
        }

        const data = await res.json();

        // Debug: log full response so issues are visible in server logs
        console.log('[Moderator] Gemini raw response:', JSON.stringify(data));

        const raw = data.candidates[0]?.content?.parts[0]?.text?.trim();
        if (!raw) {
            console.error('[Moderator] No content in response. Full data:', JSON.stringify(data));
            throw new Error('Gemini returned no content in candidates[0].content.parts[0].text');
        }

        const result = JSON.parse(raw);

        return {
            allowed: result.allowed === true,
            reason: result.reason || 'This content was flagged as inappropriate.'
        };

    } catch (err) {
        // Log the full error — do NOT silently swallow it
        console.error('[Moderator] Error during moderation:', err.message);
        // Fail-open: allow content through so an API outage doesn't break the platform.
        // Remove this fallback and return { allowed: false } here if you prefer fail-closed.
        return { allowed: true, reason: null };
    }
}

// Keep backwards compatibility — comments still work as before
async function moderateComment(text) {
    return moderate(text, 'comment');
}

module.exports = { moderate, moderateComment };
