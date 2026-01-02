// ATS Tailor Pro - Background Service Worker
// Handles API calls, downloads, and extension lifecycle

console.log('[ATS Tailor Pro] Background service worker started');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[ATS Tailor Pro] Extension installed');
    // Set default settings
    chrome.storage.local.set({
      ats_mode: 'standalone', // 'standalone' or 'connected'
      ats_autoTailorEnabled: true,
      ats_stats: { today: 0, total: 0, avgTime: 0, times: [] }
    });
  } else if (details.reason === 'update') {
    console.log('[ATS Tailor Pro] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Encrypt API key for storage (basic obfuscation - not true encryption)
function obfuscateKey(key) {
  if (!key) return '';
  return btoa(key.split('').reverse().join(''));
}

function deobfuscateKey(obfuscated) {
  if (!obfuscated) return '';
  try {
    return atob(obfuscated).split('').reverse().join('');
  } catch {
    return '';
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'keepAlive') {
    sendResponse({ status: 'alive' });
    return true;
  }

  if (message.action === 'saveApiKey') {
    const obfuscated = obfuscateKey(message.apiKey);
    chrome.storage.local.set({ ats_openai_key: obfuscated }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'getApiKey') {
    chrome.storage.local.get(['ats_openai_key'], (result) => {
      const key = deobfuscateKey(result.ats_openai_key);
      sendResponse({ apiKey: key });
    });
    return true;
  }

  if (message.action === 'validateApiKey') {
    validateOpenAIKey(message.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ valid: false, error: error.message }));
    return true;
  }

  if (message.action === 'aiExtractKeywords') {
    extractKeywordsWithAI(message.jobDescription, message.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.action === 'tailorApplication') {
    tailorApplicationWithAI(message.data, message.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.action === 'downloadZip') {
    createAndDownloadZip(message.files)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.action === 'openPopup') {
    chrome.action.setBadgeText({ text: '⚙️' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    sendResponse({ status: 'badge_set' });
    return true;
  }

  if (message.action === 'clearBadge') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ status: 'badge_cleared' });
    return true;
  }
});

// Validate OpenAI API key
async function validateOpenAIKey(apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    if (response.ok) {
      return { valid: true };
    }

    const error = await response.json();
    return { valid: false, error: error.error?.message || 'Invalid API key' };
  } catch (error) {
    return { valid: false, error: error.message || 'Failed to validate' };
  }
}

// AI-powered keyword extraction using Resume-Matcher approach
async function extractKeywordsWithAI(jobDescription, apiKey) {
  if (!jobDescription || jobDescription.trim().length < 50) {
    throw new Error('Job description too short for analysis');
  }

  const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyst specializing in resume optimization and keyword extraction.

Your task is to analyze job descriptions and extract structured keywords that are critical for ATS matching.

Return ONLY valid JSON in this exact format:
{
  "required_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill1", "skill2"],
  "key_responsibilities": ["responsibility1", "responsibility2"],
  "technical_tools": ["tool1", "tool2"],
  "soft_skills": ["skill1", "skill2"],
  "certifications": ["cert1", "cert2"],
  "experience_level": "entry/mid/senior/lead/executive",
  "education_requirements": ["requirement1"],
  "industry_keywords": ["keyword1", "keyword2"],
  "action_verbs": ["verb1", "verb2"]
}

Rules:
- Extract exact phrases as they appear in the JD (case-insensitive matching is fine)
- required_skills: Technologies, languages, frameworks EXPLICITLY required
- preferred_skills: Skills mentioned as "nice to have", "preferred", "bonus"
- key_responsibilities: Main duties and expectations
- technical_tools: Specific software, platforms, systems mentioned
- soft_skills: Communication, leadership, teamwork abilities
- certifications: Any professional certifications mentioned
- experience_level: Infer from years required and seniority language
- education_requirements: Degree requirements
- industry_keywords: Domain-specific terms (fintech, healthcare, SaaS, etc.)
- action_verbs: Strong verbs used (design, implement, lead, optimize, etc.)`;

  const userPrompt = `Analyze this job description and extract ATS-critical keywords:

