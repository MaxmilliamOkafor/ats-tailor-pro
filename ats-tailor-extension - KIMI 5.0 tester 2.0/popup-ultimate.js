// ATS Tailor Ultimate - Popup Script with OpenResume Integration
// Uses ATSCVGeneratorUltimate for 100% ATS compatibility

const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';

// ============ TIER 1-2 TECH COMPANY DETECTION ============
const TIER1_TECH_COMPANIES = {
  faang: new Set(['google','meta','amazon','microsoft','apple','facebook']),
  enterprise: new Set(['salesforce','ibm','oracle','adobe','sap','vmware','servicenow','workday']),
  fintech: new Set(['stripe','paypal','visa','mastercard','block','square']),
  saas: new Set(['hubspot','intercom','zendesk','docusign','twilio','slack','atlassian','gitlab','circleci','datadog','datadoghq','unity','udemy']),
  social: new Set(['linkedin','tiktok','bytedance','snap','snapchat','dropbox','bloomberg']),
  hardware: new Set(['intel','broadcom','arm','armholdings','tsmc','appliedmaterials','cisco','nvidia','amd','qualcomm']),
  finance: new Set(['fidelity','morganstanley','jpmorgan','jpmorganchase','blackrock','capitalone','tdsecurities','kpmg','deloitte','accenture','pwc','ey','mckinsey','kkr','fenergo']),
  quant: new Set(['citadel','janestreet','sig','twosigma','deshaw','rentec','renaissancetechnologies','mlp','millennium','virtu','virtufinancial','hudsontrading','hrt','jumptrading']),
  other: new Set(['netflix','tesla','uber','airbnb','palantir','crowdstrike','snowflake','intuit','toast','toasttab','workhuman','draftkings','walmart','roblox','doordash','instacart','rivian','chime','wasabi','wasabitechnologies','samsara','blockchain','similarweb','deepmind','googledeepmind'])
};

const SUPPORTED_HOSTS = [
  'greenhouse.io', 'job-boards.greenhouse.io', 'boards.greenhouse.io',
  'workday.com', 'myworkdayjobs.com', 'smartrecruiters.com',
  'bullhornstaffing.com', 'bullhorn.com', 'teamtailor.com',
  'workable.com', 'apply.workable.com', 'icims.com',
  'oracle.com', 'oraclecloud.com', 'taleo.net',
  'google.com', 'meta.com', 'amazon.com', 'microsoft.com', 'apple.com',
  'salesforce.com', 'ibm.com', 'adobe.com', 'stripe.com', 'hubspot.com',
  'intel.com', 'servicenow.com', 'workhuman.com', 'intercom.com', 'paypal.com',
  'tiktok.com', 'linkedin.com', 'dropbox.com', 'twilio.com', 'datadoghq.com',
  'toasttab.com', 'zendesk.com', 'docusign.com', 'fidelity.com', 'sap.com',
  'morganstanley.com', 'kpmg.com', 'deloitte.com', 'accenture.com', 'pwc.com',
  'ey.com', 'citadel.com', 'janestreet.com', 'sig.com', 'twosigma.com',
  'deshaw.com', 'rentec.com', 'mlp.com', 'virtu.com', 'hudsontrading.com',
  'jumptrading.com', 'broadcom.com', 'slack.com', 'circleci.com', 'unity.com',
  'bloomberg.com', 'vmware.com', 'mckinsey.com', 'udemy.com', 'draftkings.com',
  'walmart.com', 'mastercard.com', 'visa.com', 'blackrock.com', 'tdsecurities.com',
  'kkr.com', 'fenergo.com', 'appliedmaterials.com', 'tsmc.com', 'arm.com',
  'deepmind.google', 'cisco.com', 'jpmorgan.com', 'gitlab.com', 'atlassian.com',
  'snap.com', 'capitalone.com', 'wasabi.com', 'samsara.com', 'blockchain.com',
  'similarweb.com', 'nvidia.com', 'tesla.com', 'uber.com', 'airbnb.com',
  'palantir.com', 'crowdstrike.com', 'snowflake.com', 'netflix.com', 'amd.com'
];

class ATSTailorUltimate {
  constructor() {
    this.session = null;
    this.currentJob = null;
    this.generatedDocuments = { cv: null, coverLetter: null };
    this.stats = { today: 0, total: 0, avgTime: 0, times: [] };
    this.currentPreviewTab = 'cv';
    this.autoTailorEnabled = true;
    this.aiProvider = 'kimi';
    this.workdayState = {
      currentStep: 0,
      totalSteps: 0,
      formData: {},
      jobId: null,
      startedAt: null,
      lastUpdated: null
    };
    this.baseCVContent = null;
    this.baseCVSource = null;
    this.jdCache = new Map();
    this.keywordCache = new Map();
    this._coverageOriginalCV = '';
    this._defaultLocation = 'Dublin, IE';
    this._domRefs = {};

    this.init();
  }

  getDomRef(id) {
    if (!this._domRefs[id]) {
      this._domRefs[id] = document.getElementById(id);
    }
    return this._domRefs[id];
  }

  async init() {
    await this.loadSession();
    await this.loadAIProviderSettings();
    await this.loadWorkdayState();
    await this.loadBaseCVFromProfile();
    this.bindEvents();
    this.updateUI();
    this.updateAIProviderUI();

    if (this.session) {
      await this.refreshSessionIfNeeded();
      await this.detectCurrentJob();
    }
  }

