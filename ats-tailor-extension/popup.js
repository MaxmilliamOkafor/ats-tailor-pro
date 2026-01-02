// ATS Tailor Pro - Popup Script
// Supports standalone mode (OpenAI API) and connected mode (QuantumHire)

const SUPABASE_URL = 'https://rnqzikeikntupbpucwsc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJucXppa2Vpa250dXBicHVjd3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMjI5OTksImV4cCI6MjA4Mjc5ODk5OX0.IPAEiMqsbzvJF2RF5FLcjjMs1BR9zqjud5NlpXG9Vag';

// Supported ATS platforms
const SUPPORTED_HOSTS = [
  'greenhouse.io', 'job-boards.greenhouse.io', 'boards.greenhouse.io',
  'workday.com', 'myworkdayjobs.com', 'smartrecruiters.com',
  'bullhornstaffing.com', 'bullhorn.com', 'teamtailor.com',
  'workable.com', 'apply.workable.com', 'icims.com',
  'oracle.com', 'oraclecloud.com', 'taleo.net',
  'lever.co', 'ashbyhq.com', 'breezy.hr', 'jazz.co', 'recruitee.com',
  'linkedin.com', 'indeed.com'
];

class ATSTailorPro {
  constructor() {
    this.mode = 'standalone'; // 'standalone' or 'connected'
    this.session = null;
    this.apiKey = null;
    this.currentJob = null;
    this.extractedKeywords = null;
    this.generatedDocuments = {
      cv: null, coverLetter: null, cvPdf: null, coverPdf: null,
      cvFileName: null, coverFileName: null, matchScore: 0,
      matchedKeywords: [], missingKeywords: []
    };
    this.userProfile = {
      firstName: '', lastName: '', email: '', phone: '',
      linkedin: '', github: '', portfolio: '', city: '',
      skills: [], workExperience: [], education: [],
      certifications: [], achievements: []
    };
    this.stats = { today: 0, total: 0, avgTime: 0, times: [] };
    this.currentPreviewTab = 'cv';
    this.autoTailorEnabled = true;

    this.init();
  }

