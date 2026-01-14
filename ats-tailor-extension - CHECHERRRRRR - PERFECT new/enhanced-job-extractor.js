// enhanced-job-extractor.js - Multi-Platform Job Information Extractor v2.0
// Robust extraction from 70+ company career sites and ATS platforms
// Supports multi-page Workday, Greenhouse, Lever, and more

(function(global) {
  'use strict';

  console.log('[Enhanced Job Extractor] v2.0 loaded');

  // ============ TIER 1-2 COMPANY DOMAINS (70+ companies) ============
  const COMPANY_DOMAINS = new Map([
    // FAANG + Major Tech
    ['google.com', 'Google'], ['careers.google.com', 'Google'], ['about.google', 'Google'],
    ['meta.com', 'Meta'], ['metacareers.com', 'Meta'], ['facebook.com', 'Meta'],
    ['amazon.com', 'Amazon'], ['amazon.jobs', 'Amazon'], ['amazonjobs.com', 'Amazon'],
    ['microsoft.com', 'Microsoft'], ['careers.microsoft.com', 'Microsoft'],
    ['apple.com', 'Apple'], ['jobs.apple.com', 'Apple'],
    ['netflix.com', 'Netflix'], ['jobs.netflix.com', 'Netflix'],
    
    // Enterprise Software
    ['salesforce.com', 'Salesforce'], ['ibm.com', 'IBM'], ['oracle.com', 'Oracle'], 
    ['adobe.com', 'Adobe'], ['sap.com', 'SAP'], ['vmware.com', 'VMware'],
    ['servicenow.com', 'ServiceNow'], ['workday.com', 'Workday'],
    
    // Fintech & Payments
    ['stripe.com', 'Stripe'], ['paypal.com', 'PayPal'], ['visa.com', 'Visa'],
    ['mastercard.com', 'Mastercard'], ['block.xyz', 'Block'], ['sq.com', 'Square'],
    
    // SaaS & Cloud
    ['hubspot.com', 'HubSpot'], ['intercom.com', 'Intercom'], ['zendesk.com', 'Zendesk'],
    ['docusign.com', 'DocuSign'], ['twilio.com', 'Twilio'], ['slack.com', 'Slack'],
    ['atlassian.com', 'Atlassian'], ['gitlab.com', 'GitLab'], ['circleci.com', 'CircleCI'],
    ['datadoghq.com', 'Datadog'], ['unity.com', 'Unity'], ['udemy.com', 'Udemy'],
    
    // Social & Media
    ['linkedin.com', 'LinkedIn'], ['tiktok.com', 'TikTok'], ['bytedance.com', 'ByteDance'],
    ['snap.com', 'Snapchat'], ['dropbox.com', 'Dropbox'], ['bloomberg.com', 'Bloomberg'],
    ['spotify.com', 'Spotify'], ['twitter.com', 'X'], ['x.com', 'X'],
    
    // Hardware & Semiconductors
    ['intel.com', 'Intel'], ['broadcom.com', 'Broadcom'], ['arm.com', 'Arm Holdings'],
    ['tsmc.com', 'TSMC'], ['appliedmaterials.com', 'Applied Materials'], ['cisco.com', 'Cisco'],
    ['nvidia.com', 'NVIDIA'], ['amd.com', 'AMD'], ['qualcomm.com', 'Qualcomm'],
    
    // Finance & Consulting (Big 4)
    ['fidelity.com', 'Fidelity'], ['morganstanley.com', 'Morgan Stanley'],
    ['jpmorgan.com', 'JP Morgan Chase'], ['blackrock.com', 'BlackRock'],
    ['capitalone.com', 'Capital One'], ['tdsecurities.com', 'TD Securities'],
    ['kpmg.com', 'KPMG'], ['deloitte.com', 'Deloitte'], ['accenture.com', 'Accenture'],
    ['pwc.com', 'PwC'], ['ey.com', 'EY'], ['mckinsey.com', 'McKinsey'], ['kkr.com', 'KKR'],
    ['fenergo.com', 'Fenergo'], ['goldmansachs.com', 'Goldman Sachs'],
    
    // Quant & Trading Firms
    ['citadel.com', 'Citadel'], ['janestreet.com', 'Jane Street'], ['sig.com', 'SIG'],
    ['twosigma.com', 'Two Sigma'], ['deshaw.com', 'DE Shaw'], ['rentec.com', 'Renaissance Technologies'],
    ['mlp.com', 'Millennium Management'], ['virtu.com', 'Virtu Financial'],
    ['hudsontrading.com', 'Hudson River Trading'], ['jumptrading.com', 'Jump Trading'],
    
    // Other Major Tech
    ['tesla.com', 'Tesla'], ['uber.com', 'Uber'], ['airbnb.com', 'Airbnb'],
    ['palantir.com', 'Palantir'], ['crowdstrike.com', 'CrowdStrike'], ['snowflake.com', 'Snowflake'],
    ['intuit.com', 'Intuit'], ['toasttab.com', 'Toast'], ['workhuman.com', 'Workhuman'],
    ['draftkings.com', 'DraftKings'], ['walmart.com', 'Walmart'], ['roblox.com', 'Roblox'],
    ['doordash.com', 'DoorDash'], ['instacart.com', 'Instacart'], ['rivian.com', 'Rivian'],
    ['chime.com', 'Chime'], ['wasabi.com', 'Wasabi Technologies'], ['samsara.com', 'Samsara'],
    ['blockchain.com', 'Blockchain.com'], ['similarweb.com', 'Similarweb'],
    ['deepmind.google', 'Google DeepMind']
  ]);

  // ============ PLATFORM-SPECIFIC SELECTORS ============
  const PLATFORM_SELECTORS = {
    // HubSpot
    hubspot: {
      detect: () => location.hostname.includes('hubspot.com'),
      title: [
        'h1[data-testid="job-title"]',
        '.job-title h1',
        'h1.job-posting-title',
        '.careers-single-job h1',
        '[class*="JobTitle"] h1',
        'main h1'
      ],
      company: () => 'HubSpot',
      location: [
        '[data-testid="job-location"]',
        '.job-location',
        '[class*="location"]',
        '.job-meta span:contains("Location")'
      ],
      description: [
        '[data-testid="job-description"]',
        '.job-description',
        '.job-details',
        '[class*="JobDescription"]',
        'article.job-content',
        'main section'
      ]
    },

    // Lever
    lever: {
      detect: () => location.hostname.includes('lever.co') || location.hostname.includes('jobs.lever.co'),
      title: [
        '.posting-headline h2',
        '.posting-title',
        'h1.posting-headline',
        '[data-qa="posting-name"]'
      ],
      company: [
        '.main-header-logo img',
        '.posting-headline h1',
        '[data-qa="company-name"]'
      ],
      location: [
        '.posting-categories .sort-by-commitment',
        '.posting-categories .location',
        '[data-qa="posting-location"]'
      ],
      description: [
        '.posting-page .content',
        '.section-wrapper .content',
        '[data-qa="posting-description"]'
      ]
    },

    // Ashby
    ashby: {
      detect: () => location.hostname.includes('ashbyhq.com') || location.hostname.includes('jobs.ashbyhq.com'),
      title: [
        'h1[data-testid="job-name"]',
        '.ashby-job-posting-title',
        'h1.job-title'
      ],
      company: [
        '[data-testid="company-name"]',
        '.ashby-company-name'
      ],
      location: [
        '[data-testid="job-location"]',
        '.ashby-job-location'
      ],
      description: [
        '[data-testid="job-description"]',
        '.ashby-job-description'
      ]
    },

    // LinkedIn
    linkedin: {
      detect: () => location.hostname.includes('linkedin.com'),
      title: [
        '.job-details-jobs-unified-top-card__job-title h1',
        '.jobs-unified-top-card__job-title',
        '.topcard__title',
        'h1.top-card-layout__title',
        '.job-view-layout h1'
      ],
      company: [
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name a',
        '.topcard__org-name-link',
        'a.topcard__org-name-link'
      ],
      location: [
        '.job-details-jobs-unified-top-card__bullet',
        '.jobs-unified-top-card__bullet',
        '.topcard__flavor--bullet',
        '.job-details-jobs-unified-top-card__workplace-type'
      ],
      description: [
        '.jobs-description-content__text',
        '.jobs-box__html-content',
        '.description__text',
        '#job-details'
      ]
    },

    // Indeed
    indeed: {
      detect: () => location.hostname.includes('indeed.com'),
      title: [
        '.jobsearch-JobInfoHeader-title',
        'h1.jobTitle',
        '[data-testid="jobsearch-JobInfoHeader-title"]'
      ],
      company: [
        '.jobsearch-InlineCompanyRating-companyHeader a',
        '[data-testid="company-name"]',
        '.jobsearch-JobInfoHeader-companyName a'
      ],
      location: [
        '.jobsearch-JobInfoHeader-subtitle div:nth-child(2)',
        '[data-testid="job-location"]',
        '.jobsearch-JobMetadataHeader-item'
      ],
      description: [
        '#jobDescriptionText',
        '.jobsearch-jobDescriptionText',
        '[data-testid="jobsearch-jobDescription"]'
      ]
    },

    // Workday
    workday: {
      detect: () => location.hostname.includes('workday.com') || location.hostname.includes('myworkdayjobs.com'),
      title: [
        '[data-automation-id="jobPostingHeader"] h2',
        '[data-automation-id="jobTitle"]',
        '.job-posting-header h2',
        'h2.css-1ydfflt',
        '[data-automation-id="promptOption"] h3'
      ],
      company: [
        '[data-automation-id="jobPostingLocation"]',
        '.css-1ydfflt .company-name'
      ],
      location: [
        '[data-automation-id="jobPostingLocation"]',
        '[data-automation-id="locations"]',
        '.job-location span'
      ],
      description: [
        '[data-automation-id="jobPostingDescription"]',
        '[data-automation-id="job-posting-details"]',
        '.job-description-container',
        'dd.css-1nwbkw1'
      ]
    },

    // Greenhouse
    greenhouse: {
      detect: () => location.hostname.includes('greenhouse.io') || location.hostname.includes('boards.greenhouse.io'),
      title: [
        '.job-title',
        '.app-title',
        'h1.heading-primary'
      ],
      company: [
        '.company-name',
        '.header-logo img'
      ],
      location: [
        '.location',
        '.job-location'
      ],
      description: [
        '#content',
        '.job-post-wrapper',
        '.body'
      ]
    },

    // SmartRecruiters
    smartrecruiters: {
      detect: () => location.hostname.includes('smartrecruiters.com'),
      title: [
        'h1.job-title',
        '.st-job-title',
        '[data-test="job-title"]'
      ],
      company: [
        '.company-name',
        '[data-test="company-name"]'
      ],
      location: [
        '.job-location',
        '[data-test="job-location"]'
      ],
      description: [
        '.job-description',
        '[data-test="job-description"]'
      ]
    },

    // Generic fallback
    generic: {
      detect: () => true,
      title: [
        'h1', 
        '[class*="title"]', 
        '[class*="job-title"]',
        '[data-testid*="title"]'
      ],
      company: [
        '[class*="company"]',
        '[data-testid*="company"]',
        'meta[property="og:site_name"]'
      ],
      location: [
        '[class*="location"]',
        '[data-testid*="location"]'
      ],
      description: [
        '[class*="description"]',
        '[class*="job-content"]',
        'article',
        'main'
      ]
    }
  };

  // ============ ENHANCED JOB EXTRACTOR CLASS ============
  const EnhancedJobExtractor = {

    /**
     * Extract complete job information from current page
     * @returns {Object} - Extracted job data
     */
    extract() {
      const startTime = performance.now();
      
      // Detect platform
      const platform = this._detectPlatform();
      console.log(`[Enhanced Job Extractor] Detected platform: ${platform}`);

      // Get platform-specific selectors
      const selectors = PLATFORM_SELECTORS[platform] || PLATFORM_SELECTORS.generic;

      // Extract all fields
      const title = this._extractField(selectors.title) || this._extractFromMeta('title');
      const company = this._extractCompany(selectors.company, platform);
      const location = this._extractField(selectors.location) || this._extractFromMeta('location');
      const description = this._extractDescription(selectors.description);
      
      // Extract additional metadata
      const salary = this._extractSalary();
      const jobType = this._extractJobType();
      const experienceLevel = this._extractExperienceLevel(description);
      const postedDate = this._extractPostedDate();

      const result = {
        title: this._cleanText(title),
        company: this._cleanText(company),
        location: this._normaliseLocation(location),
        description: description,
        salary,
        jobType,
        experienceLevel,
        postedDate,
        url: window.location.href,
        platform,
        extractedAt: new Date().toISOString(),
        extractionTime: Math.round(performance.now() - startTime)
      };

      console.log(`[Enhanced Job Extractor] Extracted in ${result.extractionTime}ms:`, {
        title: result.title?.substring(0, 50),
        company: result.company,
        location: result.location
      });

      return result;
    },

    /**
     * Detect which platform/ATS we're on
     */
    _detectPlatform() {
      for (const [platform, config] of Object.entries(PLATFORM_SELECTORS)) {
        if (platform !== 'generic' && config.detect()) {
          return platform;
        }
      }
      return 'generic';
    },

    /**
     * Extract field using array of selectors
     */
    _extractField(selectors) {
      if (!selectors) return null;
      
      const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
      
      for (const selector of selectorArray) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            return element.textContent?.trim() || element.getAttribute('content');
          }
        } catch (e) {
          // Invalid selector, continue
        }
      }
      return null;
    },

    /**
     * Extract company with domain-based fallback
     */
    _extractCompany(selectors, platform) {
      // Try platform-specific selectors first
      if (typeof selectors === 'function') {
        return selectors();
      }
      
      let company = this._extractField(selectors);
      
      // Try domain-based detection
      if (!company || company.length < 2) {
        const hostname = window.location.hostname.replace(/^www\./, '').toLowerCase();
        
        // Direct domain match
        for (const [domain, name] of COMPANY_DOMAINS) {
          if (hostname === domain || hostname.endsWith(`.${domain}`) || hostname.includes(domain.split('.')[0])) {
            company = name;
            break;
          }
        }
      }

      // Try Open Graph meta
      if (!company || company.length < 2) {
        company = this._extractFromMeta('company');
      }

      // Try page title parsing
      if (!company || company.length < 2) {
        const titleParts = document.title.split(/[|\-–—]/);
        if (titleParts.length > 1) {
          company = titleParts[titleParts.length - 1].trim();
        }
      }

      // Try logo alt text
      if (!company || company.length < 2) {
        const logo = document.querySelector('header img, .logo img, [class*="logo"] img');
        if (logo?.alt && logo.alt.length > 2) {
          company = logo.alt;
        }
      }

      return company;
    },

    /**
     * Extract job description with cleaning
     */
    _extractDescription(selectors) {
      let desc = this._extractField(selectors);
      
      if (!desc) {
        // Fallback: get main content area
        const main = document.querySelector('main, article, .content, #content');
        if (main) {
          desc = main.textContent;
        }
      }

      if (!desc) {
        desc = document.body?.textContent || '';
      }

      // Clean and truncate
      return this._cleanDescription(desc);
    },

    /**
     * Clean description text
     */
    _cleanDescription(text) {
      if (!text) return '';
      
      return text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .replace(/Apply\s+(now|today|here)/gi, '')
        .replace(/Share\s+this\s+job/gi, '')
        .replace(/Similar\s+jobs/gi, '')
        .replace(/Related\s+jobs/gi, '')
        .trim()
        .substring(0, 10000); // Limit to 10k chars
    },

    /**
     * Extract from meta tags
     */
    _extractFromMeta(type) {
      const metaSelectors = {
        title: [
          'meta[property="og:title"]',
          'meta[name="twitter:title"]',
          'meta[name="title"]'
        ],
        company: [
          'meta[property="og:site_name"]',
          'meta[name="author"]',
          'meta[name="application-name"]'
        ],
        location: [
          'meta[property="og:locality"]',
          'meta[name="geo.placename"]'
        ],
        description: [
          'meta[property="og:description"]',
          'meta[name="description"]'
        ]
      };

      const selectors = metaSelectors[type] || [];
      for (const selector of selectors) {
        const meta = document.querySelector(selector);
        if (meta) {
          return meta.getAttribute('content');
        }
      }
      return null;
    },

    /**
     * Extract salary information
     */
    _extractSalary() {
      const patterns = [
        /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per|\/)\s*(?:year|annum|hour|month))?/gi,
        /£[\d,]+(?:\s*-\s*£[\d,]+)?(?:\s*(?:per|\/)\s*(?:year|annum|hour|month))?/gi,
        /€[\d,]+(?:\s*-\s*€[\d,]+)?(?:\s*(?:per|\/)\s*(?:year|annum|hour|month))?/gi,
        /[\d,]+(?:\s*-\s*[\d,]+)?\s*(?:USD|GBP|EUR)(?:\s*(?:per|\/)\s*(?:year|annum))?/gi
      ];

      const text = document.body?.textContent || '';
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[0]) {
          return match[0];
        }
      }
      
      return null;
    },

    /**
     * Extract job type (Full-time, Part-time, Contract, etc.)
     */
    _extractJobType() {
      const types = ['full-time', 'part-time', 'contract', 'temporary', 'internship', 'freelance', 'remote'];
      const text = document.body?.textContent?.toLowerCase() || '';
      
      for (const type of types) {
        if (text.includes(type)) {
          return type.charAt(0).toUpperCase() + type.slice(1);
        }
      }
      
      return 'Full-time'; // Default
    },

    /**
     * Extract experience level from description
     */
    _extractExperienceLevel(description) {
      if (!description) return null;
      
      const text = description.toLowerCase();
      
      if (text.includes('senior') || text.includes('lead') || text.includes('principal') || text.includes('staff')) {
        return 'Senior';
      }
      if (text.includes('mid-level') || text.includes('mid level') || /\b3-5\s*years?\b/.test(text)) {
        return 'Mid-Level';
      }
      if (text.includes('junior') || text.includes('entry') || text.includes('graduate') || /\b0-2\s*years?\b/.test(text)) {
        return 'Entry-Level';
      }
      if (text.includes('director') || text.includes('vp') || text.includes('head of')) {
        return 'Director';
      }
      if (text.includes('executive') || text.includes('c-level') || text.includes('chief')) {
        return 'Executive';
      }
      
      return null;
    },

    /**
     * Extract posted date
     */
    _extractPostedDate() {
      const dateSelectors = [
        '[data-testid="job-posted-date"]',
        '.job-posted-date',
        '[class*="posted"]',
        'time[datetime]'
      ];

      for (const selector of dateSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const datetime = element.getAttribute('datetime');
          if (datetime) return datetime;
          return element.textContent?.trim();
        }
      }
      
      return null;
    },

    /**
     * Clean text
     */
    _cleanText(text) {
      if (!text) return '';
      return text
        .replace(/\s+/g, ' ')
        .replace(/^\s+|\s+$/g, '')
        .replace(/^at\s+/i, '')
        .replace(/\s*-\s*careers?$/i, '')
        .trim();
    },

    /**
     * Normalise location - remove "Remote" prefix, standardise format
     */
    _normaliseLocation(location) {
      if (!location) return '';
      
      let normalised = location
        .replace(/\b(remote|work\s*from\s*home|wfh|virtual|hybrid)\b\s*[-–—/|]?\s*/gi, '')
        .replace(/\s*\(\s*(remote|hybrid)\s*\)\s*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      // If only "Remote" remains, return empty
      if (/^remote$/i.test(normalised)) {
        return '';
      }
      
      // Normalise US state abbreviations
      const stateMap = {
        'california': 'CA', 'new york': 'NY', 'texas': 'TX', 'florida': 'FL',
        'illinois': 'IL', 'washington': 'WA', 'massachusetts': 'MA', 'colorado': 'CO',
        'georgia': 'GA', 'north carolina': 'NC', 'pennsylvania': 'PA', 'ohio': 'OH'
      };
      
      for (const [full, abbrev] of Object.entries(stateMap)) {
        normalised = normalised.replace(new RegExp(`,\\s*${full}\\s*$`, 'i'), `, ${abbrev}`);
      }
      
      // Remove trailing country for US/UK
      normalised = normalised
        .replace(/,\s*(US|USA|United States|UK|United Kingdom)\s*$/i, '')
        .trim();
      
      return normalised;
    },

    /**
     * Check if current page is a job listing
     */
    isJobListing() {
      const url = window.location.href.toLowerCase();
      const pageText = document.body?.textContent?.toLowerCase() || '';
      
      const urlIndicators = ['/job/', '/jobs/', '/position/', '/apply', '/careers/', '/opening/'];
      const hasJobUrl = urlIndicators.some(ind => url.includes(ind));
      
      const hasApplyButton = !!document.querySelector(
        'a[href*="apply"], button[class*="apply"], [data-automation-id*="apply"], [data-testid*="apply"]'
      );
      
      const hasJobContent = pageText.includes('responsibilities') || 
                           pageText.includes('requirements') || 
                           pageText.includes('qualifications') ||
                           pageText.includes('we are looking for');
      
      return hasJobUrl || (hasApplyButton && hasJobContent);
    },

    /**
     * Get company tier (1 = FAANG+, 2 = Major, 3 = Other)
     */
    getCompanyTier(company) {
      if (!company) return 3;
      
      const tier1 = new Set(['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix']);
      const tier2 = new Set([
        'Salesforce', 'IBM', 'Oracle', 'Adobe', 'Stripe', 'HubSpot', 'LinkedIn',
        'Uber', 'Airbnb', 'Spotify', 'Dropbox', 'Slack', 'Atlassian', 'GitHub',
        'Citadel', 'Jane Street', 'Two Sigma', 'Goldman Sachs', 'Morgan Stanley',
        'JP Morgan Chase', 'BlackRock', 'Fidelity', 'Visa', 'Mastercard', 'PayPal'
      ]);
      
      if (tier1.has(company)) return 1;
      if (tier2.has(company)) return 2;
      return 3;
    }
  };

  // Export to global scope
  global.EnhancedJobExtractor = EnhancedJobExtractor;

})(typeof window !== 'undefined' ? window : this);