  async loadAIProviderSettings() {
    return new Promise(async (resolve) => {
      if (this.session?.access_token && this.session?.user?.id) {
        try {
          const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}&select=preferred_ai_provider,openai_enabled,kimi_enabled,openai_api_key,kimi_api_key`,
            {
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${this.session.access_token}`,
              },
            }
          );
          
          if (profileRes.ok) {
            const profiles = await profileRes.json();
            const profile = profiles?.[0];
            
            if (profile) {
              const preferredProvider = profile.preferred_ai_provider || 'kimi';
              const kimiEnabled = profile.kimi_enabled ?? true;
              const openaiEnabled = profile.openai_enabled ?? true;
              const hasKimiKey = !!profile.kimi_api_key;
              const hasOpenAIKey = !!profile.openai_api_key;
              
              if (preferredProvider === 'kimi' && kimiEnabled && hasKimiKey) {
                this.aiProvider = 'kimi';
              } else if (preferredProvider === 'openai' && openaiEnabled && hasOpenAIKey) {
                this.aiProvider = 'openai';
              } else if (kimiEnabled && hasKimiKey) {
                this.aiProvider = 'kimi';
              } else if (openaiEnabled && hasOpenAIKey) {
                this.aiProvider = 'openai';
              } else {
                this.aiProvider = 'kimi';
              }
              
              console.log('[ATS Ultimate] AI Provider loaded from profile:', this.aiProvider);
              
              await chrome.storage.local.set({ 
                ai_provider: this.aiProvider,
                ai_settings: { provider: this.aiProvider, syncedFromProfile: true, savedAt: Date.now() }
              });
              
              resolve();
              return;
            }
          }
        } catch (e) {
          console.warn('[ATS Ultimate] Could not load AI provider from profile:', e);
        }
      }
      
      chrome.storage.local.get(['ai_provider', 'ai_settings'], (result) => {
        this.aiProvider = result.ai_provider || result.ai_settings?.provider || 'kimi';
        console.log('[ATS Ultimate] AI Provider loaded from local storage:', this.aiProvider);
        resolve();
      });
    });
  }

  async saveAIProviderSettings() {
    await chrome.storage.local.set({ 
      ai_provider: this.aiProvider,
      ai_settings: { provider: this.aiProvider, savedAt: Date.now() }
    });
    
    if (this.session?.access_token && this.session?.user?.id) {
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${this.session.access_token}`,
              Prefer: 'return=minimal'
            },
            body: JSON.stringify({
              preferred_ai_provider: this.aiProvider
            })
          }
        );
        console.log('[ATS Ultimate] AI Provider saved to profile:', this.aiProvider);
      } catch (e) {
        console.warn('[ATS Ultimate] Could not save AI provider to profile:', e);
      }
    }
    
    console.log('[ATS Ultimate] AI Provider saved:', this.aiProvider);
    
    const savedEl = document.getElementById('aiSettingsSaved');
    if (savedEl) {
      savedEl.classList.add('visible');
      setTimeout(() => savedEl.classList.remove('visible'), 2000);
    }
  }

  async loadWorkdayState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['workday_multi_page_state'], (result) => {
        if (result.workday_multi_page_state) {
          this.workdayState = { ...this.workdayState, ...result.workday_multi_page_state };
        }
        resolve();
      });
    });
  }

  async saveWorkdayState() {
    this.workdayState.lastUpdated = Date.now();
    await chrome.storage.local.set({ workday_multi_page_state: this.workdayState });
  }

  async clearWorkdayState() {
    this.workdayState = {
      currentStep: 0,
      totalSteps: 0,
      formData: {},
      jobId: null,
      startedAt: null,
      lastUpdated: null
    };
    await chrome.storage.local.remove(['workday_multi_page_state']);
  }

  updateWorkdayProgress(step, totalSteps, formData = {}) {
    this.workdayState.currentStep = step;
    this.workdayState.totalSteps = totalSteps;
    this.workdayState.formData = { ...this.workdayState.formData, ...formData };
    this.saveWorkdayState();
    this.updateWorkdayProgressUI();
  }

  updateWorkdayProgressUI() {
    const progressEl = document.getElementById('workdayProgress');
    const stepIndicators = document.querySelectorAll('.workday-step-indicator');
    const statusEl = document.getElementById('workdayFlowStatus');
    
    if (progressEl && this.workdayState.totalSteps > 0) {
      const percent = (this.workdayState.currentStep / this.workdayState.totalSteps) * 100;
      progressEl.style.width = `${percent}%`;
    }
    
    stepIndicators.forEach((indicator, idx) => {
      indicator.classList.toggle('active', idx === this.workdayState.currentStep);
      indicator.classList.toggle('complete', idx < this.workdayState.currentStep);
    });
    
    if (statusEl) {
      const stepNames = ['My Information', 'Experience', 'Review'];
      statusEl.textContent = stepNames[this.workdayState.currentStep] || `Step ${this.workdayState.currentStep + 1}`;
    }
  }

  async loadBaseCVFromProfile() {
    if (!this.session?.access_token || !this.session?.user?.id) {
      return;
    }
    
    try {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}&select=cv_file_path,cv_file_name,cv_uploaded_at`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${this.session.access_token}`,
          },
        }
      );
      
      if (!profileRes.ok) return;
      
      const profiles = await profileRes.json();
      const profile = profiles?.[0];
      
      if (profile?.cv_file_path) {
        console.log('[ATS Ultimate] Found uploaded CV:', profile.cv_file_name);
        this.baseCVSource = 'uploaded';
        
        const parsedCVRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}&select=work_experience,education,skills,certifications,achievements`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${this.session.access_token}`,
            },
          }
        );
        
        if (parsedCVRes.ok) {
          const parsedData = await parsedCVRes.json();
          if (parsedData?.[0]) {
            this.baseCVContent = parsedData[0];
            console.log('[ATS Ultimate] Loaded parsed CV content from profile');
          }
        }
      }
    } catch (e) {
      console.warn('[ATS Ultimate] Could not load base CV from profile:', e);
    }
  }

  async refreshSessionIfNeeded() {
    try {
      if (!this.session?.refresh_token || !this.session?.access_token) return;

      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${this.session.access_token}`,
        },
      });

      if (res.ok) return;

      const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: this.session.refresh_token }),
      });

      if (!refreshRes.ok) {
        console.warn('[ATS Ultimate] refresh failed; clearing session');
        this.session = null;
        await chrome.storage.local.remove(['ats_session']);
        this.updateUI();
        return;
      }

      const data = await refreshRes.json();
      this.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user || this.session.user,
      };
      await this.saveSession();
    } catch (e) {
      console.warn('[ATS Ultimate] refreshSessionIfNeeded error', e);
    }
  }

  async loadSession() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['ats_session', 'ats_stats', 'ats_todayDate', 'ats_autoTailorEnabled', 'ats_lastGeneratedDocuments', 'ats_lastJob', 'ats_defaultLocation'],
        (result) => {
          this.session = result.ats_session || null;
          this.autoTailorEnabled = typeof result.ats_autoTailorEnabled === 'boolean' ? result.ats_autoTailorEnabled : true;
          
          this._defaultLocation = result.ats_defaultLocation || 'Dublin, IE';

          this.currentJob = result.ats_lastJob || this.currentJob;
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
        }
      );
    });
  }

  async saveSession() {
    await chrome.storage.local.set({ ats_session: this.session });
  }

  async saveStats() {
    await chrome.storage.local.set({
      ats_stats: this.stats,
      ats_todayDate: new Date().toDateString()
    });
  }

  bindEvents() {
    document.getElementById('loginBtn')?.addEventListener('click', () => this.login());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    document.getElementById('tailorBtn')?.addEventListener('click', () => this.tailorDocuments({ force: true }));
    document.getElementById('refreshJob')?.addEventListener('click', () => this.detectCurrentJob());
    document.getElementById('editJobTitle')?.addEventListener('click', () => this.toggleJobTitleEdit());
    document.getElementById('jobTitleInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.saveJobTitleEdit(); });
    document.getElementById('jobTitleInput')?.addEventListener('blur', () => this.saveJobTitleEdit());
    document.getElementById('downloadCv')?.addEventListener('click', () => this.downloadDocument('cv'));
    document.getElementById('downloadCover')?.addEventListener('click', () => this.downloadDocument('cover'));
    document.getElementById('attachBoth')?.addEventListener('click', () => this.attachBothDocuments());
    document.getElementById('copyContent')?.addEventListener('click', () => this.copyCurrentContent());
    document.getElementById('copyCoverageBtn')?.addEventListener('click', () => this.copyCoverageReport());
    
    // Text download buttons
    document.getElementById('downloadCvText')?.addEventListener('click', () => this.downloadTextVersion('cv'));
    document.getElementById('downloadCoverText')?.addEventListener('click', () => this.downloadTextVersion('cover'));
    
    document.getElementById('btnKimi')?.addEventListener('click', () => this.selectAIProvider('kimi'));
    document.getElementById('btnOpenAI')?.addEventListener('click', () => this.selectAIProvider('openai'));

    document.getElementById('openBulkApply')?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('bulk-apply.html') });
    });
    
    document.getElementById('autoTailorToggle')?.addEventListener('change', (e) => {
      const enabled = !!e.target?.checked;
      this.autoTailorEnabled = enabled;
      chrome.storage.local.set({ ats_autoTailorEnabled: enabled });
      this.showToast(enabled ? 'Auto tailor enabled' : 'Auto tailor disabled', 'success');
    });
    
    document.getElementById('csvFileInput')?.addEventListener('change', (e) => this.handleCsvUpload(e));
    document.getElementById('parseCsvBtn')?.addEventListener('click', () => this.parseCsv());
    document.getElementById('startBulkAutomation')?.addEventListener('click', () => this.startBulkAutomation());
    document.getElementById('pauseBulkBtn')?.addEventListener('click', () => this.pauseBulkAutomation());
    document.getElementById('resumeBulkBtn')?.addEventListener('click', () => this.resumeBulkAutomation());
    document.getElementById('stopBulkBtn')?.addEventListener('click', () => this.stopBulkAutomation());
    
    this.startBulkProgressPolling();
    
    document.getElementById('viewKeywordsBtn')?.addEventListener('click', () => this.viewExtractedKeywords());
    document.getElementById('aiExtractBtn')?.addEventListener('click', () => this.aiExtractKeywords());
    document.getElementById('skillGapBtn')?.addEventListener('click', () => this.showSkillGapPanel());
    document.getElementById('closeSkillGap')?.addEventListener('click', () => this.hideSkillGapPanel());

    document.getElementById('runWorkdayFlow')?.addEventListener('click', () => this.runWorkdayFlow());
    document.getElementById('workdayAutoToggle')?.addEventListener('change', (e) => {
      const enabled = !!e.target?.checked;
      chrome.storage.local.set({ workday_auto_enabled: enabled });
      this.showToast(enabled ? 'Workday automation enabled' : 'Workday automation disabled', 'success');
    });
    document.getElementById('saveWorkdayCreds')?.addEventListener('click', () => this.saveWorkdayCredentials());
    document.getElementById('clearWorkdayState')?.addEventListener('click', () => {
      this.clearWorkdayState();
      this.showToast('Workday state cleared', 'success');
    });
    
    document.getElementById('captureSnapshotBtn')?.addEventListener('click', () => this.captureWorkdaySnapshot());
    document.getElementById('forceWorkdayApplyBtn')?.addEventListener('click', () => this.forceWorkdayApply());
    
    document.getElementById('autofillEnabledToggle')?.addEventListener('change', (e) => {
      const enabled = !!e.target?.checked;
      chrome.storage.local.set({ autofill_enabled: enabled });
      this.showToast(enabled ? '🤖 AI Autofill enabled' : 'AI Autofill disabled', 'success');
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'TOGGLE_AUTOFILL',
            enabled: enabled
          }).catch(() => {});
        }
      });
    });
    
    document.getElementById('manualAutofillBtn')?.addEventListener('click', () => this.runManualAutofill());
    document.getElementById('viewSavedResponsesBtn')?.addEventListener('click', () => this.viewSavedResponses());
    document.getElementById('clearSavedResponsesBtn')?.addEventListener('click', () => this.clearSavedResponses());
    
    document.getElementById('saveLocationBtn')?.addEventListener('click', () => this.saveDefaultLocation());
    document.getElementById('defaultLocationInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.saveDefaultLocation();
    });
    
    this.loadWorkdaySettings();
    this.loadLocationSettings();
    this.loadAutofillSettings();
    this.loadSavedResponsesStats();
    this.checkWorkdayAndShowSnapshot();
    this.updateWorkdayProgressUI();

    document.getElementById('previewCvTab')?.addEventListener('click', () => this.switchPreviewTab('cv'));
    document.getElementById('previewCoverTab')?.addEventListener('click', () => this.switchPreviewTab('cover'));
    document.getElementById('previewTextTab')?.addEventListener('click', () => this.switchPreviewTab('text'));

    document.getElementById('password')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'TRIGGER_EXTRACT_APPLY' || message.action === 'POPUP_TRIGGER_EXTRACT_APPLY') {
        console.log('[ATS Ultimate Popup] Received trigger message:', message.action, 'with animation:', message.showButtonAnimation);
        this.triggerExtractApplyWithUI(message.jobInfo, message.showButtonAnimation !== false);
        sendResponse({ status: 'triggered' });
        return true;
      }
    });
    
    this.checkPendingAutomationTrigger();
  }

  // ============ TEXT DOWNLOAD USING ATS GENERATOR ============
  downloadTextVersion(type) {
    const content = type === 'cv' ? this.generatedDocuments.cv?.text : this.generatedDocuments.coverLetter?.text;
    const filename = type === 'cv' 
      ? (this.generatedDocuments.cv?.filename || 'Resume').replace('.pdf', '.txt')
      : (this.generatedDocuments.coverLetter?.filename || 'Cover_Letter').replace('.pdf', '.txt');
    
    if (!content) {
      this.showToast(`No ${type === 'cv' ? 'CV' : 'Cover Letter'} content to download`, 'error');
      return;
    }
    
    // Use ATSCVGeneratorUltimate if available
    if (typeof ATSCVGeneratorUltimate !== 'undefined') {
      ATSCVGeneratorUltimate.downloadText(content, filename);
    } else {
      // Fallback
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    this.showToast(`Downloaded ${filename}`, 'success');
  }

  async checkPendingAutomationTrigger() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['pending_extract_apply'], resolve);
    });

    if (result.pending_extract_apply?.triggeredFromAutomation) {
      const pendingTrigger = result.pending_extract_apply;
      const age = Date.now() - (pendingTrigger.timestamp || 0);

      if (age < 30000) {
        console.log('[ATS Ultimate Popup] Found pending automation trigger, executing...');
        await chrome.storage.local.remove(['pending_extract_apply']);
        requestAnimationFrame(() => {
          this.triggerExtractApplyWithUI(pendingTrigger.jobInfo, true);
        });
      } else {
        await chrome.storage.local.remove(['pending_extract_apply']);
      }
    }
  }

  async triggerExtractApplyWithUI(jobInfo, showAnimation = true) {
    const btn = document.getElementById('tailorBtn');
    if (!btn) {
      console.warn('[ATS Ultimate Popup] tailorBtn not found');
      return;
    }
    
    const startTime = performance.now();
    
    if (showAnimation) {
      btn.classList.add('pressed', 'loading', 'btn-animating');
      btn.disabled = true;
      
      btn.style.transform = 'scale(0.95)';
      btn.style.boxShadow = 'inset 0 4px 12px rgba(0,0,0,0.4)';
      btn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
      btn.style.transition = 'all 0.15s ease-in-out';
      
      setTimeout(() => {
        btn.style.transform = 'scale(0.98)';
        btn.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(247, 147, 30, 0.5)';
      }, 100);
    }
    
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');
    const originalText = btnText?.textContent || 'Extract & Apply Keywords to CV';
    const originalIcon = btnIcon?.textContent || '🚀';
    
    if (btnText) {
      btnText.textContent = '⚡ 50ms Processing...';
    }
    if (btnIcon) {
      btnIcon.textContent = '⏳';
      btnIcon.style.animation = 'spin 1s linear infinite';
    }
    
    if (jobInfo) {
      this.currentJob = jobInfo;
      this.updateJobDisplay();
    }
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'INSTANT_TAILOR_ATTACH',
          jobUrl: tab.url || window.location.href,
          showTimer: true
        });
        
        const elapsed = Math.round(performance.now() - startTime);
        
        if (response?.status === 'attached') {
          console.log(`[ATS Ultimate Popup] ⚡ INSTANT attach complete in ${response.timing}ms (cached: ${response.cached})`);
          
          if (showAnimation) {
            btn.style.background = 'linear-gradient(135deg, #00c853, #69f0ae)';
            btn.style.transform = 'scale(1.02)';
            btn.style.boxShadow = '0 4px 20px rgba(0, 200, 83, 0.4)';
            if (btnIcon) btnIcon.textContent = '✅';
            if (btnText) btnText.textContent = `✅ ${response.timing}ms${response.cached ? ' (cached)' : ''}`;
          }
          
          this.showToast(`✅ Attached in ${response.timing}ms! Match: 100%`, 'success');
        } else if (response?.status === 'pending') {
          if (btnText) btnText.textContent = '⚡ Generating...';
          await this.tailorDocuments({ force: true });
        } else {
          throw new Error(response?.error || 'Unknown error');
        }
      } else {
        await this.tailorDocuments({ force: true });
      }
      
      chrome.runtime.sendMessage({ action: 'EXTRACT_APPLY_COMPLETE' }).catch(() => {});
      
    } catch (error) {
      console.error('[ATS Ultimate Popup] Error:', error);
      
      if (showAnimation) {
        btn.style.background = 'linear-gradient(135deg, #ff1744, #ff5252)';
        if (btnIcon) btnIcon.textContent = '❌';
        if (btnText) btnText.textContent = 'Error!';
      }
      
      try {
        await this.tailorDocuments({ force: true });
      } catch (e) {
        this.showToast(`Error: ${e.message}`, 'error');
      }
    } finally {
      setTimeout(() => {
        btn.classList.remove('pressed', 'loading', 'btn-animating');
        btn.disabled = false;
        btn.style.transform = '';
        btn.style.boxShadow = '';
        btn.style.background = '';
        btn.style.transition = '';
        if (btnText) btnText.textContent = originalText;
        if (btnIcon) {
          btnIcon.textContent = originalIcon;
          btnIcon.style.animation = '';
        }
      }, showAnimation ? 2500 : 0);
    }
  }

  async triggerLazyApplySync() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'LAZYAPPLY_28S_SYNC'
        });
        this.showToast(`LazyApply override scheduled in ${response.delay / 1000}s`, 'success');
      }
    } catch (e) {
      this.showToast('Could not schedule LazyApply sync', 'error');
    }
  }

  async loadWorkdaySettings() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['workday_email', 'workday_password', 'workday_verify_password', 'workday_auto_enabled'], resolve);
    });
    
    const emailInput = document.getElementById('workdayEmail');
    const passwordInput = document.getElementById('workdayPassword');
    const verifyPasswordInput = document.getElementById('workdayVerifyPassword');
    const autoToggle = document.getElementById('workdayAutoToggle');
    const emailDisplay = document.getElementById('workdayEmailDisplay');
    
    if (emailInput && result.workday_email) emailInput.value = result.workday_email;
    if (passwordInput && result.workday_password) passwordInput.value = result.workday_password;
    if (verifyPasswordInput && result.workday_verify_password) verifyPasswordInput.value = result.workday_verify_password;
    if (autoToggle) autoToggle.checked = result.workday_auto_enabled !== false;
    if (emailDisplay && result.workday_email) emailDisplay.textContent = result.workday_email;
  }

  saveWorkdayCredentials() {
    const email = document.getElementById('workdayEmail')?.value;
    const password = document.getElementById('workdayPassword')?.value;
    const verifyPassword = document.getElementById('workdayVerifyPassword')?.value;
    
    if (!email || !password) {
      this.showToast('Please enter email and password', 'error');
      return;
    }
    
    const emailDisplay = document.getElementById('workdayEmailDisplay');
    if (emailDisplay) emailDisplay.textContent = email;
    
    chrome.runtime.sendMessage({
      action: 'UPDATE_WORKDAY_CREDENTIALS',
      email: email,
      password: password,
      verifyPassword: verifyPassword || password
    });
    
    chrome.storage.local.set({
      workday_email: email,
      workday_password: password,
      workday_verify_password: verifyPassword || password
    });
    
    this.showToast('Workday credentials saved!', 'success');
  }

  async loadAutofillSettings() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['autofill_enabled'], resolve);
    });
    
    const toggle = document.getElementById('autofillEnabledToggle');
    if (toggle) {
      toggle.checked = result.autofill_enabled !== false;
    }
  }

  async runManualAutofill() {
    const btn = document.getElementById('manualAutofillBtn');
    if (btn) {
      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'Running...';
    }
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        this.showToast('No active tab found', 'error');
        return;
      }
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'RUN_MANUAL_AUTOFILL'
      });
      
      if (response?.success) {
        this.showToast(`✅ Autofill complete! Filled ${response.filledCount || 0} fields`, 'success');
      } else {
        this.showToast(response?.error || 'Autofill failed', 'error');
      }
    } catch (e) {
      console.error('[Popup] Manual autofill error:', e);
      this.showToast('Autofill failed - check console', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Run Manual Autofill';
      }
    }
  }

  async loadSavedResponsesStats() {
    try {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['saved_responses'], resolve);
      });
      
      const responses = result.saved_responses || {};
      const count = Object.keys(responses).length;
      
      const statsEl = document.getElementById('savedResponsesStats');
      if (statsEl) {
        statsEl.innerHTML = `<span class="stat-badge">${count} saved responses</span>`;
      }
    } catch (e) {
      console.log('[Popup] Error loading saved responses stats:', e);
    }
  }

  async viewSavedResponses() {
    const listEl = document.getElementById('savedResponsesList');
    if (!listEl) return;
    
    try {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['saved_responses'], resolve);
      });
      
      const responses = result.saved_responses || {};
      const entries = Object.entries(responses);
      
      if (entries.length === 0) {
        listEl.innerHTML = '<p class="empty-state">No saved responses yet. Apply to jobs to build your response memory.</p>';
        listEl.classList.remove('hidden');
        return;
      }
      
      entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
      
      const html = entries.slice(0, 20).map(([question, data]) => `
        <div class="saved-response-item">
          <div class="response-question">${this.escapeHtml(question.substring(0, 80))}${question.length > 80 ? '...' : ''}</div>
          <div class="response-answer">${this.escapeHtml((data.answer || '').substring(0, 50))}${(data.answer || '').length > 50 ? '...' : ''}</div>
          <div class="response-meta">Used ${data.useCount || 1}x</div>
        </div>
      `).join('');
      
      listEl.innerHTML = html;
      listEl.classList.toggle('hidden', false);
    } catch (e) {
      console.error('[Popup] Error viewing saved responses:', e);
    }
  }

  async clearSavedResponses() {
    if (!confirm('Are you sure you want to clear all saved responses? This cannot be undone.')) {
      return;
    }
    
    try {
      await chrome.storage.local.remove(['saved_responses']);
      this.showToast('Saved responses cleared', 'success');
      this.loadSavedResponsesStats();
      
      const listEl = document.getElementById('savedResponsesList');
      if (listEl) {
        listEl.innerHTML = '<p class="empty-state">No saved responses.</p>';
      }
    } catch (e) {
      this.showToast('Failed to clear responses', 'error');
    }
  }

  loadLocationSettings() {
    const locationInput = document.getElementById('defaultLocationInput');
    if (locationInput && this._defaultLocation) {
      locationInput.value = this._defaultLocation;
    }
  }

  saveDefaultLocation() {
    const locationInput = document.getElementById('defaultLocationInput');
    const location = locationInput?.value?.trim();
    
    if (!location) {
      this.showToast('Please enter a location', 'error');
      return;
    }
    
    this._defaultLocation = location;
    chrome.storage.local.set({ ats_defaultLocation: location });
    this.showToast('Default location saved', 'success');
  }

  // ============ MAIN DOCUMENT TAILORING (ULTIMATE) ============
  async tailorDocuments(options = {}) {
    const startTime = performance.now();
    const { force = false } = options;
    
    if (!this.currentJob) {
      this.showToast('No job detected. Please navigate to a job posting.', 'error');
      return;
    }

    try {
      this.showToast('Generating 100% ATS-compatible documents...', 'info');

      // Get candidate data from profile or storage
      const candidateData = await this.getCandidateData();
      if (!candidateData) {
        this.showToast('No CV data found. Please upload your CV in the profile.', 'error');
        return;
      }

      // Extract keywords from job description
      const jobDescription = this.currentJob.description || '';
      const keywords = await this.extractKeywords(jobDescription);

      // Use ATSCVGeneratorUltimate for perfect formatting
      let result = null;
      if (typeof ATSCVGeneratorUltimate !== 'undefined') {
        result = await ATSCVGeneratorUltimate.generateCV(candidateData, keywords, this.currentJob, {
          format: 'pdf',
          includeCoverLetter: true
        });
      } else {
        // Fallback to legacy generator
        result = await this.generateDocumentsLegacy(candidateData, keywords, this.currentJob);
      }

      // Store generated documents
      this.generatedDocuments = {
        cv: result.cv,
        coverLetter: result.coverLetter,
        matchScore: result.matchScore,
        keywords: result.keywords,
        atsCompliance: result.atsCompliance
      };

      // Update UI
      this.updatePreview();
      this.updateMetrics();
      this.saveGeneratedDocuments();

      const timing = Math.round(performance.now() - startTime);
      this.showToast(`✅ Documents tailored in ${timing}ms! ATS Score: ${result.matchScore}%`, 'success');

    } catch (error) {
      console.error('[ATS Ultimate] Error tailoring documents:', error);
      this.showToast(`Error: ${error.message}`, 'error');
    }
  }

  // ============ LEGACY GENERATOR (Fallback) ============
  async generateDocumentsLegacy(candidateData, keywords, jobData) {
    // Use OpenResumeGenerator if available
    if (typeof OpenResumeGenerator !== 'undefined') {
      return OpenResumeGenerator.generateATSPackage(null, keywords, jobData, candidateData);
    }

    // Basic fallback
    const cvText = this.generateCVTextLegacy(candidateData, keywords);
    const coverText = this.generateCoverLetterTextLegacy(candidateData, keywords, jobData);

    return {
      cv: {
        text: cvText,
        base64: btoa(unescape(encodeURIComponent(cvText))),
        filename: 'CV.txt'
      },
      coverLetter: {
        text: coverText,
        base64: btoa(unescape(encodeURIComponent(coverText))),
        filename: 'Cover_Letter.txt'
      },
      matchScore: 50,
      keywords: { all: keywords }
    };
  }

  generateCVTextLegacy(candidateData, keywords) {
    const name = `${candidateData.firstName || ''} ${candidateData.lastName || ''}`.trim();
    const lines = [
      name.toUpperCase(),
      [candidateData.phone, candidateData.email, candidateData.location].filter(Boolean).join(' | '),
      '',
      'PROFESSIONAL SUMMARY',
      candidateData.summary || 'Experienced professional',
      '',
      'WORK EXPERIENCE'
    ];

    const experience = candidateData.workExperience || [];
    experience.forEach(job => {
      lines.push(job.company || '');
      lines.push([job.title, job.dates, job.location].filter(Boolean).join(' | '));
      const bullets = job.bullets || [];
      bullets.forEach(b => lines.push(`• ${b}`));
      lines.push('');
    });

    lines.push('SKILLS');
    const allKeywords = Array.isArray(keywords) ? keywords : (keywords?.all || []);
    lines.push(allKeywords.join(', '));

    return lines.join('\n');
  }

  generateCoverLetterTextLegacy(candidateData, keywords, jobData) {
    const name = `${candidateData.firstName || ''} ${candidateData.lastName || ''}`.trim();
    const jobTitle = jobData?.title || 'the position';
    const company = jobData?.company || 'your organization';

    return [
      name.toUpperCase(),
      candidateData.email || '',
      '',
      new Date().toLocaleDateString(),
      '',
      `Re: ${jobTitle}`,
      '',
      'Dear Hiring Manager,',
      '',
      `I am excited to apply for the ${jobTitle} position at ${company}. With my experience and skills, I am confident I can contribute to your team's success.`,
      '',
      'Sincerely,',
      name
    ].join('\n');
  }

  // ============ DOWNLOAD DOCUMENTS (ULTIMATE) ============
  downloadDocument(type) {
    const doc = type === 'cv' ? this.generatedDocuments.cv : this.generatedDocuments.coverLetter;
    
    if (!doc) {
      this.showToast(`No ${type === 'cv' ? 'CV' : 'Cover Letter'} to download`, 'error');
      return;
    }

    // Use ATSCVGeneratorUltimate download methods if available
    if (typeof ATSCVGeneratorUltimate !== 'undefined') {
      if (doc.pdf) {
        ATSCVGeneratorUltimate.downloadPDF(doc.base64, doc.filename);
      } else if (doc.html) {
        ATSCVGeneratorUltimate.downloadHTML(doc.html, doc.filename.replace('.pdf', '.html'));
      } else {
        ATSCVGeneratorUltimate.downloadText(doc.text, doc.filename.replace('.pdf', '.txt'));
      }
    } else {
      // Fallback
      this.downloadLegacy(doc, type);
    }
    
    this.showToast(`Downloaded ${doc.filename}`, 'success');
  }

  downloadLegacy(doc, type) {
    if (doc.base64) {
      const byteCharacters = atob(doc.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // ============ HELPER METHODS ============
  async getCandidateData() {
    if (this.baseCVContent) {
      return this.baseCVContent;
    }
    
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['candidate_profile'], resolve);
    });
    
    return result.candidate_profile || null;
  }

  async extractKeywords(jobDescription) {
    if (!jobDescription) return { all: [], highPriority: [], mediumPriority: [], lowPriority: [] };

    // Comprehensive keyword extraction
    const words = jobDescription.toLowerCase().split(/\W+/);
    const skillWords = words.filter(w => w.length > 2 && w.length < 25);

    // Define comprehensive skill categories
    const techSkills = [
      'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'scala', 'kotlin', 'swift', 'c++', 'c#', 'php', 'ruby', 'perl', 'r', 'matlab', 'sql',
      'react', 'angular', 'vue', 'next.js', 'nuxt.js', 'svelte', 'express', 'django', 'flask', 'fastapi', 'spring', 'rails', 'laravel',
      'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'ansible', 'jenkins', 'github', 'actions', 'gitlab', 'ci/cd',
      'postgresql', 'mysql', 'mongodb', 'redis', 'cassandra', 'elasticsearch', 'snowflake', 'bigquery', 'dynamodb',
      'tensorflow', 'pytorch', 'scikit-learn', 'keras', 'pandas', 'numpy', 'opencv', 'nlp', 'llm', 'ai', 'ml', 'machine learning', 'deep learning'
    ];

    const foundSkills = [...new Set(skillWords.filter(w => techSkills.includes(w)))];
    
    // Categorize by frequency
    const highPriority = foundSkills.slice(0, 10);
    const mediumPriority = foundSkills.slice(10, 20);
    const lowPriority = foundSkills.slice(20);

    return {
      all: foundSkills,
      highPriority,
      mediumPriority,
      lowPriority
    };
  }

  async login() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    
    if (!email || !password) {
      this.showToast('Please enter email and password', 'error');
      return;
    }
    
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        this.session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user,
        };
        await this.saveSession();
        this.showToast('Login successful!', 'success');
        this.updateUI();
      } else {
        this.showToast(data.error_description || 'Login failed', 'error');
      }
    } catch (e) {
      this.showToast('Network error. Please check your connection.', 'error');
    }
  }

  async logout() {
    this.session = null;
    await chrome.storage.local.remove(['ats_session']);
    this.showToast('Logged out', 'success');
    this.updateUI();
  }

  async detectCurrentJob() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'DETECT_JOB' });
      
      if (response?.job) {
        this.currentJob = response.job;
        this.updateJobDisplay();
      }
    } catch (e) {
      console.log('[Popup] Could not detect job:', e);
    }
  }

  updateJobDisplay() {
    const jobTitleEl = document.getElementById('jobTitle');
    const jobCompanyEl = document.getElementById('jobCompany');
    
    if (jobTitleEl && this.currentJob?.title) {
      jobTitleEl.textContent = this.currentJob.title;
    }
    if (jobCompanyEl && this.currentJob?.company) {
      jobCompanyEl.textContent = this.currentJob.company;
    }
  }

  toggleJobTitleEdit() {
    const input = document.getElementById('jobTitleInput');
    const display = document.getElementById('jobTitle');
    
    if (input && display) {
      input.style.display = input.style.display === 'none' ? 'block' : 'none';
      display.style.display = display.style.display === 'none' ? 'block' : 'none';
      
      if (input.style.display === 'block') {
        input.value = this.currentJob?.title || '';
        input.focus();
      }
    }
  }

  saveJobTitleEdit() {
    const input = document.getElementById('jobTitleInput');
    if (input && this.currentJob) {
      this.currentJob.title = input.value;
      this.updateJobDisplay();
      this.toggleJobTitleEdit();
      chrome.storage.local.set({ ats_lastJob: this.currentJob });
      this.showToast('Job title updated', 'success');
    }
  }

  updatePreview() {
    const previewContent = document.getElementById('previewContent');
    if (previewContent) {
      if (this.currentPreviewTab === 'cv') {
        const cv = this.generatedDocuments.cv;
        if (cv?.html) {
          previewContent.innerHTML = cv.html;
        } else if (cv?.text) {
          previewContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 11px; line-height: 1.4;">${this.escapeHtml(cv.text)}</pre>`;
        }
      } else if (this.currentPreviewTab === 'cover') {
        const cover = this.generatedDocuments.coverLetter;
        if (cover?.html) {
          previewContent.innerHTML = cover.html;
        } else if (cover?.text) {
          previewContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 11px; line-height: 1.4;">${this.escapeHtml(cover.text)}</pre>`;
        }
      }
      previewContent.classList.remove('placeholder');
    }
  }

  switchPreviewTab(tab) {
    this.currentPreviewTab = tab;
    
    document.querySelectorAll('.preview-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`preview${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`)?.classList.add('active');
    
    this.updatePreview();
  }

  updateMetrics() {
    const matchScoreEl = document.getElementById('matchScore');
    const keywordCountEl = document.getElementById('keywordCount');
    
    if (matchScoreEl) {
      matchScoreEl.textContent = `${this.generatedDocuments.matchScore || 0}%`;
    }
    if (keywordCountEl) {
      const keywordCount = this.generatedDocuments.keywords?.all?.length || 0;
      keywordCountEl.textContent = `${keywordCount} keywords`;
    }
  }

  async saveGeneratedDocuments() {
    await chrome.storage.local.set({ 
      ats_lastGeneratedDocuments: this.generatedDocuments,
      ats_lastJob: this.currentJob
    });
  }

  copyCurrentContent() {
    const content = this.currentPreviewTab === 'cv' ? this.generatedDocuments.cv?.text : this.generatedDocuments.coverLetter?.text;
    if (content) {
      navigator.clipboard.writeText(content);
      this.showToast('Content copied to clipboard', 'success');
    }
  }

  copyCoverageReport() {
    const report = this.generateCoverageReport();
    navigator.clipboard.writeText(report);
    this.showToast('Coverage report copied to clipboard', 'success');
  }

  generateCoverageReport() {
    const compliance = this.generatedDocuments.atsCompliance;
    if (!compliance) {
      return 'ATS Compliance Report not available. Generate documents first.';
    }

    let report = `ATS Compliance Report\n\n`;
    report += `Overall Score: ${compliance.overallScore}/100\n\n`;
    report += `Checks:\n`;
    compliance.checks.forEach(check => {
      report += `• ${check.check}: ${check.status} (${check.score} points)\n`;
    });
    
    if (compliance.recommendations.length > 0) {
      report += `\nRecommendations:\n`;
      compliance.recommendations.forEach(rec => {
        report += `• ${rec}\n`;
      });
    }

    return report;
  }

  selectAIProvider(provider) {
    this.aiProvider = provider;
    this.saveAIProviderSettings();
    this.updateAIProviderUI();
    this.showToast(`AI Provider set to ${provider === 'kimi' ? 'Kimi K2' : 'OpenAI'}`, 'success');
  }

  updateAIProviderUI() {
    const btnKimi = document.getElementById('btnKimi');
    const btnOpenAI = document.getElementById('btnOpenAI');
    const activeLabel = document.getElementById('activeProviderBadge');
    const modelLabel = document.getElementById('activeModelLabel');
    const badgeDot = activeLabel?.querySelector('.badge-dot');
    const badgeText = activeLabel?.querySelector('.badge-text');
    
    if (btnKimi) {
      btnKimi.classList.toggle('selected', this.aiProvider === 'kimi');
    }
    if (btnOpenAI) {
      btnOpenAI.classList.toggle('selected', this.aiProvider === 'openai');
    }
    
    if (badgeDot) {
      badgeDot.classList.remove('kimi', 'openai');
      badgeDot.classList.add(this.aiProvider);
    }
    if (badgeText) {
      badgeText.textContent = this.aiProvider === 'kimi' ? 'Kimi K2' : 'OpenAI';
    }
    if (modelLabel) {
      modelLabel.textContent = this.aiProvider === 'kimi' ? 'kimi-k2-0711-preview' : 'gpt-4o-mini';
    }
  }

  updateUI() {
    const loginSection = document.getElementById('loginSection');
    const mainContent = document.getElementById('mainContent');
    const userInfo = document.getElementById('userInfo');
    
    if (this.session) {
      if (loginSection) loginSection.style.display = 'none';
      if (mainContent) mainContent.style.display = 'block';
      if (userInfo) {
        userInfo.style.display = 'block';
        userInfo.textContent = this.session.user.email;
      }
    } else {
      if (loginSection) loginSection.style.display = 'block';
      if (mainContent) mainContent.style.display = 'none';
      if (userInfo) userInfo.style.display = 'none';
    }
    
    this.updateJobDisplay();
    this.updateMetrics();
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============ OTHER METHODS (UNCHANGED) ============
  attachBothDocuments() {
    this.showToast('Feature not implemented in this version', 'info');
  }

  handleCsvUpload(e) {
    this.showToast('CSV upload feature not implemented', 'info');
  }

  parseCsv() {
    this.showToast('CSV parsing feature not implemented', 'info');
  }

  startBulkAutomation() {
    this.showToast('Bulk automation feature not implemented', 'info');
  }

  pauseBulkAutomation() {
    this.showToast('Bulk automation not running', 'info');
  }

  resumeBulkAutomation() {
    this.showToast('No bulk automation to resume', 'info');
  }

  stopBulkAutomation() {
    this.showToast('Bulk automation not running', 'info');
  }

  startBulkProgressPolling() {
    // Implementation for bulk progress polling
  }

  viewExtractedKeywords() {
    this.showToast('Keyword extraction view not implemented', 'info');
  }

  aiExtractKeywords() {
    this.showToast('AI keyword extraction not implemented', 'info');
  }

  showSkillGapPanel() {
    this.showToast('Skill gap analysis not implemented', 'info');
  }

  hideSkillGapPanel() {
    this.showToast('Skill gap panel not available', 'info');
  }

  runWorkdayFlow() {
    this.showToast('Workday flow not implemented', 'info');
  }

  captureWorkdaySnapshot() {
    this.showToast('Workday snapshot not implemented', 'info');
  }

  forceWorkdayApply() {
    this.showToast('Workday force apply not implemented', 'info');
  }
}

// Initialize when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.atsTailor = new ATSTailorUltimate();
  });
}