  async init() {
    await this.loadSettings();
    this.bindEvents();
    this.updateUI();
    await this.loadApiKey();
    await this.detectCurrentJob();
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'ats_mode', 'ats_session', 'ats_stats', 'ats_todayDate',
        'ats_autoTailorEnabled', 'ats_userProfile', 'ats_lastJob',
        'ats_lastGeneratedDocuments'
      ], (result) => {
        this.mode = result.ats_mode || 'standalone';
        this.session = result.ats_session || null;
        this.autoTailorEnabled = result.ats_autoTailorEnabled !== false;
        this.userProfile = result.ats_userProfile || this.userProfile;
        this.currentJob = result.ats_lastJob || null;
        
        if (result.ats_lastGeneratedDocuments) {
          this.generatedDocuments = { ...this.generatedDocuments, ...result.ats_lastGeneratedDocuments };
        }

        if (result.ats_stats) {
          this.stats = result.ats_stats;
        }

        const today = new Date().toDateString();
        if (result.ats_todayDate !== today) {
          this.stats.today = 0;
          chrome.storage.local.set({ ats_todayDate: today });
        }

        resolve();
      });
    });
  }

  async loadApiKey() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getApiKey' }, (response) => {
        this.apiKey = response?.apiKey || null;
        this.updateApiKeyUI();
        resolve();
      });
    });
  }

  updateApiKeyUI() {
    const input = document.getElementById('apiKeyInput');
    const status = document.getElementById('apiKeyStatus');
    
    if (this.apiKey) {
      input.value = '••••••••••••••••' + this.apiKey.slice(-4);
      input.type = 'password';
      status.textContent = '✓ Key saved';
      status.className = 'api-key-status valid';
    } else {
      input.value = '';
      status.textContent = '';
    }
  }

  bindEvents() {
    // Mode tabs
    document.getElementById('standaloneTab')?.addEventListener('click', () => this.switchMode('standalone'));
    document.getElementById('connectedTab')?.addEventListener('click', () => this.switchMode('connected'));

    // API Key
    document.getElementById('saveApiKeyBtn')?.addEventListener('click', () => this.saveApiKey());
    document.getElementById('toggleKeyVisibility')?.addEventListener('click', () => this.toggleKeyVisibility());
    document.getElementById('apiKeyInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.saveApiKey();
    });

    // Profile
    document.getElementById('toggleProfile')?.addEventListener('click', () => this.toggleProfileForm());
    document.getElementById('saveProfileBtn')?.addEventListener('click', () => this.saveProfile());

    // Login (connected mode)
    document.getElementById('loginBtn')?.addEventListener('click', () => this.login());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    document.getElementById('password')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });

    // Job detection
    document.getElementById('refreshJob')?.addEventListener('click', () => this.detectCurrentJob());

    // AI Actions
    document.getElementById('aiExtractBtn')?.addEventListener('click', () => this.aiExtractKeywords());
    document.getElementById('tailorBtn')?.addEventListener('click', () => this.tailorDocuments());

    // Documents
    document.getElementById('downloadCv')?.addEventListener('click', () => this.downloadDocument('cv'));
    document.getElementById('downloadCover')?.addEventListener('click', () => this.downloadDocument('cover'));
    document.getElementById('downloadBothBtn')?.addEventListener('click', () => this.downloadBothDocuments());
    document.getElementById('copyContent')?.addEventListener('click', () => this.copyCurrentContent());
    document.getElementById('attachBoth')?.addEventListener('click', () => this.attachBothDocuments());

    // Preview tabs
    document.getElementById('previewCvTab')?.addEventListener('click', () => this.switchPreviewTab('cv'));
    document.getElementById('previewCoverTab')?.addEventListener('click', () => this.switchPreviewTab('cover'));

    // Settings
    document.getElementById('autoTailorToggle')?.addEventListener('change', (e) => {
      this.autoTailorEnabled = !!e.target?.checked;
      chrome.storage.local.set({ ats_autoTailorEnabled: this.autoTailorEnabled });
      this.showToast(this.autoTailorEnabled ? 'Auto tailor enabled' : 'Auto tailor disabled', 'success');
    });
  }

  switchMode(mode) {
    this.mode = mode;
    chrome.storage.local.set({ ats_mode: mode });

    document.getElementById('standaloneTab')?.classList.toggle('active', mode === 'standalone');
    document.getElementById('connectedTab')?.classList.toggle('active', mode === 'connected');

    document.getElementById('modeIndicator').textContent = mode === 'standalone' ? 'Standalone Mode' : 'Connected Mode';

    // Show/hide relevant sections
    const apiKeySection = document.getElementById('apiKeySection');
    const loginSection = document.getElementById('loginSection');
    const profileCard = document.getElementById('profileCard');
    const userBar = document.getElementById('userBar');

    if (mode === 'standalone') {
      apiKeySection?.classList.remove('hidden');
      profileCard?.classList.remove('hidden');
      loginSection?.classList.add('hidden');
      userBar?.classList.add('hidden');
    } else {
      apiKeySection?.classList.add('hidden');
      profileCard?.classList.add('hidden');
      
      if (this.session) {
        loginSection?.classList.add('hidden');
        userBar?.classList.remove('hidden');
      } else {
        loginSection?.classList.remove('hidden');
        userBar?.classList.add('hidden');
      }
    }
  }

  toggleKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const btn = document.getElementById('toggleKeyVisibility');
    
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🔒';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  }

  async saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    const status = document.getElementById('apiKeyStatus');
    const btn = document.getElementById('saveApiKeyBtn');
    
    let key = input.value.trim();
    
    // If it's the masked version, don't save
    if (key.startsWith('•')) {
      this.showToast('Enter a new key to update', 'error');
      return;
    }

    if (!key || !key.startsWith('sk-')) {
      status.textContent = '✗ Invalid key format';
      status.className = 'api-key-status invalid';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Validating...';
    status.textContent = 'Checking...';
    status.className = 'api-key-status';

    try {
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'validateApiKey', apiKey: key }, resolve);
      });

      if (result.valid) {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'saveApiKey', apiKey: key }, resolve);
        });
        
        this.apiKey = key;
        input.value = '••••••••••••••••' + key.slice(-4);
        input.type = 'password';
        status.textContent = '✓ Key saved & validated';
        status.className = 'api-key-status valid';
        this.showToast('API key saved successfully!', 'success');
      } else {
        status.textContent = '✗ ' + (result.error || 'Invalid key');
        status.className = 'api-key-status invalid';
      }
    } catch (error) {
      status.textContent = '✗ Validation failed';
      status.className = 'api-key-status invalid';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Key';
    }
  }

  toggleProfileForm() {
    const form = document.getElementById('profileForm');
    const summary = document.getElementById('profileSummary');
    const btn = document.getElementById('toggleProfile');

    if (form?.classList.contains('hidden')) {
      form.classList.remove('hidden');
      summary?.classList.add('hidden');
      btn.textContent = 'Close';
      
      // Populate form
      document.getElementById('firstName').value = this.userProfile.firstName || '';
      document.getElementById('lastName').value = this.userProfile.lastName || '';
      document.getElementById('profileEmail').value = this.userProfile.email || '';
      document.getElementById('phone').value = this.userProfile.phone || '';
      document.getElementById('linkedin').value = this.userProfile.linkedin || '';
      document.getElementById('city').value = this.userProfile.city || '';
      document.getElementById('skills').value = (this.userProfile.skills || []).join(', ');
      document.getElementById('experience').value = this.userProfile.experienceSummary || '';
    } else {
      form?.classList.add('hidden');
      summary?.classList.remove('hidden');
      btn.textContent = 'Edit';
    }
  }

  saveProfile() {
    this.userProfile = {
      ...this.userProfile,
      firstName: document.getElementById('firstName')?.value?.trim() || '',
      lastName: document.getElementById('lastName')?.value?.trim() || '',
      email: document.getElementById('profileEmail')?.value?.trim() || '',
      phone: document.getElementById('phone')?.value?.trim() || '',
      linkedin: document.getElementById('linkedin')?.value?.trim() || '',
      city: document.getElementById('city')?.value?.trim() || '',
      skills: (document.getElementById('skills')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      experienceSummary: document.getElementById('experience')?.value?.trim() || ''
    };

    chrome.storage.local.set({ ats_userProfile: this.userProfile });
    
    document.getElementById('profileName').textContent = 
      this.userProfile.firstName && this.userProfile.lastName 
        ? `${this.userProfile.firstName} ${this.userProfile.lastName}` 
        : 'Not configured';
    
    this.toggleProfileForm();
    this.showToast('Profile saved!', 'success');
  }

  updateUI() {
    // Mode
    this.switchMode(this.mode);

    // Profile summary
    document.getElementById('profileName').textContent = 
      this.userProfile.firstName && this.userProfile.lastName 
        ? `${this.userProfile.firstName} ${this.userProfile.lastName}` 
        : 'Not configured';

    // Auto tailor toggle
    const autoTailorToggle = document.getElementById('autoTailorToggle');
    if (autoTailorToggle) {
      autoTailorToggle.checked = this.autoTailorEnabled;
    }

    // Stats
    document.getElementById('todayCount').textContent = this.stats.today;
    document.getElementById('totalCount').textContent = this.stats.total;
    document.getElementById('avgTime').textContent = this.stats.avgTime > 0 ? `${Math.round(this.stats.avgTime)}s` : '0s';

    // Documents
    const hasDocuments = this.generatedDocuments.cv || this.generatedDocuments.coverLetter;
    if (hasDocuments) {
      document.getElementById('documentsCard')?.classList.remove('hidden');
      this.updateDocumentDisplay();
      this.updatePreviewContent();
    }

    // Job display
    this.updateJobDisplay();
  }

  setStatus(text, type = 'ready') {
    const indicator = document.getElementById('statusIndicator');
    const statusText = indicator?.querySelector('.status-text');

    if (indicator) indicator.className = `status-indicator ${type}`;
    if (statusText) statusText.textContent = text;
  }

  isSupportedHost(hostname) {
    return SUPPORTED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  }

  async detectCurrentJob() {
    this.setStatus('Scanning...', 'working');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id || !tab?.url) {
        this.currentJob = null;
        this.updateJobDisplay();
        this.setStatus('No active tab', 'error');
        return false;
      }

      // Skip restricted URLs
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') ||
          tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('moz-extension://')) {
        this.currentJob = null;
        this.updateJobDisplay();
        this.setStatus('Navigate to a job page', 'error');
        return false;
      }

      const url = new URL(tab.url);
      
      // More flexible - try extraction even on unknown sites
      if (!this.isSupportedHost(url.hostname)) {
        console.log('[ATS Tailor Pro] Non-standard host, attempting generic extraction');
      }

      // Execute extraction script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobInfoFromPage,
      });

      if (results?.[0]?.result) {
        this.currentJob = results[0].result;
        await chrome.storage.local.set({ ats_lastJob: this.currentJob });
        this.updateJobDisplay();
        this.setStatus('Job found!', 'ready');
        return true;
      }

      this.currentJob = null;
      this.updateJobDisplay();
      this.setStatus('No job found on page', 'error');
      return false;
    } catch (error) {
      console.error('[ATS Tailor Pro] Job detection error:', error);
      this.currentJob = null;
      this.updateJobDisplay();
      this.setStatus('Detection failed', 'error');
      return false;
    }
  }

  updateJobDisplay() {
    const titleEl = document.getElementById('jobTitle');
    const companyEl = document.getElementById('jobCompany');
    const locationEl = document.getElementById('jobLocation');
    const noJobBadge = document.getElementById('noJobBadge');

    if (this.currentJob && this.currentJob.title) {
      if (titleEl) titleEl.textContent = this.currentJob.title || 'Job Position';
      if (companyEl) companyEl.textContent = this.currentJob.company || '';
      if (locationEl) locationEl.textContent = this.currentJob.location || '';
      if (noJobBadge) noJobBadge.classList.add('hidden');
    } else {
      if (titleEl) titleEl.textContent = 'No job detected';
      if (companyEl) companyEl.textContent = 'Navigate to a job posting';
      if (locationEl) locationEl.textContent = '';
      if (noJobBadge) noJobBadge.classList.remove('hidden');
    }
  }

  async aiExtractKeywords() {
    if (!this.currentJob?.description) {
      this.showToast('No job description found. Refresh or navigate to a job page.', 'error');
      return;
    }

    if (this.mode === 'standalone' && !this.apiKey) {
      this.showToast('Please add your OpenAI API key first', 'error');
      return;
    }

    const btn = document.getElementById('aiExtractBtn');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Extracting...';
    this.setStatus('AI Extracting...', 'working');

    try {
      const apiKey = this.mode === 'standalone' ? this.apiKey : null;
      
      let result;
      
      if (this.mode === 'standalone') {
        result = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'aiExtractKeywords',
            jobDescription: this.currentJob.description,
            apiKey: apiKey
          }, resolve);
        });
      } else {
        // Connected mode - use Supabase edge function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/extract-keywords`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.session.access_token}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ description: this.currentJob.description })
        });
        result = await response.json();
      }

      if (result.error) {
        throw new Error(result.error);
      }

      this.extractedKeywords = result.keywords;
      this.displayKeywords(result.keywords);
      this.setStatus('Keywords extracted!', 'ready');
      this.showToast('Keywords extracted successfully!', 'success');
    } catch (error) {
      console.error('[ATS Tailor Pro] Keyword extraction error:', error);
      this.showToast(error.message || 'Failed to extract keywords', 'error');
      this.setStatus('Extraction failed', 'error');
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'AI Extract Keywords';
    }
  }

  displayKeywords(keywords) {
    const card = document.getElementById('keywordsCard');
    card?.classList.remove('hidden');

    const createChips = (containerId, skills, className = '') => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      (skills || []).slice(0, 10).forEach(skill => {
        const chip = document.createElement('span');
        chip.className = `keyword-chip ${className}`;
        chip.textContent = skill;
        container.appendChild(chip);
      });
    };

    createChips('requiredSkills', keywords.required_skills, 'required');
    createChips('preferredSkills', keywords.preferred_skills, 'preferred');
    createChips('techTools', keywords.technical_tools);
  }

  async tailorDocuments() {
    if (!this.currentJob) {
      this.showToast('No job detected. Navigate to a job posting.', 'error');
      return;
    }

    if (this.mode === 'standalone') {
      if (!this.apiKey) {
        this.showToast('Please add your OpenAI API key first', 'error');
        return;
      }
      if (!this.userProfile.firstName || !this.userProfile.lastName) {
        this.showToast('Please complete your profile first', 'error');
        this.toggleProfileForm();
        return;
      }
    }

    const startTime = Date.now();
    const btn = document.getElementById('tailorBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Tailoring...';
    progressContainer?.classList.remove('hidden');
    this.setStatus('Tailoring...', 'working');

    const updateProgress = (percent, text) => {
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressText) progressText.textContent = text;
    };

    try {
      updateProgress(10, 'Preparing data...');

      let result;

      if (this.mode === 'standalone') {
        updateProgress(30, 'Generating with AI...');

        result = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'tailorApplication',
            data: {
              jobInfo: this.currentJob,
              userProfile: this.userProfile,
              extractedKeywords: this.extractedKeywords
            },
            apiKey: this.apiKey
          }, (response) => {
            if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });
      } else {
        // Connected mode - use Supabase edge function
        updateProgress(20, 'Loading profile...');

        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}&select=*`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${this.session.access_token}`,
            },
          }
        );

        if (!profileRes.ok) {
          throw new Error('Could not load profile');
        }

        const profileRows = await profileRes.json();
        const profile = profileRows?.[0] || {};

        updateProgress(40, 'Generating documents...');

        const response = await fetch(`${SUPABASE_URL}/functions/v1/tailor-application`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            jobTitle: this.currentJob.title,
            company: this.currentJob.company,
            location: this.currentJob.location,
            description: this.currentJob.description,
            userProfile: {
              firstName: profile.first_name,
              lastName: profile.last_name,
              email: profile.email || this.session.user.email,
              phone: profile.phone,
              linkedin: profile.linkedin,
              github: profile.github,
              portfolio: profile.portfolio,
              workExperience: profile.work_experience || [],
              education: profile.education || [],
              skills: profile.skills || [],
              certifications: profile.certifications || [],
              achievements: profile.achievements || [],
              city: profile.city,
              country: profile.country,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Server error');
        }

        result = await response.json();
      }

      updateProgress(80, 'Processing results...');

      if (result.error) throw new Error(result.error);

      const fallbackName = `${this.userProfile.firstName}_${this.userProfile.lastName}`.replace(/\s+/g, '_') || 'Applicant';

      this.generatedDocuments = {
        cv: result.tailoredResume,
        coverLetter: result.tailoredCoverLetter,
        cvPdf: result.resumePdf,
        coverPdf: result.coverLetterPdf,
        cvFileName: result.cvFileName || `${fallbackName}_CV.pdf`,
        coverFileName: result.coverLetterFileName || `${fallbackName}_Cover_Letter.pdf`,
        matchScore: result.matchScore || 0,
        matchedKeywords: result.keywordsMatched || [],
        missingKeywords: result.keywordsMissing || []
      };

      await chrome.storage.local.set({ ats_lastGeneratedDocuments: this.generatedDocuments });

      updateProgress(100, 'Complete!');

      const elapsed = (Date.now() - startTime) / 1000;
      this.stats.today++;
      this.stats.total++;
      this.stats.times.push(elapsed);
      if (this.stats.times.length > 10) this.stats.times.shift();
      this.stats.avgTime = this.stats.times.reduce((a, b) => a + b, 0) / this.stats.times.length;
      await chrome.storage.local.set({ ats_stats: this.stats });
      this.updateUI();

      document.getElementById('documentsCard')?.classList.remove('hidden');
      this.updateDocumentDisplay();
      this.updatePreviewContent();

      this.showToast(`Done in ${elapsed.toFixed(1)}s! Match: ${this.generatedDocuments.matchScore}%`, 'success');
      this.setStatus('Complete', 'ready');
    } catch (error) {
      console.error('[ATS Tailor Pro] Tailoring error:', error);
      this.showToast(error.message || 'Tailoring failed', 'error');
      this.setStatus('Error', 'error');
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Tailor CV & Cover Letter';
      setTimeout(() => progressContainer?.classList.add('hidden'), 2000);
    }
  }

  updateDocumentDisplay() {
    const cvFileName = document.getElementById('cvFileName');
    const coverFileName = document.getElementById('coverFileName');

    if (cvFileName && this.generatedDocuments.cvFileName) {
      cvFileName.textContent = this.generatedDocuments.cvFileName;
    }

    if (coverFileName && this.generatedDocuments.coverFileName) {
      coverFileName.textContent = this.generatedDocuments.coverFileName;
    }

    // Update ATS match score
    const atsScore = document.getElementById('atsMatchScore');
    const matchedEl = document.getElementById('matchedKeywords');
    const missingEl = document.getElementById('missingKeywords');

    if (atsScore) {
      atsScore.textContent = `${this.generatedDocuments.matchScore}%`;
    }

    if (matchedEl && this.generatedDocuments.matchedKeywords?.length) {
      matchedEl.textContent = `✓ ${this.generatedDocuments.matchedKeywords.slice(0, 8).join(', ')}`;
    }

    if (missingEl && this.generatedDocuments.missingKeywords?.length) {
      missingEl.textContent = `⚠ Missing: ${this.generatedDocuments.missingKeywords.slice(0, 5).join(', ')}`;
    }
  }

  switchPreviewTab(tab) {
    this.currentPreviewTab = tab;
    document.getElementById('previewCvTab')?.classList.toggle('active', tab === 'cv');
    document.getElementById('previewCoverTab')?.classList.toggle('active', tab === 'cover');
    this.updatePreviewContent();
  }

  updatePreviewContent() {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    const content = this.currentPreviewTab === 'cv'
      ? this.generatedDocuments.cv
      : this.generatedDocuments.coverLetter;

    if (content) {
      previewContent.textContent = content;
      previewContent.classList.remove('placeholder');
    } else {
      previewContent.textContent = 'Click "Tailor CV & Cover Letter" to generate...';
      previewContent.classList.add('placeholder');
    }
  }

  downloadDocument(type) {
    const doc = type === 'cv' ? this.generatedDocuments.cvPdf : this.generatedDocuments.coverPdf;
    const textDoc = type === 'cv' ? this.generatedDocuments.cv : this.generatedDocuments.coverLetter;
    const filename = type === 'cv'
      ? this.generatedDocuments.cvFileName || 'CV.pdf'
      : this.generatedDocuments.coverFileName || 'Cover_Letter.pdf';

    if (doc) {
      const blob = this.base64ToBlob(doc, 'application/pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Downloaded!', 'success');
    } else if (textDoc) {
      const blob = new Blob([textDoc], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace('.pdf', '.txt');
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Downloaded!', 'success');
    } else {
      this.showToast('No document available', 'error');
    }
  }

  async downloadBothDocuments() {
    this.downloadDocument('cv');
    await new Promise(r => setTimeout(r, 500));
    this.downloadDocument('cover');
  }

  base64ToBlob(base64, type) {
    try {
      const byteCharacters = atob(base64);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      return new Blob([byteArray], { type });
    } catch (e) {
      console.error('[ATS Tailor Pro] Base64 decode error:', e);
      return new Blob(['Error decoding document'], { type: 'text/plain' });
    }
  }

  copyCurrentContent() {
    const content = this.currentPreviewTab === 'cv'
      ? this.generatedDocuments.cv
      : this.generatedDocuments.coverLetter;

    if (content) {
      navigator.clipboard.writeText(content)
        .then(() => this.showToast('Copied to clipboard!', 'success'))
        .catch(() => this.showToast('Failed to copy', 'error'));
    } else {
      this.showToast('No content to copy', 'error');
    }
  }

  async attachBothDocuments() {
    await this.attachDocument('cv');
    await new Promise(r => setTimeout(r, 500));
    await this.attachDocument('cover');
  }

  async attachDocument(type) {
    const doc = type === 'cv' ? this.generatedDocuments.cvPdf : this.generatedDocuments.coverPdf;
    const textDoc = type === 'cv' ? this.generatedDocuments.cv : this.generatedDocuments.coverLetter;
    const filename = type === 'cv'
      ? this.generatedDocuments.cvFileName || 'CV.pdf'
      : this.generatedDocuments.coverFileName || 'Cover_Letter.pdf';

    if (!doc && !textDoc) {
      this.showToast('No document available', 'error');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      const res = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'attachDocument',
          type,
          pdf: doc,
          text: textDoc,
          filename,
        }, (response) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(new Error(err.message || 'Send message failed'));
          resolve(response);
        });
      });

      if (res?.success) {
        this.showToast(`${type === 'cv' ? 'CV' : 'Cover Letter'} attached!`, 'success');
      } else {
        this.showToast(res?.message || 'Could not find upload field', 'error');
      }
    } catch (error) {
      console.error('[ATS Tailor Pro] Attach error:', error);
      this.showToast('Failed to attach document', 'error');
    }
  }

  async login() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');

    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      this.showToast('Please enter email and password', 'error');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Login failed');
      }

      this.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user
      };

      await chrome.storage.local.set({ ats_session: this.session });
      document.getElementById('userEmail').textContent = this.session.user?.email || 'Logged in';
      
      this.showToast('Logged in successfully!', 'success');
      this.switchMode('connected');
      
      // Auto detect and tailor
      const found = await this.detectCurrentJob();
      if (found && this.autoTailorEnabled) {
        this.tailorDocuments();
      }
    } catch (error) {
      console.error('[ATS Tailor Pro] Login error:', error);
      this.showToast(error.message || 'Login failed', 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  }

  async logout() {
    this.session = null;
    await chrome.storage.local.remove(['ats_session']);
    this.showToast('Logged out', 'success');
    this.switchMode('connected');
  }

  showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Job extraction function - injected into page context
function extractJobInfoFromPage() {
  const hostname = window.location.hostname;

  const getText = (selectors) => {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim();
      } catch { /* ignore */ }
    }
    return '';
  };

  const getMeta = (name) =>
    document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
    document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || '';

  // Enhanced platform-specific selectors
  const platformSelectors = {
    greenhouse: {
      title: ['h1.app-title', 'h1.posting-headline', 'h1', '[data-test="posting-title"]'],
      company: ['#company-name', '.company-name', '.posting-categories strong', 'a[href*="/jobs"] span'],
      location: ['.location', '.posting-categories .location', '[data-test="location"]'],
      description: ['#content', '.posting', '.posting-description', '[data-test="description"]'],
    },
    workday: {
      title: ['h1[data-automation-id="jobPostingHeader"]', 'h1[data-automation-id="jobPostingTitle"]', 'h1'],
      company: ['div[data-automation-id="jobPostingCompany"]', '[data-automation-id="companyName"]'],
      location: ['div[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]'],
      description: ['div[data-automation-id="jobPostingDescription"]', '[data-automation-id="jobDescription"]'],
    },
    smartrecruiters: {
      title: ['h1[data-test="job-title"]', 'h1', '.job-title'],
      company: ['[data-test="job-company-name"]', '[class*="company" i]'],
      location: ['[data-test="job-location"]', '[class*="location" i]'],
      description: ['[data-test="job-description"]', '[class*="job-description" i]'],
    },
    linkedin: {
      title: ['h1.job-details-jobs-unified-top-card__job-title', 'h1.topcard__title', 'h1'],
      company: ['.job-details-jobs-unified-top-card__company-name', '.topcard__org-name-link'],
      location: ['.job-details-jobs-unified-top-card__bullet', '.topcard__flavor--bullet'],
      description: ['.jobs-description__content', '.show-more-less-html__markup', '#job-details'],
    },
    indeed: {
      title: ['h1[data-testid="jobsearch-JobInfoHeader-title"]', 'h1.jobsearch-JobInfoHeader-title', 'h1'],
      company: ['[data-testid="inlineCompanyName"]', '[data-company-name="true"]', '.jobsearch-CompanyInfoContainer a'],
      location: ['[data-testid="jobsearch-JobInfoHeader-companyLocation"]', '.jobsearch-JobInfoHeader-companyLocation'],
      description: ['#jobDescriptionText', '.jobsearch-jobDescriptionText'],
    },
    lever: {
      title: ['h2.posting-headline', 'h1', '.posting-title'],
      company: ['.main-header-logo img', '.posting-categories .department'],
      location: ['.location', '.posting-categories .workplaceTypes'],
      description: ['.posting-description', '.section.page-centered'],
    },
    ashby: {
      title: ['h1[class*="JobTitle"]', 'h1'],
      company: ['[class*="CompanyName"]', 'a[class*="company"]'],
      location: ['[class*="Location"]', '[class*="location"]'],
      description: ['[class*="description"]', 'main', 'article'],
    },
    teamtailor: {
      title: ['h1', '[data-qa="job-title"]', '.job-title'],
      company: ['[data-qa="job-company"]', '[class*="company" i]'],
      location: ['[data-qa="job-location"]', '[class*="location" i]'],
      description: ['[data-qa="job-description"]', 'main', '.job-description'],
    },
    workable: {
      title: ['h1', '[data-ui="job-title"]', '.job-title'],
      company: ['[data-ui="company-name"]', 'header a'],
      location: ['[data-ui="job-location"]', '.location'],
      description: ['[data-ui="job-description"]', 'section'],
    },
    icims: {
      title: ['h1', '.iCIMS_Header', '.job-title'],
      company: ['[class*="company" i]'],
      location: ['[class*="location" i]'],
      description: ['#job-content', '.job-description'],
    },
    oracle: {
      title: ['h1', '[class*="job-title" i]'],
      company: ['[class*="company" i]'],
      location: ['[class*="location" i]'],
      description: ['[class*="description" i]', 'main'],
    },
    bullhorn: {
      title: ['h1', '[class*="job-title" i]'],
      company: ['[class*="company" i]'],
      location: ['[class*="location" i]'],
      description: ['[class*="description" i]', 'main'],
    },
    generic: {
      title: ['h1', '[class*="title" i]', 'title'],
      company: ['[class*="company" i]', '[class*="employer" i]', 'meta[name="author"]'],
      location: ['[class*="location" i]', '[class*="place" i]'],
      description: ['[class*="description" i]', '[class*="content" i]', 'main', 'article', 'body'],
    }
  };

  const detectPlatformKey = () => {
    if (hostname.includes('greenhouse.io')) return 'greenhouse';
    if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) return 'workday';
    if (hostname.includes('smartrecruiters.com')) return 'smartrecruiters';
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (hostname.includes('lever.co')) return 'lever';
    if (hostname.includes('ashbyhq.com')) return 'ashby';
    if (hostname.includes('teamtailor.com')) return 'teamtailor';
    if (hostname.includes('workable.com')) return 'workable';
    if (hostname.includes('icims.com')) return 'icims';
    if (hostname.includes('bullhorn')) return 'bullhorn';
    if (hostname.includes('oracle') || hostname.includes('taleo.net') || hostname.includes('oraclecloud')) return 'oracle';
    return 'generic';
  };

  const platformKey = detectPlatformKey();
  const selectors = platformSelectors[platformKey] || platformSelectors.generic;

  // Extract with fallbacks
  let title = getText(selectors.title);
  if (!title) title = getMeta('og:title') || '';
  if (!title) title = document.title?.split('|')?.[0]?.split('-')?.[0]?.split(' at ')?.[0]?.trim() || '';

  // Validate title
  if (!title || title.length < 3 || title.length > 200) {
    console.log('[ATS Tailor Pro] No valid title found');
    return null;
  }

  let company = getText(selectors.company);
  if (!company) company = getMeta('og:site_name') || '';
  
  // Extract company from title if format is "Role at Company"
  if (!company && title.includes(' at ')) {
    const parts = document.title.split(' at ');
    if (parts.length > 1) {
      company = parts[parts.length - 1].split('|')[0].split('-')[0].trim();
    }
  }

  const location = getText(selectors.location);

  // Get full description
  let rawDesc = getText(selectors.description);
  if (!rawDesc || rawDesc.length < 100) {
    // Try to get body text as fallback
    rawDesc = document.body.innerText?.substring(0, 10000) || '';
  }
  
  const description = rawDesc.trim().substring(0, 8000);

  console.log('[ATS Tailor Pro] Extracted:', { title, company, location, descLength: description.length });

  return {
    title: title.substring(0, 200),
    company: company.substring(0, 100),
    location: location.substring(0, 100),
    description,
    url: window.location.href,
    platform: platformKey,
  };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new ATSTailorPro();
});