${jobDescription.substring(0, 8000)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    const keywords = JSON.parse(jsonMatch[0]);
    return { success: true, keywords };
  } catch (error) {
    console.error('[ATS Tailor Pro] AI extraction error:', error);
    throw error;
  }
}

// Full application tailoring with AI
async function tailorApplicationWithAI(data, apiKey) {
  const { jobInfo, userProfile, extractedKeywords } = data;

  // Calculate smart location
  const smartLocation = getSmartLocation(jobInfo.location, jobInfo.description, userProfile.city);

  // Get keyword analysis
  const keywords = extractedKeywords || extractLocalKeywords(jobInfo.description);

  const candidateName = `${userProfile.firstName} ${userProfile.lastName}`.trim();
  const candidateNameForFile = `${userProfile.firstName}_${userProfile.lastName}`.replace(/\s+/g, '_');

  const systemPrompt = `You are an ELITE ATS OPTIMIZATION SPECIALIST who creates perfectly tailored resumes and cover letters that achieve 95-100% keyword match scores while sounding completely human and natural.

CRITICAL RULES:
1. PRESERVE ALL COMPANY NAMES AND EXACT DATES - Only tailor bullet points
2. Location in CV header MUST be: "${smartLocation}"
3. NO typos, grammatical errors, or formatting issues
4. PROFESSIONAL SUMMARY must NOT repeat name, email, phone, or URLs
5. Start summary with qualifier: "Experienced", "Senior", "Accomplished", etc.

KEYWORD INTEGRATION:
- Weave keywords naturally into bullets and summary
- Each hard skill should appear 2-3 times
- Use specific metrics (%, $, users, time saved)

BANNED PHRASES: "results-driven", "dynamic", "cutting-edge", "passionate", "leverage", "synergy"

Return ONLY valid JSON - no markdown, no code blocks.`;

  const userPrompt = `Create an ATS-optimized application package.

=== TARGET JOB ===
Title: ${jobInfo.title}
Company: ${jobInfo.company}
Location: ${jobInfo.location || 'Not specified'} → CV Location: ${smartLocation}
Description: ${jobInfo.description?.substring(0, 4000)}

=== CANDIDATE ===
Name: ${candidateName}
Email: ${userProfile.email}
Phone: ${userProfile.phone}
LinkedIn: ${userProfile.linkedin || ''}
GitHub: ${userProfile.github || ''}
Portfolio: ${userProfile.portfolio || ''}

WORK EXPERIENCE:
${JSON.stringify(userProfile.workExperience || [], null, 2)}

EDUCATION:
${JSON.stringify(userProfile.education || [], null, 2)}

SKILLS:
${(userProfile.skills || []).map(s => typeof s === 'string' ? s : s.name).join(', ')}

CERTIFICATIONS:
${(userProfile.certifications || []).join(', ')}

ACHIEVEMENTS:
${JSON.stringify(userProfile.achievements || [], null, 2)}

=== KEYWORDS TO INTEGRATE ===
${JSON.stringify(keywords, null, 2)}

=== REQUIRED OUTPUT FORMAT ===
{
  "tailoredResume": "[Complete formatted resume text]",
  "tailoredCoverLetter": "[Complete cover letter text]",
  "matchScore": 85,
  "keywordsMatched": ["keyword1", "keyword2"],
  "keywordsMissing": ["keyword3"],
  "cvFileName": "${candidateNameForFile}_CV.pdf",
  "coverLetterFileName": "${candidateNameForFile}_Cover_Letter.pdf",
  "resumeStructured": {
    "personalInfo": {
      "name": "${candidateName}",
      "email": "${userProfile.email}",
      "phone": "${userProfile.phone}",
      "location": "${smartLocation}",
      "linkedin": "${userProfile.linkedin || ''}",
      "github": "${userProfile.github || ''}",
      "portfolio": "${userProfile.portfolio || ''}"
    },
    "summary": "[Professional summary without contact info]",
    "experience": [],
    "education": [],
    "skills": [],
    "certifications": []
  }
}`;

  // Retry logic
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`[ATS Tailor Pro] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          lastError = new Error('Rate limit exceeded');
          continue;
        }
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      // Generate PDFs (simple text-to-PDF for standalone mode)
      result.resumePdf = generateSimplePDF(result.tailoredResume, `${candidateName} - Resume`);
      result.coverLetterPdf = generateSimplePDF(result.tailoredCoverLetter, `${candidateName} - Cover Letter`);

      return { success: true, ...result };
    } catch (error) {
      lastError = error;
      console.error(`[ATS Tailor Pro] Attempt ${attempt + 1} failed:`, error);
    }
  }

  throw lastError || new Error('Failed after retries');
}

// Generate simple text-based PDF (base64)
function generateSimplePDF(text, title) {
  // Create a simple PDF structure
  // This is a minimal valid PDF that contains text
  const content = text.replace(/\n/g, '\\n').replace(/\r/g, '');
  
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${content.length + 100} >>
stream
BT
/F1 11 Tf
50 750 Td
14 TL
(${title}) Tj T*
() Tj T*
${text.split('\n').slice(0, 60).map(line => `(${line.replace(/[()\\]/g, '\\$&').substring(0, 80)}) Tj T*`).join('\n')}
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + content.length}
%%EOF`;

  return btoa(unescape(encodeURIComponent(pdf)));
}

