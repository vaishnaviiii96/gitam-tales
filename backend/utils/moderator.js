const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

console.log('GROQ KEY LOADED:', process.env.GROQ_API_KEY ? 'YES - starts with ' + process.env.GROQ_API_KEY.substring(0, 6) : 'NO - MISSING');

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

    // Strip HTML tags from description before sending to Groq
    const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    try {
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `You are a content moderation system for a university student portfolio platform called GitamTales.
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
                },
                {
                    role: 'user',
                    content: `Moderate this ${context}: "${cleanText}"`
                }
            ],
            temperature: 0,
            max_tokens: 60
        });

        const raw = response.choices[0]?.message?.content?.trim();
        const result = JSON.parse(raw);

        return {
            allowed: result.allowed === true,
            reason: result.reason || 'This content was flagged as inappropriate.'
        };

    } catch (err) {
        console.error('Moderation error:', err.message);
        // If Groq fails, allow through so a temporary API issue
        // doesn't break the platform
        return { allowed: true, reason: null };
    }
}

// Keep backwards compatibility — comments still work as before
async function moderateComment(text) {
    return moderate(text, 'comment');
}

module.exports = { moderate, moderateComment };
