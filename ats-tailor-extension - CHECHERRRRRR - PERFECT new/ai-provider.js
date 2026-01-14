// ai-provider.js - Unified AI Abstraction Layer v2.0
// Supports Kimi K2 (primary) and OpenAI (fallback) with model-specific optimisations
// Dual Model Support with intelligent routing and caching

(function(global) {
  'use strict';

  console.log('[AI Provider] Unified AI Abstraction Layer v2.0 loaded');

  // ============ CONFIGURATION ============
  const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';

  // Provider configurations
  const PROVIDERS = {
    kimi: {
      name: 'Kimi K2',
      endpoint: `${SUPABASE_URL}/functions/v1/extract-keywords-ai`,
      model: 'kimi-k2',
      maxTokens: 4096,
      temperature: 0.3, // Lower for more deterministic results
      timeout: 15000,   // 15s timeout (Kimi is faster)
      retries: 3,
      baseDelay: 300,
      priority: 1,      // Primary provider
      features: {
        streaming: true,
        structuredOutput: true,
        fastExtraction: true
      }
    },
    openai: {
      name: 'OpenAI GPT-4o-mini',
      endpoint: `${SUPABASE_URL}/functions/v1/extract-keywords-ai`,
      model: 'gpt-4o-mini',
      maxTokens: 4096,
      temperature: 0.6,
      timeout: 25000,   // 25s timeout
      retries: 4,
      baseDelay: 500,
      priority: 2,      // Fallback provider
      features: {
        streaming: true,
        structuredOutput: true,
        fastExtraction: false
      }
    }
  };

  // Response cache for performance
  const responseCache = new Map();
  const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  // ============ AI PROVIDER CLASS ============
  const AIProvider = {
    currentProvider: 'kimi', // Default to Kimi K2
    providerStats: {
      kimi: { calls: 0, successes: 0, failures: 0, avgLatency: 0 },
      openai: { calls: 0, successes: 0, failures: 0, avgLatency: 0 }
    },

    // ============ PROVIDER MANAGEMENT ============
    
    /**
     * Get current active provider
     */
    getProvider() {
      return this.currentProvider;
    },

    /**
     * Set active provider
     * @param {string} provider - 'kimi' or 'openai'
     */
    setProvider(provider) {
      if (PROVIDERS[provider]) {
        this.currentProvider = provider;
        console.log(`[AI Provider] Switched to ${PROVIDERS[provider].name}`);
        
        // Persist preference
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({ ai_provider: provider });
        }
        
        return true;
      }
      return false;
    },

    /**
     * Load saved provider preference
     */
    async loadProviderPreference() {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get(['ai_provider'], (result) => {
            if (result.ai_provider && PROVIDERS[result.ai_provider]) {
              this.currentProvider = result.ai_provider;
            }
            resolve(this.currentProvider);
          });
        } else {
          resolve(this.currentProvider);
        }
      });
    },

    /**
     * Get provider configuration
     */
    getProviderConfig(provider = null) {
      return PROVIDERS[provider || this.currentProvider];
    },

    /**
     * Get all available providers
     */
    getAvailableProviders() {
      return Object.entries(PROVIDERS).map(([key, config]) => ({
        id: key,
        name: config.name,
        isPrimary: config.priority === 1,
        features: config.features
      }));
    },

    /**
     * Get provider stats
     */
    getStats() {
      return this.providerStats;
    },

    // ============ CACHE MANAGEMENT ============

    /**
     * Generate cache key from request parameters
     */
    _generateCacheKey(operation, params) {
      const hash = JSON.stringify({ operation, ...params });
      return btoa(hash).substring(0, 64);
    },

    /**
     * Get cached response
     */
    _getCached(key) {
      const cached = responseCache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log('[AI Provider] Cache hit');
        return cached.data;
      }
      responseCache.delete(key);
      return null;
    },

    /**
     * Set cached response
     */
    _setCache(key, data) {
      responseCache.set(key, { data, timestamp: Date.now() });
      
      // Limit cache size
      if (responseCache.size > 100) {
        const oldest = responseCache.keys().next().value;
        responseCache.delete(oldest);
      }
    },

    /**
     * Clear all cache
     */
    clearCache() {
      responseCache.clear();
      console.log('[AI Provider] Cache cleared');
    },

    // ============ API CALLS ============

    /**
     * Make API call with retry logic and exponential backoff
     */
    async _callWithRetry(operation, payload, options = {}) {
      const provider = options.provider || this.currentProvider;
      const config = PROVIDERS[provider];
      
      if (!config) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const startTime = performance.now();
      let lastError = null;

      for (let attempt = 0; attempt < config.retries; attempt++) {
        try {
          this.providerStats[provider].calls++;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), config.timeout);

          const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${options.accessToken || SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              ...payload,
              provider: provider,
              model: config.model,
              temperature: config.temperature,
              max_tokens: config.maxTokens
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          
          // Update stats
          const latency = performance.now() - startTime;
          this.providerStats[provider].successes++;
          this.providerStats[provider].avgLatency = 
            (this.providerStats[provider].avgLatency * (this.providerStats[provider].successes - 1) + latency) / 
            this.providerStats[provider].successes;

          return data;

        } catch (error) {
          lastError = error;
          this.providerStats[provider].failures++;
          
          console.warn(`[AI Provider] ${config.name} attempt ${attempt + 1}/${config.retries} failed:`, error.message);
          
          // Don't retry on abort
          if (error.name === 'AbortError') {
            throw new Error(`${config.name} request timed out after ${config.timeout}ms`);
          }

          // Wait before retry with exponential backoff
          if (attempt < config.retries - 1) {
            const delay = config.baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Try fallback provider if primary fails
      if (provider === 'kimi' && options.allowFallback !== false) {
        console.log('[AI Provider] Kimi failed, falling back to OpenAI');
        return this._callWithRetry(operation, payload, { ...options, provider: 'openai', allowFallback: false });
      }

      throw lastError || new Error(`${config.name} request failed after ${config.retries} attempts`);
    },

    // ============ KEYWORD EXTRACTION ============

    /**
     * Extract keywords from job description
     * Optimised for Kimi K2's faster processing
     */
    async extractKeywords(jobDescription, options = {}) {
      if (!jobDescription || jobDescription.length < 50) {
        return { highPriority: [], mediumPriority: [], lowPriority: [], all: [], total: 0 };
      }

      // Check cache first
      const cacheKey = this._generateCacheKey('keywords', { jd: jobDescription.substring(0, 500) });
      const cached = this._getCached(cacheKey);
      if (cached && !options.skipCache) {
        return cached;
      }

      // Truncate long descriptions
      const truncatedJD = jobDescription.substring(0, 8000);

      const payload = {
        operation: 'extract_keywords',
        jobDescription: truncatedJD,
        maxKeywords: options.maxKeywords || 30,
        includeContext: options.includeContext !== false
      };

      try {
        const response = await this._callWithRetry('extract_keywords', payload, options);
        
        // Normalise response format
        const result = this._normaliseKeywordResponse(response);
        
        // Cache successful response
        this._setCache(cacheKey, result);
        
        return result;
      } catch (error) {
        console.error('[AI Provider] Keyword extraction failed:', error);
        
        // Return local extraction as ultimate fallback
        return this._localKeywordExtraction(truncatedJD);
      }
    },

    /**
     * Normalise keyword response to consistent format
     */
    _normaliseKeywordResponse(response) {
      // Handle various response formats
      if (response.keywords) {
        return {
          highPriority: response.keywords.high || response.keywords.required_skills || [],
          mediumPriority: response.keywords.medium || response.keywords.preferred_skills || [],
          lowPriority: response.keywords.low || response.keywords.nice_to_have || [],
          all: response.keywords.all || [
            ...(response.keywords.high || response.keywords.required_skills || []),
            ...(response.keywords.medium || response.keywords.preferred_skills || []),
            ...(response.keywords.low || response.keywords.nice_to_have || [])
          ],
          total: response.keywords.total || 0,
          context: response.keywords.context || {},
          responsibilities: response.keywords.responsibilities || []
        };
      }

      // Handle flat array response
      if (Array.isArray(response)) {
        const high = response.slice(0, Math.ceil(response.length * 0.4));
        const med = response.slice(high.length, high.length + Math.ceil(response.length * 0.35));
        const low = response.slice(high.length + med.length);
        
        return {
          highPriority: high,
          mediumPriority: med,
          lowPriority: low,
          all: response,
          total: response.length
        };
      }

      // Handle already normalised response
      if (response.highPriority || response.all) {
        return {
          highPriority: response.highPriority || [],
          mediumPriority: response.mediumPriority || [],
          lowPriority: response.lowPriority || [],
          all: response.all || [...(response.highPriority || []), ...(response.mediumPriority || []), ...(response.lowPriority || [])],
          total: response.total || (response.all?.length || 0)
        };
      }

      return { highPriority: [], mediumPriority: [], lowPriority: [], all: [], total: 0 };
    },

    /**
     * Fast local keyword extraction (fallback)
     */
    _localKeywordExtraction(text) {
      const techKeywords = new Set([
        'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php',
        'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'rails',
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd',
        'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'graphql',
        'machine learning', 'deep learning', 'nlp', 'computer vision', 'tensorflow', 'pytorch',
        'agile', 'scrum', 'kanban', 'jira', 'git', 'github', 'gitlab', 'bitbucket',
        'api', 'rest', 'microservices', 'serverless', 'cloud', 'devops', 'sre',
        'frontend', 'backend', 'full-stack', 'mobile', 'ios', 'android', 'flutter', 'react native'
      ]);

      const words = text.toLowerCase().match(/\b[\w\.\+\#]+\b/g) || [];
      const matches = new Set();
      
      words.forEach(word => {
        if (techKeywords.has(word) || word.length > 3) {
          // Check for tech patterns
          if (/^[a-z]+\.(js|py|rb|go|rs|ts)$/.test(word) ||
              /^[a-z]+-[a-z]+$/.test(word) ||
              techKeywords.has(word)) {
            matches.add(word);
          }
        }
      });

      // Extract years of experience patterns
      const expPatterns = text.match(/\d+\+?\s*years?\s*(of\s+)?experience/gi) || [];
      
      // Extract degree requirements
      const degreePatterns = text.match(/\b(bachelor'?s?|master'?s?|phd|doctorate)\s+(degree|in\s+\w+)/gi) || [];

      const all = [...matches].slice(0, 30);
      const high = all.slice(0, 12);
      const med = all.slice(12, 22);
      const low = all.slice(22);

      return {
        highPriority: high,
        mediumPriority: med,
        lowPriority: low,
        all,
        total: all.length,
        experiencePatterns: expPatterns,
        degreePatterns: degreePatterns
      };
    },

    // ============ COVER LETTER GENERATION ============

    /**
     * Generate tailored cover letter
     */
    async generateCoverLetter(params) {
      const { jobTitle, company, jobDescription, candidateData, keywords } = params;

      const payload = {
        operation: 'generate_cover_letter',
        jobTitle,
        company,
        jobDescription: jobDescription?.substring(0, 4000),
        candidateName: candidateData?.firstName ? `${candidateData.firstName} ${candidateData.lastName || ''}` : 'Candidate',
        candidateExperience: candidateData?.workExperience || [],
        candidateSkills: candidateData?.skills || [],
        keywords: keywords?.highPriority || keywords?.all || []
      };

      try {
        const response = await this._callWithRetry('generate_cover_letter', payload);
        return response.coverLetter || response.content || response;
      } catch (error) {
        console.error('[AI Provider] Cover letter generation failed:', error);
        return this._generateFallbackCoverLetter(params);
      }
    },

    /**
     * Generate fallback cover letter template
     */
    _generateFallbackCoverLetter(params) {
      const { jobTitle, company, candidateData, keywords } = params;
      const name = candidateData?.firstName ? `${candidateData.firstName} ${candidateData.lastName || ''}` : 'Candidate';
      const topSkills = (keywords?.highPriority || keywords?.all || []).slice(0, 5).join(', ');
      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      return `${date}

${company || 'Hiring Manager'}

Re: ${jobTitle || 'Position'}

Dear Hiring Committee,

I am writing to express my strong interest in the ${jobTitle || 'position'} at ${company || 'your organisation'}. With my background in ${topSkills || 'software development'}, I am confident in my ability to contribute meaningfully to your team.

Throughout my career, I have consistently delivered results in demanding environments, leveraging my technical expertise and collaborative approach to solve complex challenges. My experience aligns well with the requirements outlined in your job posting.

I am particularly drawn to ${company || 'your organisation'}'s commitment to innovation and would welcome the opportunity to bring my skills and enthusiasm to your team.

Thank you for considering my application. I look forward to discussing how I can contribute to your continued success.

Yours sincerely,

${name}`;
    },

    // ============ ANSWER GENERATION (Knockout Questions) ============

    /**
     * Generate optimal answers for ATS knockout questions
     */
    async answerQuestion(question, options = {}) {
      const { candidateData, jobContext, questionType } = options;

      const payload = {
        operation: 'answer_question',
        question,
        questionType: questionType || this._detectQuestionType(question),
        candidateData: {
          yearsExperience: candidateData?.yearsExperience || 5,
          skills: candidateData?.skills || [],
          workAuthorisation: candidateData?.workAuthorisation || 'authorized',
          willingToRelocate: candidateData?.willingToRelocate !== false,
          education: candidateData?.education || [],
          currentSalary: candidateData?.currentSalary,
          expectedSalary: candidateData?.expectedSalary
        },
        jobContext
      };

      try {
        const response = await this._callWithRetry('answer_question', payload);
        return {
          answer: response.answer || response.content,
          confidence: response.confidence || 0.8,
          reasoning: response.reasoning
        };
      } catch (error) {
        console.error('[AI Provider] Answer generation failed:', error);
        return this._generateFallbackAnswer(question, options);
      }
    },

    /**
     * Detect question type for better answer generation
     */
    _detectQuestionType(question) {
      const q = question.toLowerCase();
      
      if (q.includes('authorization') || q.includes('authorisation') || q.includes('visa') || q.includes('work permit') || q.includes('eligible to work')) {
        return 'work_authorization';
      }
      if (q.includes('years') && q.includes('experience')) {
        return 'experience_years';
      }
      if (q.includes('salary') || q.includes('compensation') || q.includes('pay')) {
        return 'salary';
      }
      if (q.includes('relocate') || q.includes('location') || q.includes('willing to move')) {
        return 'relocation';
      }
      if (q.includes('education') || q.includes('degree') || q.includes('bachelor') || q.includes('master')) {
        return 'education';
      }
      if (q.includes('start') && (q.includes('date') || q.includes('when'))) {
        return 'start_date';
      }
      if (q.includes('notice period')) {
        return 'notice_period';
      }
      if (q.includes('why') && (q.includes('company') || q.includes('position') || q.includes('role'))) {
        return 'motivation';
      }
      
      return 'general';
    },

    /**
     * Generate fallback answer for common questions
     */
    _generateFallbackAnswer(question, options = {}) {
      const { candidateData } = options;
      const questionType = this._detectQuestionType(question);

      switch (questionType) {
        case 'work_authorization':
          return { answer: 'Yes', confidence: 0.9 };
        case 'experience_years':
          return { answer: String(candidateData?.yearsExperience || 5), confidence: 0.85 };
        case 'salary':
          return { answer: candidateData?.expectedSalary || 'Negotiable based on total compensation package', confidence: 0.7 };
        case 'relocation':
          return { answer: 'Yes', confidence: 0.85 };
        case 'education':
          return { answer: 'Yes', confidence: 0.8 };
        case 'start_date':
          return { answer: 'Within 2-4 weeks, subject to notice period', confidence: 0.8 };
        case 'notice_period':
          return { answer: candidateData?.noticePeriod || '2 weeks', confidence: 0.85 };
        case 'motivation':
          return { 
            answer: 'I am excited about this opportunity to contribute my skills and grow with your team.',
            confidence: 0.7 
          };
        default:
          return { answer: 'Yes', confidence: 0.6 };
      }
    },

    // ============ BATCH OPERATIONS ============

    /**
     * Batch extract keywords for multiple job descriptions
     */
    async batchExtractKeywords(jobDescriptions, options = {}) {
      const results = await Promise.allSettled(
        jobDescriptions.map(jd => this.extractKeywords(jd, options))
      );

      return results.map((result, index) => ({
        index,
        success: result.status === 'fulfilled',
        keywords: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
      }));
    },

    /**
     * Batch answer multiple questions
     */
    async batchAnswerQuestions(questions, options = {}) {
      const results = await Promise.allSettled(
        questions.map(q => this.answerQuestion(q.question || q, { ...options, questionType: q.type }))
      );

      return results.map((result, index) => ({
        index,
        question: questions[index].question || questions[index],
        success: result.status === 'fulfilled',
        answer: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
      }));
    }
  };

  // Initialise provider preference on load
  AIProvider.loadProviderPreference();

  // Export to global scope
  global.AIProvider = AIProvider;

  // Also export as module if supported
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIProvider;
  }

})(typeof window !== 'undefined' ? window : this);