// Smart location extraction
function getSmartLocation(jdLocation, jdDescription, profileCity) {
  const cityPatterns = [
    'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Seattle', 'Austin', 'Boston', 'Denver', 'Atlanta',
    'London', 'Manchester', 'Dublin', 'Berlin', 'Amsterdam', 'Paris', 'Toronto', 'Vancouver', 'Sydney', 'Singapore'
  ];

  // Check location field
  if (jdLocation) {
    for (const city of cityPatterns) {
      if (jdLocation.toLowerCase().includes(city.toLowerCase())) {
        return `${city} | open to relocation`;
      }
    }
    if (!/remote/i.test(jdLocation)) {
      return `${jdLocation.split(',')[0].trim()} | open to relocation`;
    }
  }

  // Check description
  if (jdDescription) {
    for (const city of cityPatterns) {
      if (jdDescription.toLowerCase().includes(city.toLowerCase())) {
        return `${city} | open to relocation`;
      }
    }
    if (/remote|worldwide|global/i.test(jdDescription)) {
      return profileCity ? `${profileCity} | Remote` : 'Remote | open to relocation';
    }
  }

  return profileCity ? `${profileCity} | open to relocation` : 'Remote | open to relocation';
}

// Local keyword extraction (fallback)
function extractLocalKeywords(description) {
  if (!description) return { required_skills: [], preferred_skills: [] };
  
  const text = description.toLowerCase();
  const skills = [];
  
  const patterns = [
    'python', 'javascript', 'typescript', 'react', 'angular', 'vue', 'node', 'java', 'c++', 'c#',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'sql', 'mongodb', 'postgresql',
    'machine learning', 'data science', 'agile', 'scrum', 'git', 'ci/cd'
  ];
  
  for (const pattern of patterns) {
    if (text.includes(pattern)) {
      skills.push(pattern);
    }
  }
  
  return { required_skills: skills, preferred_skills: [] };
}

// Create and download ZIP file
async function createAndDownloadZip(files) {
  // For Chrome extension, we'll download files individually
  // since we can't easily create ZIP without a library
  for (const file of files) {
    const blob = base64ToBlob(file.content, file.mimeType || 'application/pdf');
    const url = URL.createObjectURL(blob);
    
    await chrome.downloads.download({
      url: url,
      filename: file.name,
      saveAs: false
    });
  }
  
  return { success: true };
}

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
