// ============ WORKDAY MULTI-PAGE HANDLERS v3.0 ============
// Complete handlers for all Workday application pages with AI-powered autofill
// Kimi K2 API integration for intelligent screening question answers
// Saved responses memory for instant autofill on repeat questions

(function() {
  'use strict';

  // ============ KIMI K2 API CONFIGURATION ============
  const KimiK2API = {
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'kimi-k2-0711-preview',
    timeout: 15000,
    
    async call(systemPrompt, userPrompt, apiKey) {
      if (!apiKey) {
        console.warn('[KimiK2] No API key provided, using pattern matching fallback');
        return null;
      }
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 150
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Kimi K2 API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
      } catch (e) {
        console.error('[KimiK2] API call failed:', e.message);
        return null;
      }
    }
  };

  // ============ OPENAI API FALLBACK ============
  const OpenAIAPI = {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    timeout: 20000,
    
    async call(systemPrompt, userPrompt, apiKey) {
      if (!apiKey) return null;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 150
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
      } catch (e) {
        console.error('[OpenAI] API call failed:', e.message);
        return null;
      }
    }
  };

  // ============ SAVED RESPONSES MEMORY ============
  const SavedResponses = {
    cache: {},
    
    async load() {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['saved_responses'], resolve);
      });
      this.cache = result.saved_responses || {};
      return this.cache;
    },
    
    async save(questionKey, answer, source = 'ai') {
      const normalized = this.normalizeQuestion(questionKey);
      this.cache[normalized] = {
        answer,
        source, // 'ai', 'pattern', 'manual'
        timestamp: Date.now(),
        useCount: (this.cache[normalized]?.useCount || 0) + 1
      };
      await chrome.storage.local.set({ saved_responses: this.cache });
      console.log('[Workday] Saved response for:', normalized.substring(0, 50));
    },
    
    find(questionText) {
      const normalized = this.normalizeQuestion(questionText);
      
      // Try exact match first
      if (this.cache[normalized]?.answer) {
        this.cache[normalized].useCount = (this.cache[normalized].useCount || 0) + 1;
        chrome.storage.local.set({ saved_responses: this.cache });
        return this.cache[normalized].answer;
      }
      
      // Try fuzzy match (similarity > 0.8)
      for (const [key, data] of Object.entries(this.cache)) {
        if (this.similarity(normalized, key) > 0.8) {
          data.useCount = (data.useCount || 0) + 1;
          chrome.storage.local.set({ saved_responses: this.cache });
          return data.answer;
        }
      }
      
      return null;
    },
    
    normalizeQuestion(text) {
      return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
    },
    
    similarity(a, b) {
      const wordsA = a.split(' ');
      const wordsB = b.split(' ');
      const intersection = wordsA.filter(w => wordsB.includes(w));
      return intersection.length / Math.max(wordsA.length, wordsB.length);
    },
    
    async getAll() {
      await this.load();
      return this.cache;
    },
    
    async getCount() {
      await this.load();
      return Object.keys(this.cache).length;
    },
    
    async clear() {
      this.cache = {};
      await chrome.storage.local.remove(['saved_responses']);
    }
  };

  // ============ KIMI K2 AUTOFILL ENGINE ============
  const KimiAutofillEngine = {
    provider: 'kimi',
    kimiKey: '',
    openaiKey: '',
    
    async init() {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['ai_provider', 'kimi_api_key', 'openai_api_key'], resolve);
      });
      this.provider = result.ai_provider || 'kimi';
      this.kimiKey = result.kimi_api_key || '';
      this.openaiKey = result.openai_api_key || '';
    },
    
    /**
     * Generate intelligent answer for screening question
     * Uses Kimi K2 as primary, OpenAI as fallback, pattern matching as last resort
     */
    async generateAnswer(question, options = [], profile = {}) {
      await this.init();
      
      const systemPrompt = `You are an expert job application assistant. Generate the BEST possible answer to screening questions that will:
1. Pass knockout filters (always answer positively for work authorisation, availability, etc.)
2. Impress recruiters and hiring managers
3. Be truthful but optimised for success
4. Be concise (1-2 sentences max for text, single word/phrase for dropdowns)

User Profile Context:
- Name: ${profile.firstName || 'Applicant'} ${profile.lastName || ''}
- Location: ${profile.city || 'Flexible'}
- Experience: ${profile.yearsExperience || '5+'} years
- Work Authorisation: Authorised to work (no sponsorship needed)
- Available to start: Immediately or within 2 weeks
- Willing to relocate: Yes

For YES/NO or multiple choice, always choose the option that maximises chances of passing to the next stage.
For salary questions, give a reasonable range based on the role.
For availability, always indicate immediate or flexible availability.`;

      const userPrompt = options.length > 0
        ? `Question: "${question}"\nOptions: ${options.join(', ')}\n\nChoose the BEST option that will pass the screening. Return ONLY the exact option text.`
        : `Question: "${question}"\n\nProvide a concise, professional answer (1-2 sentences max) that will impress recruiters.`;

      let answer = null;
      let source = 'pattern';
      
      // Try AI providers first
      if (this.provider === 'kimi' && this.kimiKey) {
        answer = await KimiK2API.call(systemPrompt, userPrompt, this.kimiKey);
        if (answer) source = 'kimi';
      }
      
      if (!answer && this.provider === 'openai' && this.openaiKey) {
        answer = await OpenAIAPI.call(systemPrompt, userPrompt, this.openaiKey);
        if (answer) source = 'openai';
      }
      
      // Fallback to pattern matching
      if (!answer) {
        answer = this.patternMatch(question, options);
        source = 'pattern';
      }
      
      if (answer) {
        console.log(`[KimiAutofill] Generated answer (${source}):`, answer.substring(0, 50));
      }
      
      return { answer, source };
    },
    
    patternMatch(question, options = []) {
      const q = question.toLowerCase();
      
      // Work authorisation - ALWAYS answer positively
      if (q.includes('authoriz') || q.includes('authoris') || q.includes('work in') || q.includes('eligible') || q.includes('legally')) {
        if (options.length > 0) {
          const yesOption = options.find(o => /^yes\b/i.test(o) || /authoriz/i.test(o) || /authoris/i.test(o));
          if (yesOption) return yesOption;
        }
        return 'Yes, I am authorised to work without sponsorship.';
      }
      
      // Sponsorship - ALWAYS say no sponsorship needed
      if (q.includes('sponsorship') || q.includes('visa')) {
        if (options.length > 0) {
          const noOption = options.find(o => /^no\b/i.test(o) || /do not require/i.test(o));
          if (noOption) return noOption;
        }
        return 'No, I do not require sponsorship.';
      }
      
      // Relocation
      if (q.includes('relocate') || q.includes('relocation')) {
        if (options.length > 0) {
          const yesOption = options.find(o => /^yes\b/i.test(o));
          if (yesOption) return yesOption;
        }
        return 'Yes';
      }
      
      // Availability / Start date
      if (q.includes('start') || q.includes('available') || q.includes('begin') || q.includes('notice')) {
        if (options.length > 0) {
          const immediateOption = options.find(o => /immediate/i.test(o) || /2 week/i.test(o) || /two week/i.test(o));
          if (immediateOption) return immediateOption;
        }
        return 'I can start within 2 weeks or immediately if needed.';
      }
      
      // Remote/hybrid/onsite
      if (q.includes('remote') || q.includes('hybrid') || q.includes('onsite') || q.includes('on-site') || q.includes('work arrangement')) {
        if (options.length > 0) {
          const flexOption = options.find(o => /flexible/i.test(o) || /any/i.test(o) || /hybrid/i.test(o));
          if (flexOption) return flexOption;
        }
        return 'Flexible - comfortable with any arrangement';
      }
      
      // Years of experience
      if (q.includes('years') && (q.includes('experience') || q.includes('exp'))) {
        const match = q.match(/(\d+)\+?\s*(?:years|yrs)/);
        if (match) {
          const required = parseInt(match[1]);
          // Always meet or exceed the requirement
          return `${Math.max(required, 5)}+`;
        }
        if (options.length > 0) {
          // Pick the highest reasonable option
          const sortedOptions = options.sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numB - numA;
          });
          return sortedOptions[0];
        }
        return '5+';
      }
      
      // Salary
      if (q.includes('salary') || q.includes('compensation') || q.includes('pay') || q.includes('expectation')) {
        return 'Negotiable based on total compensation package';
      }
      
      // Education
      if (q.includes('degree') || q.includes('education') || q.includes('qualification')) {
        if (options.length > 0) {
          const bachelorOption = options.find(o => /bachelor/i.test(o) || /master/i.test(o) || /degree/i.test(o));
          if (bachelorOption) return bachelorOption;
        }
        return "Bachelor's Degree";
      }
      
      // Criminal/background
      if (q.includes('criminal') || q.includes('felony') || q.includes('conviction') || q.includes('background')) {
        if (options.length > 0) {
          const noOption = options.find(o => /^no\b/i.test(o));
          if (noOption) return noOption;
        }
        return 'No';
      }
      
      // Referral / How did you hear
      if (q.includes('referr') || q.includes('how did you hear') || q.includes('source') || q.includes('find out')) {
        if (options.length > 0) {
          const linkedinOption = options.find(o => /linkedin/i.test(o) || /job board/i.test(o));
          if (linkedinOption) return linkedinOption;
        }
        return 'LinkedIn';
      }
      
      // Gender (EEO)
      if (q.includes('gender') || q.includes('sex')) {
        if (options.length > 0) {
          const declineOption = options.find(o => /prefer not/i.test(o) || /decline/i.test(o) || /do not wish/i.test(o));
          if (declineOption) return declineOption;
        }
        return 'Prefer not to say';
      }
      
      // Race/Ethnicity (EEO)
      if (q.includes('race') || q.includes('ethnic') || q.includes('origin')) {
        if (options.length > 0) {
          const declineOption = options.find(o => /prefer not/i.test(o) || /decline/i.test(o) || /two or more/i.test(o));
          if (declineOption) return declineOption;
        }
        return 'Prefer not to answer';
      }
      
      // Veteran status
      if (q.includes('veteran') || q.includes('military') || q.includes('armed forces')) {
        if (options.length > 0) {
          const notVeteranOption = options.find(o => /not a/i.test(o) || /no,?\s*i am not/i.test(o) || /prefer not/i.test(o));
          if (notVeteranOption) return notVeteranOption;
        }
        return 'I am not a protected veteran';
      }
      
      // Disability
      if (q.includes('disability') || q.includes('disabilities') || q.includes('disabled')) {
        if (options.length > 0) {
          const declineOption = options.find(o => /do not wish/i.test(o) || /prefer not/i.test(o) || /decline/i.test(o));
          if (declineOption) return declineOption;
        }
        return 'I do not wish to answer';
      }
      
      // Age / Over 18
      if (q.includes('over 18') || q.includes('at least 18') || q.includes('age')) {
        return 'Yes';
      }
      
      // Driving licence
      if (q.includes('driv') && (q.includes('licen') || q.includes('license'))) {
        return 'Yes';
      }
      
      // Cover letter
      if (q.includes('cover letter') || q.includes('why') && (q.includes('role') || q.includes('position') || q.includes('company'))) {
        return 'I am excited about this opportunity as it aligns perfectly with my skills and career goals. My experience in this field makes me a strong candidate for this role.';
      }
      
      // Default for unknown questions - return null to let AI handle it
      return null;
    },
    
    async getUserProfile() {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['ats_profile', 'ats_session'], resolve);
      });
      return result.ats_profile || {};
    }
  };

  // ============ WORKDAY PAGE HANDLERS ============
  const WorkdayPages = {
    
    // ============ DETECT PAGE TYPE ============
    detectPageType() {
      const body = document.body.textContent?.toLowerCase() || '';
      const url = window.location.href.toLowerCase();
      const automationIds = [...document.querySelectorAll('[data-automation-id]')].map(el => el.getAttribute('data-automation-id')).join(' ');
      
      // Contact Information / My Information
      if (body.includes('my information') || body.includes('contact information') || 
          document.querySelector('[data-automation-id="email"]') || 
          document.querySelector('[data-automation-id="legalNameSection_firstName"]')) {
        return 'contact';
      }
      
      // My Experience / Work History
      if (body.includes('my experience') || body.includes('work history') || body.includes('employment history') ||
          document.querySelector('[data-automation-id="jobTitle"]') || 
          document.querySelector('[data-automation-id="previousEmployer"]')) {
        return 'experience';
      }
      
      // Voluntary Self-Identification / Voluntary Disclosures
      if (body.includes('voluntary self-identification') || body.includes('voluntary disclosures') ||
          body.includes('invitation to self-identify')) {
        return 'voluntary';
      }
      
      // EEO Self-Identification
      if (body.includes('self-identification') && (body.includes('eeo') || body.includes('equal employment'))) {
        return 'self-id';
      }
      
      // Application Questions
      if (body.includes('application questions') || body.includes('questionnaire') ||
          document.querySelectorAll('[data-automation-id*="question"]').length > 2) {
        return 'questions';
      }
      
      // Review and Submit
      if (body.includes('review') && (body.includes('submit') || document.querySelector('[data-automation-id="bottom-navigation-submit-button"]'))) {
        return 'review';
      }
      
      // Resume/CV Upload
      if (body.includes('resume') || body.includes('cv') || body.includes('upload') ||
          document.querySelector('[data-automation-id="file-upload-drop-zone"]')) {
        return 'resume';
      }
      
      return 'unknown';
    },
    
    // ============ CONTACT INFO PAGE ============
    async handleContactInfo(profile) {
      console.log('[Workday] Handling Contact Information page');
      
      const fieldMappings = {
        // Name fields
        'legalNameSection_firstName': profile.firstName || profile.first_name,
        'legalNameSection_lastName': profile.lastName || profile.last_name,
        'legalNameSection_middleName': profile.middleName || '',
        // Contact fields
        'email': profile.email,
        'phone': profile.phone,
        'phoneNumber': profile.phone,
        // Address fields
        'addressSection_countryRegion': profile.country || 'Ireland',
        'addressSection_addressLine1': profile.address || '',
        'addressSection_city': profile.city || 'Dublin',
        'addressSection_postalCode': profile.zipCode || profile.zip_code || '',
        'addressSection_region': profile.state || '',
        // Source
        'source': 'LinkedIn',
        'sourcePrompt': 'LinkedIn'
      };
      
      let filledCount = 0;
      
      for (const [automationId, value] of Object.entries(fieldMappings)) {
        if (!value) continue;
        
        // Try data-automation-id first
        let element = document.querySelector(`[data-automation-id="${automationId}"]`);
        
        // Try name attribute
        if (!element) {
          element = document.querySelector(`[name*="${automationId}"]`);
        }
        
        // Try id attribute
        if (!element) {
          element = document.querySelector(`#${automationId}`);
        }
        
        if (element) {
          const filled = await this.fillElement(element, value);
          if (filled) filledCount++;
        }
      }
      
      // Handle phone type dropdown
      await this.fillDropdown('phoneDeviceType', 'Mobile');
      
      // Handle phone country code
      await this.fillDropdown('phoneCountry', 'Ireland (+353)');
      
      console.log(`[Workday] Filled ${filledCount} contact fields`);
      return filledCount > 0;
    },
    
    // ============ MY EXPERIENCE PAGE ============
    async handleMyExperience(profile) {
      console.log('[Workday] Handling My Experience page');
      
      const workExperience = profile.work_experience || profile.workExperience || [];
      let filledCount = 0;
      
      // Fill first work experience if available
      if (workExperience.length > 0) {
        const job = workExperience[0];
        
        const expFields = {
          'jobTitle': job.title || job.jobTitle,
          'employer': job.company || job.employer,
          'location': job.location,
          'startDate': job.startDate || job.start_date,
          'endDate': job.endDate || job.end_date || 'Present',
          'workDescription': job.description
        };
        
        for (const [field, value] of Object.entries(expFields)) {
          if (!value) continue;
          const element = document.querySelector(`[data-automation-id*="${field}"]`);
          if (element) {
            await this.fillElement(element, value);
            filledCount++;
          }
        }
      }
      
      console.log(`[Workday] Filled ${filledCount} experience fields`);
      return filledCount > 0;
    },
    
    // ============ VOLUNTARY DISCLOSURES PAGE ============
    async handleVoluntaryDisclosures(profile) {
      console.log('[Workday] Handling Voluntary Disclosures page');
      
      let filledCount = 0;
      
      // Gender
      filledCount += await this.fillFieldByPattern(/gender/i, profile.gender || 'Prefer not to say', [
        'Prefer not to say', 'Decline to identify', 'I do not wish to answer'
      ]);
      
      // Ethnicity
      filledCount += await this.fillFieldByPattern(/race|ethnic|origin/i, profile.ethnicity || 'Prefer not to answer', [
        'Two or more races', 'Prefer not to answer', 'Decline to self-identify'
      ]);
      
      // Veteran status
      filledCount += await this.fillFieldByPattern(/veteran/i, 'I am not a protected veteran', [
        'I am not a protected veteran', 'No', 'Prefer not to answer'
      ]);
      
      // Disability status
      filledCount += await this.fillFieldByPattern(/disability/i, 'I do not wish to answer', [
        'I do not wish to answer', 'Prefer not to answer', 'No'
      ]);
      
      // Handle consent checkboxes - always check them
      const consentCheckboxes = document.querySelectorAll('input[type="checkbox"]');
      for (const cb of consentCheckboxes) {
        const labelText = this.getLabelText(cb).toLowerCase();
        if (labelText.includes('consent') || labelText.includes('agree') || labelText.includes('certify') || labelText.includes('acknowledge')) {
          if (!cb.checked) {
            cb.click();
            filledCount++;
          }
        }
      }
      
      console.log(`[Workday] Filled ${filledCount} voluntary disclosure fields`);
      return filledCount > 0;
    },
    
    // ============ SELF-IDENTIFICATION PAGE ============
    async handleSelfIdentification(profile) {
      console.log('[Workday] Handling Self-Identification page');
      
      let filledCount = 0;
      
      // EEO Categories with preferred answers
      const eeoCategories = [
        { pattern: /gender|sex/i, preferred: ['Prefer not to say', 'Decline to identify', 'I do not wish to answer'] },
        { pattern: /race|ethnic|origin/i, preferred: ['Two or more races (Not Hispanic or Latino)', 'Prefer not to answer', 'Decline to self-identify'] },
        { pattern: /veteran/i, preferred: ['I am not a protected veteran', 'No', 'Prefer not to answer'] },
        { pattern: /disability|disabilities/i, preferred: ['I do not wish to answer', 'Prefer not to answer', 'No, I do not have a disability'] },
        { pattern: /hispanic|latino/i, preferred: ['No', 'Prefer not to answer', 'Decline'] }
      ];
      
      // Find all form groups/sections
      const formGroups = document.querySelectorAll('[data-automation-id], fieldset, [class*="formGroup"], [class*="question"]');
      
      for (const group of formGroups) {
        const labelText = this.getGroupLabelText(group);
        
        for (const category of eeoCategories) {
          if (category.pattern.test(labelText)) {
            const filled = await this.fillGroupWithPreferred(group, category.preferred);
            if (filled) filledCount++;
          }
        }
      }
      
      console.log(`[Workday] Filled ${filledCount} self-identification fields`);
      return filledCount > 0;
    },
    
    // ============ APPLICATION QUESTIONS PAGE (AI-POWERED) ============
    async handleApplicationQuestions(profile) {
      console.log('[Workday] Handling Application Questions page with AI');
      await SavedResponses.load();
      
      let filledCount = 0;
      let aiCalledCount = 0;
      let cachedCount = 0;
      
      // Find all question containers
      const questionContainers = document.querySelectorAll('[data-automation-id*="question"], [class*="question"], fieldset, [role="group"]');
      
      for (const container of questionContainers) {
        const questionText = this.extractQuestionText(container);
        if (!questionText || questionText.length < 10) continue;
        
        // Skip if already filled
        if (this.isContainerFilled(container)) continue;
        
        let answer = null;
        let source = 'none';
        
        // Step 1: Check saved responses first (instant)
        answer = SavedResponses.find(questionText);
        if (answer) {
          source = 'cached';
          cachedCount++;
        }
        
        // Step 2: Try AI if no cached answer
        if (!answer) {
          const options = this.extractOptions(container);
          const result = await KimiAutofillEngine.generateAnswer(questionText, options, profile);
          answer = result.answer;
          source = result.source;
          
          if (source === 'kimi' || source === 'openai') {
            aiCalledCount++;
          }
          
          // Save for future use
          if (answer) {
            await SavedResponses.save(questionText, answer, source);
          }
        }
        
        // Step 3: Fill the answer
        if (answer) {
          const filled = await this.fillQuestionAnswer(container, answer);
          if (filled) filledCount++;
        }
      }
      
      console.log(`[Workday] Filled ${filledCount} questions (${cachedCount} cached, ${aiCalledCount} AI-generated)`);
      return filledCount > 0;
    },
    
    // ============ REVIEW PAGE ============
    async handleReview() {
      console.log('[Workday] Handling Review page');
      
      // Check for any required field errors
      const errors = document.querySelectorAll('[data-automation-id="errorMessage"], .error-message, [class*="error"]:not([class*="noError"])');
      const visibleErrors = [...errors].filter(e => e.offsetParent !== null && e.textContent.trim());
      
      if (visibleErrors.length > 0) {
        console.log('[Workday] Found errors on review page:', visibleErrors.length);
        return false;
      }
      
      // All good - ready for submit
      console.log('[Workday] Review page ready for submission');
      return true;
    },
    
    // ============ RESUME UPLOAD PAGE ============
    async handleResumeUpload() {
      console.log('[Workday] Handling Resume Upload page');
      // This is handled by the file-attacher-turbo.js module
      return true;
    },
    
    // ============ HELPER: FILL FIELD BY PATTERN ============
    async fillFieldByPattern(pattern, defaultValue, preferredOptions = []) {
      const formGroups = document.querySelectorAll('[data-automation-id], fieldset, [class*="formGroup"]');
      let filled = 0;
      
      for (const group of formGroups) {
        const labelText = this.getGroupLabelText(group);
        
        if (pattern.test(labelText)) {
          const result = await this.fillGroupWithPreferred(group, [defaultValue, ...preferredOptions]);
          if (result) filled++;
        }
      }
      
      return filled;
    },
    
    // ============ HELPER: FILL GROUP WITH PREFERRED OPTIONS ============
    async fillGroupWithPreferred(group, preferredOptions) {
      // Try select dropdown first
      const select = group.querySelector('select');
      if (select) {
        for (const pref of preferredOptions) {
          const filled = await this.selectOption(select, pref);
          if (filled) return true;
        }
      }
      
      // Try radio buttons
      const radios = group.querySelectorAll('input[type="radio"]');
      for (const radio of radios) {
        const radioLabel = this.getLabelText(radio).toLowerCase();
        for (const pref of preferredOptions) {
          if (radioLabel.includes(pref.toLowerCase())) {
            radio.click();
            this.fireEvents(radio);
            return true;
          }
        }
      }
      
      // Try Workday custom dropdown
      const customDropdown = group.querySelector('[role="listbox"], [data-automation-id*="dropdown"]');
      if (customDropdown) {
        for (const pref of preferredOptions) {
          const filled = await this.fillWorkdayDropdown(customDropdown, pref);
          if (filled) return true;
        }
      }
      
      return false;
    },
    
    // ============ HELPER: EXTRACT QUESTION TEXT ============
    extractQuestionText(container) {
      // Try multiple selectors for question text
      const selectors = ['label', 'legend', '[class*="label"]', '[class*="question"]', 'p:first-of-type'];
      
      for (const selector of selectors) {
        const element = container.querySelector(selector);
        if (element?.textContent?.trim()) {
          return element.textContent.trim().substring(0, 500);
        }
      }
      
      // Fallback to container text (limited)
      return (container.textContent || '').substring(0, 200).trim();
    },
    
    // ============ HELPER: EXTRACT OPTIONS ============
    extractOptions(container) {
      const options = [];
      
      // Select options
      const select = container.querySelector('select');
      if (select) {
        Array.from(select.options).forEach(opt => {
          if (opt.value && opt.text && opt.text !== 'Select' && opt.text !== '--') {
            options.push(opt.text.trim());
          }
        });
      }
      
      // Radio/checkbox labels
      const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      inputs.forEach(input => {
        const label = this.getLabelText(input);
        if (label) options.push(label.trim());
      });
      
      // Workday custom dropdown options
      const listboxOptions = container.querySelectorAll('[role="option"]');
      listboxOptions.forEach(opt => {
        if (opt.textContent?.trim()) {
          options.push(opt.textContent.trim());
        }
      });
      
      return [...new Set(options)]; // Deduplicate
    },
    
    // ============ HELPER: CHECK IF CONTAINER IS FILLED ============
    isContainerFilled(container) {
      // Check text inputs
      const textInputs = container.querySelectorAll('input[type="text"], textarea');
      for (const input of textInputs) {
        if (input.value?.trim()) return true;
      }
      
      // Check select
      const select = container.querySelector('select');
      if (select && select.value && select.value !== '' && select.selectedIndex > 0) return true;
      
      // Check radio/checkbox
      const checked = container.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
      if (checked) return true;
      
      return false;
    },
    
    // ============ HELPER: FILL QUESTION ANSWER ============
    async fillQuestionAnswer(container, answer) {
      // Text input
      const textInput = container.querySelector('input[type="text"], input:not([type]), textarea');
      if (textInput && !textInput.value?.trim()) {
        textInput.focus();
        textInput.value = answer;
        this.fireEvents(textInput);
        return true;
      }
      
      // Select dropdown
      const select = container.querySelector('select');
      if (select && select.selectedIndex <= 0) {
        const filled = await this.selectOption(select, answer);
        if (filled) return true;
      }
      
      // Radio buttons
      const radios = container.querySelectorAll('input[type="radio"]');
      for (const radio of radios) {
        const label = this.getLabelText(radio).toLowerCase();
        const answerLower = answer.toLowerCase();
        if (label.includes(answerLower) || answerLower.includes(label) || label === answerLower) {
          radio.click();
          this.fireEvents(radio);
          return true;
        }
      }
      
      // Checkboxes (for "Select all that apply")
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      for (const cb of checkboxes) {
        const label = this.getLabelText(cb).toLowerCase();
        if (answer.toLowerCase().includes(label) || label.includes(answer.toLowerCase())) {
          if (!cb.checked) {
            cb.click();
            this.fireEvents(cb);
          }
          return true;
        }
      }
      
      // Workday custom dropdown
      const customDropdown = container.querySelector('[role="listbox"], [data-automation-id*="dropdown"]');
      if (customDropdown) {
        return await this.fillWorkdayDropdown(customDropdown, answer);
      }
      
      return false;
    },
    
    // ============ HELPER: FILL ELEMENT ============
    async fillElement(element, value) {
      if (!element || !value) return false;
      
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.focus();
        element.value = value;
        this.fireEvents(element);
        return true;
      }
      
      if (element.tagName === 'SELECT') {
        return this.selectOption(element, value);
      }
      
      // Workday custom dropdown
      if (element.getAttribute('role') === 'listbox' || element.getAttribute('role') === 'combobox') {
        return this.fillWorkdayDropdown(element, value);
      }
      
      return false;
    },
    
    // ============ HELPER: SELECT OPTION ============
    async selectOption(select, value) {
      if (!select || !value) return false;
      
      const valueLower = value.toLowerCase().trim();
      const options = Array.from(select.options);
      
      // Exact match first
      let match = options.find(opt => opt.text.toLowerCase().trim() === valueLower);
      
      // Partial match - value contains option or option contains value
      if (!match) {
        match = options.find(opt => {
          const optText = opt.text.toLowerCase().trim();
          return optText.includes(valueLower) || valueLower.includes(optText);
        });
      }
      
      if (match) {
        select.value = match.value;
        this.fireEvents(select);
        return true;
      }
      
      return false;
    },
    
    // ============ HELPER: FILL WORKDAY DROPDOWN ============
    async fillWorkdayDropdown(container, value) {
      // Click to open dropdown
      const trigger = container.querySelector('[data-automation-id*="dropdown"], [role="combobox"], button, [data-automation-id*="multiselect"]');
      if (trigger) {
        trigger.click();
        await new Promise(r => setTimeout(r, 200));
        
        // Find and click matching option
        const options = document.querySelectorAll('[role="option"], [data-automation-id*="option"], [class*="option"]');
        for (const opt of options) {
          const optText = opt.textContent?.toLowerCase()?.trim() || '';
          const valueLower = value.toLowerCase().trim();
          if (optText.includes(valueLower) || valueLower.includes(optText)) {
            opt.click();
            await new Promise(r => setTimeout(r, 100));
            return true;
          }
        }
        
        // Close dropdown if no match
        trigger.click();
      }
      return false;
    },
    
    // ============ HELPER: FILL DROPDOWN BY ID ============
    async fillDropdown(automationId, value) {
      const dropdown = document.querySelector(`[data-automation-id="${automationId}"]`);
      if (dropdown) {
        return this.fillElement(dropdown, value);
      }
      return false;
    },
    
    // ============ HELPER: GET LABEL TEXT ============
    getLabelText(element) {
      // Try labels property first
      if (element.labels?.[0]?.textContent) {
        return element.labels[0].textContent.trim();
      }
      
      // Try aria-label
      if (element.getAttribute('aria-label')) {
        return element.getAttribute('aria-label');
      }
      
      // Try previous sibling label
      const prevLabel = element.previousElementSibling;
      if (prevLabel?.tagName === 'LABEL') {
        return prevLabel.textContent.trim();
      }
      
      // Try parent label
      const parentLabel = element.closest('label');
      if (parentLabel) {
        return parentLabel.textContent.trim();
      }
      
      return '';
    },
    
    // ============ HELPER: GET GROUP LABEL TEXT ============
    getGroupLabelText(group) {
      const label = group.querySelector('label, legend, [class*="label"]');
      return (label?.textContent || group.textContent || '').substring(0, 300).toLowerCase();
    },
    
    // ============ HELPER: FIRE EVENTS ============
    fireEvents(element) {
      ['focus', 'input', 'change', 'blur'].forEach(type => {
        element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      });
      
      // Also fire React-specific events
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter && element.value) {
        nativeInputValueSetter.call(element, element.value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  // ============ AUTOMATIC AUTOFILL CONTROLLER ============
  const AutofillController = {
    enabled: true,
    hasRun: false,
    profile: {},
    
    async init() {
      // Load settings
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['autofill_enabled', 'ats_profile'], resolve);
      });
      
      this.enabled = result.autofill_enabled !== false; // Default to enabled
      this.profile = result.ats_profile || {};
      
      console.log('[AutofillController] Initialised, enabled:', this.enabled);
      
      // Run autofill if enabled and on supported page
      if (this.enabled && !this.hasRun) {
        await this.detectAndFill();
      }
      
      // Set up observer for page changes (SPA navigation)
      this.observePageChanges();
    },
    
    async detectAndFill() {
      const url = window.location.href.toLowerCase();
      
      // Only run on Workday pages
      if (!url.includes('workday') && !url.includes('myworkdayjobs')) {
        return;
      }
      
      // Wait for page to be ready
      await new Promise(r => setTimeout(r, 1000));
      
      const pageType = WorkdayPages.detectPageType();
      console.log('[AutofillController] Detected Workday page type:', pageType);
      
      if (pageType === 'unknown') return;
      
      this.hasRun = true;
      
      switch (pageType) {
        case 'contact':
          await WorkdayPages.handleContactInfo(this.profile);
          break;
        case 'experience':
          await WorkdayPages.handleMyExperience(this.profile);
          break;
        case 'voluntary':
          await WorkdayPages.handleVoluntaryDisclosures(this.profile);
          break;
        case 'self-id':
          await WorkdayPages.handleSelfIdentification(this.profile);
          break;
        case 'questions':
          await WorkdayPages.handleApplicationQuestions(this.profile);
          break;
        case 'review':
          await WorkdayPages.handleReview();
          break;
        case 'resume':
          await WorkdayPages.handleResumeUpload();
          break;
      }
    },
    
    observePageChanges() {
      // Use MutationObserver to detect SPA navigation
      const observer = new MutationObserver(async (mutations) => {
        // Check if significant DOM change occurred
        const significantChange = mutations.some(m => 
          m.addedNodes.length > 5 || 
          m.removedNodes.length > 5 ||
          m.target.matches?.('[data-automation-id]')
        );
        
        if (significantChange && this.enabled) {
          // Reset hasRun to allow re-fill on page change
          this.hasRun = false;
          await new Promise(r => setTimeout(r, 500));
          await this.detectAndFill();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    },
    
    async toggle(enabled) {
      this.enabled = enabled;
      await chrome.storage.local.set({ autofill_enabled: enabled });
      console.log('[AutofillController] Toggled to:', enabled);
      
      if (enabled && !this.hasRun) {
        this.hasRun = false;
        await this.detectAndFill();
      }
    },
    
    async runManual() {
      console.log('[AutofillController] Running manual autofill');
      this.hasRun = false;
      await this.detectAndFill();
    }
  };

  // ============ EXPOSE GLOBALLY ============
  window.WorkdayPages = WorkdayPages;
  window.SavedResponses = SavedResponses;
  window.KimiAutofillEngine = KimiAutofillEngine;
  window.KimiK2API = KimiK2API;
  window.OpenAIAPI = OpenAIAPI;
  window.AutofillController = AutofillController;

  // ============ AUTO-INITIALISE ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AutofillController.init());
  } else {
    setTimeout(() => AutofillController.init(), 500);
  }

  console.log('[Workday Handlers v3.0] Loaded with Kimi K2 API integration');
})();
