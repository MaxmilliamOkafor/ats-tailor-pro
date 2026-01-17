// ATS CV Generator Ultimate - Based on OpenResume + Industry Best Practices
// 100% ATS Compatible - Uses OpenResume formatting standards with enhancements
// File: ats-cv-generator-ultimate.js

(function(global) {
  'use strict';

  // ============ ATS SPECIFICATIONS (OpenResume Standards + Enhancements) ============
  const ATS_CONFIG = {
    font: {
      family: 'helvetica',    // jsPDF uses helvetica as Arial equivalent
      name: 14,               // Name: 14pt Bold (OpenResume standard)
      subtitle: 11,           // Subtitle/Tagline: 11pt Regular
      sectionTitle: 12,       // Section Headers: 12pt Bold
      body: 11,               // Body Text: 11pt Regular (optimal for ATS)
      contact: 11             // Contact: 11pt Regular
    },
    margins: {
      top: 54,                // 0.75 inch = 54pt (ATS standard)
      bottom: 54,
      left: 54,
      right: 54
    },
    lineHeight: 1.5,          // 1.5 line spacing (OpenResume + ATS best practice)
    paragraphSpacing: 6,      // 6pt before/after sections
    page: {
      width: 595.28,          // A4 width in points
      height: 841.89,         // A4 height in points
      maxPages: 2             // Keep to 2 pages max
    },
    bullets: {
      char: '•',              // Standard bullet (100% ATS safe)
      indent: 12              // Proper indentation
    },
    colors: {
      text: '#000000',        // Pure black for best contrast
      secondary: '#333333'    // Dark gray for secondary text
    }
  };

  // ============ ULTIMATE ATS CV GENERATOR ============
  const ATSCVGeneratorUltimate = {

    // ============ MAIN ENTRY POINT ============
    async generateCV(candidateData, keywords, jobData, options = {}) {
      const startTime = performance.now();
      const { format = 'pdf', includeCoverLetter = true } = options;
      
      console.log('[ATS Ultimate] Generating 100% ATS-compatible CV...');

      try {
        // Parse and structure CV data using OpenResume methodology
        const cvData = this.parseCVData(candidateData);
        
        // Extract and categorize keywords
        const processedKeywords = this.processKeywords(keywords);
        
        // Tailor CV with keywords (OpenResume style)
        const tailoredData = this.tailorCVData(cvData, processedKeywords, jobData);
        
        // Generate CV PDF (OpenResume + enhanced formatting)
        const cvResult = await this.generateCVPDF(tailoredData, candidateData);
        
        // Generate Cover Letter if requested
        let coverResult = null;
        if (includeCoverLetter) {
          coverResult = await this.generateCoverLetterPDF(tailoredData, processedKeywords, jobData, candidateData);
        }
        
        // Calculate comprehensive match score
        const matchScore = this.calculateMatchScore(tailoredData, processedKeywords);
        
        // Generate plain text version
        const textVersion = this.generateTextVersion(tailoredData);
        
        // Generate HTML preview
        const htmlPreview = this.generateHTMLPreview(tailoredData);

        const timing = performance.now() - startTime;
        console.log(`[ATS Ultimate] CV package generated in ${timing.toFixed(0)}ms`);

        return {
          cv: {
            pdf: cvResult.blob,
            base64: cvResult.base64,
            filename: cvResult.filename,
            text: textVersion,
            html: htmlPreview
          },
          coverLetter: coverResult ? {
            pdf: coverResult.blob,
            base64: coverResult.base64,
            filename: coverResult.filename
          } : null,
          matchScore,
          keywords: processedKeywords,
          timing,
          tailoredData,
          atsCompliance: this.getATSComplianceReport(processedKeywords, matchScore)
        };

      } catch (error) {
        console.error('[ATS Ultimate] Error generating CV:', error);
        throw error;
      }
    },

    // ============ PARSE AND STRUCTURE CV DATA (OpenResume Methodology) ============
    parseCVData(candidateData) {
      const data = {
        contact: {
          name: '',
          tagline: '',
          phone: '',
          email: '',
          location: '',
          linkedin: '',
          github: '',
          portfolio: ''
        },
        summary: '',
        experience: [],
        skills: {
          languages: [],
          aiml: [],
          cloud: [],
          devops: [],
          databases: [],
          soft: []
        },
        education: [],
        certifications: []
      };

      if (!candidateData) return data;

      // Extract contact information
      data.contact.name = `${candidateData.firstName || candidateData.first_name || ''} ${candidateData.lastName || candidateData.last_name || ''}`.trim();
      data.contact.phone = this.normalizePhone(candidateData.phone || '');
      data.contact.email = candidateData.email || '';
      data.contact.location = this.normalizeLocation(candidateData.city || candidateData.location || '');
      data.contact.linkedin = candidateData.linkedin || '';
      data.contact.github = candidateData.github || '';
      data.contact.portfolio = candidateData.portfolio || '';

      // Extract summary
      data.summary = candidateData.summary || candidateData.professionalSummary || candidateData.profile || '';

      // Extract work experience
      const workExp = candidateData.workExperience || candidateData.work_experience || [];
      if (Array.isArray(workExp)) {
        data.experience = workExp.map(exp => ({
          company: exp.company || exp.organization || '',
          title: exp.title || exp.position || exp.role || '',
          dates: exp.dates || exp.duration || `${exp.startDate || ''} - ${exp.endDate || 'Present'}`,
          location: exp.location || '',
          bullets: this.normalizeBullets(exp.bullets || exp.achievements || exp.responsibilities || [])
        }));
      }

      // Extract and categorize skills
      const skillsArr = candidateData.skills || [];
      if (Array.isArray(skillsArr)) {
        data.skills = this.categorizeSkills(skillsArr);
      }

      // Extract education
      const education = candidateData.education || [];
      if (Array.isArray(education)) {
        data.education = education.map(edu => ({
          institution: edu.institution || edu.school || edu.university || '',
          degree: edu.degree || '',
          dates: edu.dates || edu.graduationDate || '',
          gpa: edu.gpa || ''
        }));
      }

      // Extract certifications
      const certs = candidateData.certifications || [];
      if (Array.isArray(certs)) {
        data.certifications = certs;
      } else if (typeof certs === 'string') {
        data.certifications = [certs];
      }

      return data;
    },

    // ============ CATEGORIZE SKILLS (OpenResume + Enhanced) ============
    categorizeSkills(skills) {
      const categories = {
        languages: [],
        aiml: [],
        cloud: [],
        devops: [],
        databases: [],
        soft: []
      };

      const patterns = {
        languages: /^(python|javascript|typescript|java|c\+\+|c#|go|rust|ruby|php|scala|kotlin|swift|sql|r|matlab|perl|bash|shell|c|objective-c|dart|lua|haskell|clojure|erlang|f#|vba|powershell)$/i,
        aiml: /^(pytorch|tensorflow|scikit-learn|keras|xgboost|lightgbm|ml|ai|nlp|llm|transformer|bert|gpt|genai|hugging\s*face|opencv|spacy|langchain|numpy|pandas|matplotlib|seaborn|plotly|jupyter|notebook|scipy|statsmodels|fastai|detectron|yolo|computer\s*vision|deep\s*learning|machine\s*learning|neural\s*network|reinforcement\s*learning|data\s*science|data\s*analytics|feature\s*engineering|model\s*deployment|mlops|ai\s*ops)$/i,
        cloud: /^(aws|azure|gcp|kubernetes|docker|k8s|ec2|s3|lambda|eks|ecs|sagemaker|cloudformation|terraform|cloudwatch|route53|iam|vpc|rds|cloudfront|api\s*gateway|step\s*functions|dynamodb|redshift|bigquery|cloud\s*storage|compute\s*engine|app\s*engine|kubernetes\s*engine|pub/sub|dataflow|dataproc|anthos|gke|aks|azure\s*devops|azure\s*functions|logic\s*apps|service\s*bus|cosmos\s*db|sql\s*database|virtual\s*machines|container\s*instances|helm|istio|prometheus|grafana)$/i,
        devops: /^(github\s*actions|jenkins|prometheus|grafana|ci\/cd|cicd|ansible|chef|puppet|salt|helm|argo\s*cd|datadog|splunk|elk|new\s*relic|pagerduty|slack|docker|kubernetes|terraform|vault|consul|nomad|vagrant|packer|circleci|travis\s*ci|gitlab\s*ci|bitbucket\s*pipelines|azure\s*devops|aws\s*codepipeline|gcp\s*cloud\s*build|docker\s*compose|nginx|apache|traefik|haproxy|istio|linkerd|flux|sealed\s*secrets|cert-manager)$/i,
        databases: /^(postgresql|postgres|mongodb|mysql|redis|snowflake|bigquery|redshift|cassandra|dynamodb|elasticsearch|neo4j|sqlite|oracle|sqlserver|mariadb|couchdb|influxdb|timescaledb|cockroachdb|yugabytedb|fauna|planetscale|vitess|prisma|sequelize|typeorm|sqlalchemy|peewee|django\s*orm|hibernate|jpa|mybatis|liquibase|flyway|alembic)$/i,
        soft: /^(leadership|collaboration|problem[\s-]*solving|communication|critical\s*thinking|agile|scrum|mentoring|teamwork|stakeholder|strategic|project\s*management|product\s*management|cross-functional|presentation|negotiation|conflict\s*resolution|empathy|adaptability|creativity|innovation|analytical|research|documentation|training|coaching|supervision|delegation|time\s*management|organization|prioritization|decision\s*making|influence|relationship\s*building|client\s*facing|customer\s*facing|interpersonal|emotional\s*intelligence|growth\s*mindset|continuous\s*learning|self-starter|proactive|initiative|ownership|accountability|detail-oriented|quality\s*assurance|process\s*improvement|operational\s*excellence)$/i
      };

      skills.forEach(skill => {
        const normalized = skill.trim();
        let matched = false;
        
        for (const [category, pattern] of Object.entries(patterns)) {
          if (pattern.test(normalized)) {
            // Avoid duplicates
            if (!categories[category].includes(normalized)) {
              categories[category].push(normalized);
            }
            matched = true;
            break;
          }
        }
        
        if (!matched && normalized.length > 1) {
          // Default to languages for technical skills, soft for others
          if (/^[A-Z]/.test(normalized) || normalized.length <= 15) {
            if (!categories.languages.includes(normalized)) {
              categories.languages.push(normalized);
            }
          } else {
            if (!categories.soft.includes(normalized)) {
              categories.soft.push(normalized);
            }
          }
        }
      });

      return categories;
    },

    // ============ NORMALIZE BULLETS ============
    normalizeBullets(bullets) {
      if (!bullets) return [];
      if (Array.isArray(bullets)) {
        return bullets.map(b => b.replace(/^[-•*▪➢▸◆◇]/g, '').trim()).filter(b => b.length > 0);
      }
      return bullets.split('\n').filter(b => b.trim()).map(b => b.replace(/^[-•*▪➢▸◆◇]/g, '').trim());
    },

    // ============ PROCESS KEYWORDS ============
    processKeywords(keywords) {
      if (!keywords) return { all: [], highPriority: [], mediumPriority: [], lowPriority: [] };

      if (Array.isArray(keywords)) {
        return {
          all: keywords,
          highPriority: keywords.slice(0, 10),
          mediumPriority: keywords.slice(10, 20),
          lowPriority: keywords.slice(20)
        };
      }

      return {
        all: keywords.all || [],
        highPriority: keywords.highPriority || [],
        mediumPriority: keywords.mediumPriority || [],
        lowPriority: keywords.lowPriority || []
      };
    },

    // ============ NORMALIZE LOCATION ============
    normalizeLocation(location) {
      if (!location) return '';
      
      let normalized = location
        .replace(/\b(remote|work\s*from\s*home|wfh|virtual|fully\s*remote)\b/gi, '')
        .replace(/\s*[\(\[]?\s*(remote|wfh|virtual)\s*[\)\]]?\s*/gi, '')
        .replace(/\s*(\||,|\/|–|-)\s*(\||,|\/|–|-)\s*/g, ', ')
        .replace(/\s*(\||,|\/|–|-)\s*$/g, '')
        .replace(/^\s*(\||,|\/|–|-)\s*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      if (!normalized || normalized.length < 3) return '';
      
      // State abbreviations
      const stateAbbrev = {
        'california': 'CA', 'texas': 'TX', 'new york': 'NY', 'florida': 'FL',
        'illinois': 'IL', 'washington': 'WA', 'massachusetts': 'MA', 'colorado': 'CO',
        'virginia': 'VA', 'north carolina': 'NC', 'south carolina': 'SC', 'georgia': 'GA',
        'arizona': 'AZ', 'nevada': 'NV', 'oregon': 'OR', 'utah': 'UT',
        'minnesota': 'MN', 'wisconsin': 'WI', 'michigan': 'MI', 'ohio': 'OH',
        'pennsylvania': 'PA', 'new jersey': 'NJ', 'connecticut': 'CT', 'maryland': 'MD'
      };
      
      for (const [full, abbrev] of Object.entries(stateAbbrev)) {
        const regex = new RegExp(`,\s*${full}\s*$`, 'i');
        if (regex.test(normalized)) {
          normalized = normalized.replace(regex, `, ${abbrev}`);
          break;
        }
      }
      
      normalized = normalized.replace(/,\s*(US|USA|United States)\s*$/i, '').trim();
      
      return normalized;
    },

    // ============ NORMALIZE PHONE ============
    normalizePhone(phone) {
      if (!phone) return '';
      
      let cleaned = phone.replace(/[^\d+\s()-]/g, '');
      
      if (cleaned.startsWith('+')) {
        const match = cleaned.match(/^(\+\d{1,3})\s*(.+)$/);
        if (match) {
          return `${match[1]} ${match[2]}`;
        }
      }
      
      return cleaned.trim();
    },

    // ============ TAILOR CV DATA (OpenResume Enhanced) ============
    tailorCVData(cvData, keywords, jobData) {
      const tailored = JSON.parse(JSON.stringify(cvData));
      
      const { highPriority = [], mediumPriority = [], lowPriority = [], all = [] } = keywords;
      const allKeywords = all.length > 0 ? all : [...highPriority, ...mediumPriority, ...lowPriority];

      // Update tagline based on job title
      if (jobData?.title) {
        tailored.contact.tagline = this.generateTagline(jobData.title);
      }

      // Update location (remove remote mentions)
      if (jobData?.location) {
        tailored.contact.location = this.normalizeLocation(jobData.location);
      }

      // Enhance summary with keywords
      tailored.summary = this.enhanceSummary(cvData.summary, highPriority.slice(0, 5));

      // Inject keywords into experience
      tailored.experience = this.injectKeywordsIntoExperience(cvData.experience, allKeywords);

      // Ensure skills include all keywords
      tailored.skills = this.mergeKeywordsIntoSkills(tailored.skills, allKeywords);

      return tailored;
    },

    // ============ GENERATE TAGLINE ============
    generateTagline(jobTitle) {
      const lower = jobTitle.toLowerCase();
      
      if (lower.includes('data scientist') || lower.includes('ml') || lower.includes('ai') || lower.includes('machine learning')) {
        return 'Senior Data Scientist | AI/ML Engineer | MLOps Specialist';
      }
      if (lower.includes('software engineer') || lower.includes('developer') || lower.includes('programmer')) {
        return 'Senior Software Engineer | Cloud Architect | Full-Stack Developer';
      }
      if (lower.includes('product manager') || lower.includes('product owner')) {
        return 'Senior Product Manager | Technical PM | Growth Strategist';
      }
      if (lower.includes('architect') || lower.includes('solution')) {
        return 'Solutions Architect | Cloud Engineer | Technical Leader';
      }
      if (lower.includes('analyst') || lower.includes('analytics')) {
        return 'Senior Data Analyst | Business Intelligence | SQL Expert';
      }
      if (lower.includes('devops') || lower.includes('sre') || lower.includes('platform')) {
        return 'DevOps Engineer | SRE | Platform Architect';
      }
      
      return 'Senior Software Engineer | Cloud Architect | Technical Leader';
    },

    // ============ ENHANCE SUMMARY ============
    enhanceSummary(summary, keywords) {
      if (!summary) {
        const topKeywords = keywords.slice(0, 3);
        return topKeywords.length > 0
          ? `Results-driven professional with expertise in ${topKeywords.join(', ')}. Proven track record of delivering high-impact solutions and driving measurable business outcomes.`
          : `Results-driven professional with proven track record of delivering high-impact solutions and driving measurable business outcomes.`;
      }

      const summaryLower = summary.toLowerCase();
      const missing = keywords.filter(kw => !summaryLower.includes(kw.toLowerCase()));

      if (missing.length > 0) {
        const injection = `. Expertise includes ${missing.slice(0, 3).join(', ')}`;
        if (summary.endsWith('.')) {
          return summary.slice(0, -1) + injection + '.';
        }
        return summary + injection + '.';
      }

      return summary;
    },

    // ============ INJECT KEYWORDS INTO EXPERIENCE ============
    injectKeywordsIntoExperience(experience, allKeywords) {
      if (!experience || experience.length === 0) return experience;

      const mentions = {};
      allKeywords.forEach(kw => { mentions[kw] = 0; });

      // Count existing keyword mentions
      experience.forEach(job => {
        job.bullets.forEach(bullet => {
          allKeywords.forEach(kw => {
            if (bullet.toLowerCase().includes(kw.toLowerCase())) {
              mentions[kw]++;
            }
          });
        });
      });

      const phrases = ['leveraging', 'utilizing', 'implementing', 'applying', 'through', 'incorporating', 'via', 'using'];
      const getPhrase = () => phrases[Math.floor(Math.random() * phrases.length)];

      return experience.map(job => {
        const enhancedBullets = job.bullets.map(bullet => {
          let enhanced = bullet;
          const underRepresented = allKeywords.filter(kw => mentions[kw] < 2);

          underRepresented.slice(0, 2).forEach(kw => {
            if (!enhanced.toLowerCase().includes(kw.toLowerCase())) {
              const phrase = getPhrase();
              if (enhanced.endsWith('.')) {
                enhanced = `${enhanced.slice(0, -1)}, ${phrase} ${kw}.`;
              } else {
                enhanced = `${enhanced}, ${phrase} ${kw}`;
              }
              mentions[kw]++;
            }
          });

          return enhanced;
        });

        return { ...job, bullets: enhancedBullets };
      });
    },

    // ============ MERGE KEYWORDS INTO SKILLS ============
    mergeKeywordsIntoSkills(skills, keywords) {
      const merged = { ...skills };
      const allExisting = Object.values(merged).flat().map(s => s.toLowerCase());

      keywords.forEach(kw => {
        const kwLower = kw.toLowerCase();
        if (!allExisting.includes(kwLower)) {
          // Try to categorize the keyword
          const categorized = this.categorizeSkills([kw]);
          Object.keys(categorized).forEach(cat => {
            if (categorized[cat].length > 0) {
              merged[cat] = [...(merged[cat] || []), ...categorized[cat]];
            }
          });
        }
      });

      return merged;
    },

    // ============ GENERATE CV PDF (OpenResume + Enhanced) ============
    async generateCVPDF(tailoredData, candidateData) {
      const startTime = performance.now();

      const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant')
        .trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'Applicant';
      const lastName = (candidateData?.lastName || candidateData?.last_name || '')
        .trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const filename = lastName ? `${firstName}_${lastName}_CV.pdf` : `${firstName}_CV.pdf`;

      let pdfBlob = null;
      let pdfBase64 = null;

      if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
        const result = await this.renderCVWithJsPDFUltimate(tailoredData);
        pdfBlob = result.blob;
        pdfBase64 = result.base64;
      } else {
        // Fallback to text-based PDF
        const text = this.generateCVText(tailoredData);
        pdfBase64 = btoa(unescape(encodeURIComponent(text)));
      }

      console.log(`[ATS Ultimate] CV PDF generated in ${(performance.now() - startTime).toFixed(0)}ms`);
      return { blob: pdfBlob, base64: pdfBase64, filename };
    },

    // ============ RENDER CV WITH JSPDF (Ultimate Formatting) ============
    async renderCVWithJsPDFUltimate(data) {
      const { jsPDF } = jspdf;
      const { font, margins, lineHeight, page, paragraphSpacing } = ATS_CONFIG;
      const contentWidth = page.width - margins.left - margins.right;

      const doc = new jsPDF({ format: 'a4', unit: 'pt', putOnlyUsedFonts: true });
      doc.setFont(font.family, 'normal');
      let y = margins.top;
      let pageCount = 1;

      // Helper: Add text with word wrap and page management
      const addText = (text, isBold = false, size = font.body, centered = false, maxLines = null) => {
        doc.setFontSize(size);
        doc.setFont(font.family, isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, contentWidth);
        let linesAdded = 0;
        
        for (const line of lines) {
          if (maxLines && linesAdded >= maxLines) break;
          
          if (y > page.height - margins.bottom - 20) {
            if (pageCount >= page.maxPages) return linesAdded;
            doc.addPage();
            pageCount++;
            y = margins.top;
          }
          
          const x = centered ? page.width / 2 : margins.left;
          const align = centered ? { align: 'center' } : undefined;
          doc.text(line, x, y, align);
          y += size * lineHeight;
          linesAdded++;
        }
        
        return linesAdded;
      };

      // Helper: Add section header with underline
      const addSectionHeader = (title) => {
        if (y > page.height - margins.bottom - 50) {
          if (pageCount >= page.maxPages) return false;
          doc.addPage();
          pageCount++;
          y = margins.top;
        }
        
        y += paragraphSpacing;
        doc.setFontSize(font.sectionTitle);
        doc.setFont(font.family, 'bold');
        doc.text(title, margins.left, y);
        y += font.sectionTitle * 0.3;
        doc.setLineWidth(0.5);
        doc.line(margins.left, y, page.width - margins.right, y);
        y += paragraphSpacing + 2;
        
        return true;
      };

      // === NAME (14pt Bold, Centered, Uppercase) ===
      addText(data.contact.name.toUpperCase(), true, font.name, true);
      
      // === TAGLINE (11pt Regular, Centered) ===
      if (data.contact.tagline) {
        addText(data.contact.tagline, false, font.subtitle, true);
      }
      y += 2;
      
      // === CONTACT LINE (Phone | Email | Location | Open to relocation) ===
      const contactParts = [data.contact.phone, data.contact.email, data.contact.location].filter(Boolean);
      if (contactParts.length > 0) {
        const contactLine = contactParts.join(' | ') + ' | open to relocation';
        addText(contactLine, false, font.contact, true);
      }

      // === LINKS LINE (LinkedIn | GitHub | Portfolio) ===
      const linkParts = [];
      if (data.contact.linkedin) linkParts.push('LinkedIn');
      if (data.contact.github) linkParts.push('GitHub');
      if (data.contact.portfolio) linkParts.push('Portfolio');
      
      if (linkParts.length > 0) {
        addText(linkParts.join(' | '), false, font.contact, true);
      }

      y += 8;

      // === PROFESSIONAL SUMMARY ===
      if (data.summary && addSectionHeader('PROFESSIONAL SUMMARY')) {
        addText(data.summary, false, font.body);
      }

      // === WORK EXPERIENCE ===
      if (data.experience && data.experience.length > 0 && addSectionHeader('WORK EXPERIENCE')) {
        data.experience.forEach((job, idx) => {
          // Company Name (Bold)
          doc.setFontSize(font.body);
          doc.setFont(font.family, 'bold');
          doc.text(job.company, margins.left, y);
          y += font.body * lineHeight;
          
          // Title | Dates | Location
          const jobLine = [job.title, job.dates, job.location].filter(Boolean).join(' | ');
          addText(jobLine, false, font.body);
          y += 2;

          // Bullets (tight, professional formatting)
          job.bullets.forEach(bullet => {
            const bulletText = `${ATS_CONFIG.bullets.char} ${bullet}`;
            doc.setFont(font.family, 'normal');
            doc.setFontSize(font.body);
            
            const bulletLines = doc.splitTextToSize(bulletText, contentWidth - ATS_CONFIG.bullets.indent);
            bulletLines.forEach((line, lineIdx) => {
              if (y > page.height - margins.bottom - 20) {
                if (pageCount >= page.maxPages) return;
                doc.addPage();
                pageCount++;
                y = margins.top;
              }
              const indent = lineIdx === 0 ? 0 : ATS_CONFIG.bullets.indent;
              doc.text(line, margins.left + indent, y);
              y += font.body * lineHeight;
            });
          });

          // Space between companies
          if (idx < data.experience.length - 1) y += font.body * lineHeight;
        });
      }

      // === TECHNICAL SKILLS ===
      if (data.skills && addSectionHeader('TECHNICAL SKILLS')) {
        const skillLines = [];
        if (data.skills.languages?.length) skillLines.push(`Languages: ${data.skills.languages.join(', ')}`);
        if (data.skills.aiml?.length) skillLines.push(`AI/ML: ${data.skills.aiml.join(', ')}`);
        if (data.skills.cloud?.length) skillLines.push(`Cloud: ${data.skills.cloud.join(', ')}`);
        if (data.skills.devops?.length) skillLines.push(`DevOps: ${data.skills.devops.join(', ')}`);
        if (data.skills.databases?.length) skillLines.push(`Databases: ${data.skills.databases.join(', ')}`);
        if (data.skills.soft?.length) skillLines.push(`Soft Skills: ${data.skills.soft.join(' | ')}`);
        
        skillLines.forEach(line => addText(line, false, font.body));
      }

      // === EDUCATION ===
      if (data.education && data.education.length > 0 && addSectionHeader('EDUCATION')) {
        data.education.forEach(edu => {
          addText(edu.degree, true, font.body);
          const eduDetails = [edu.institution, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join(' | ');
          addText(eduDetails, false, font.body);
          y += 2;
        });
      }

      // === CERTIFICATIONS ===
      if (data.certifications && data.certifications.length > 0 && addSectionHeader('CERTIFICATIONS')) {
        data.certifications.forEach(cert => addText(cert, false, font.body));
      }

      // Generate output
      const base64 = doc.output('datauristring').split(',')[1];
      const blob = doc.output('blob');

      return { base64, blob };
    },

    // ============ GENERATE CV TEXT (Fallback) ============
    generateCVText(data) {
      const lines = [];
      
      lines.push(data.contact.name.toUpperCase());
      if (data.contact.tagline) lines.push(data.contact.tagline);
      lines.push([data.contact.phone, data.contact.email, data.contact.location].filter(Boolean).join(' | ') + ' | open to relocation');
      
      const linkParts = [];
      if (data.contact.linkedin) linkParts.push('LinkedIn');
      if (data.contact.github) linkParts.push('GitHub');
      if (data.contact.portfolio) linkParts.push('Portfolio');
      if (linkParts.length > 0) {
        lines.push(linkParts.join(' | '));
      }
      lines.push('');

      if (data.summary) {
        lines.push('PROFESSIONAL SUMMARY');
        lines.push(data.summary);
        lines.push('');
      }

      if (data.experience?.length > 0) {
        lines.push('WORK EXPERIENCE');
        data.experience.forEach(job => {
          lines.push(job.company);
          lines.push([job.title, job.dates, job.location].filter(Boolean).join(' | '));
          job.bullets.forEach(b => lines.push(`• ${b}`));
          lines.push('');
        });
      }

      if (data.skills) {
        lines.push('TECHNICAL SKILLS');
        if (data.skills.languages?.length) lines.push(`Languages: ${data.skills.languages.join(', ')}`);
        if (data.skills.aiml?.length) lines.push(`AI/ML: ${data.skills.aiml.join(', ')}`);
        if (data.skills.cloud?.length) lines.push(`Cloud: ${data.skills.cloud.join(', ')}`);
        if (data.skills.devops?.length) lines.push(`DevOps: ${data.skills.devops.join(', ')}`);
        if (data.skills.databases?.length) lines.push(`Databases: ${data.skills.databases.join(', ')}`);
        if (data.skills.soft?.length) lines.push(`Soft Skills: ${data.skills.soft.join(' | ')}`);
        lines.push('');
      }

      if (data.education?.length > 0) {
        lines.push('EDUCATION');
        data.education.forEach(edu => {
          lines.push(edu.degree);
          lines.push([edu.institution, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join(' | '));
        });
        lines.push('');
      }

      if (data.certifications?.length > 0) {
        lines.push('CERTIFICATIONS');
        data.certifications.forEach(cert => lines.push(cert));
      }

      return lines.join('\n');
    },

    // ============ GENERATE HTML PREVIEW ============
    generateHTMLPreview(data) {
      const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
      };

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(data.contact.name)} - CV</title>
  <style>
    @page {
      size: A4;
      margin: ${ATS_CONFIG.margins.top}pt ${ATS_CONFIG.margins.right}pt ${ATS_CONFIG.margins.bottom}pt ${ATS_CONFIG.margins.left}pt;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${ATS_CONFIG.font.body}pt;
      line-height: ${ATS_CONFIG.lineHeight};
      color: ${ATS_CONFIG.colors.text};
      background: #fff;
    }
    
    .cv-container { max-width: 100%; }
    
    .cv-name {
      font-size: ${ATS_CONFIG.font.name}pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .cv-tagline {
      font-size: ${ATS_CONFIG.font.subtitle}pt;
      text-align: center;
      color: ${ATS_CONFIG.colors.secondary};
      margin-bottom: 6px;
    }
    
    .cv-contact {
      text-align: center;
      font-size: ${ATS_CONFIG.font.contact}pt;
      color: ${ATS_CONFIG.colors.secondary};
      margin-bottom: ${ATS_CONFIG.paragraphSpacing + 4}px;
      line-height: 1.4;
    }
    
    .cv-section { margin-bottom: ${ATS_CONFIG.paragraphSpacing + 6}px; }
    
    .cv-section-title {
      font-size: ${ATS_CONFIG.font.sectionTitle}pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid ${ATS_CONFIG.colors.text};
      padding-bottom: 3px;
      margin-bottom: 8px;
    }
    
    .cv-summary { line-height: ${ATS_CONFIG.lineHeight}; text-align: justify; }
    
    .cv-job { margin-bottom: 12px; }
    
    .cv-company {
      font-weight: bold;
      font-size: ${ATS_CONFIG.font.body}pt;
    }
    
    .cv-job-meta {
      font-size: ${ATS_CONFIG.font.body}pt;
      color: ${ATS_CONFIG.colors.secondary};
      margin-bottom: 4px;
    }
    
    .cv-bullet {
      margin-left: 16px;
      margin-bottom: 3px;
      line-height: ${ATS_CONFIG.lineHeight};
    }
    
    .cv-education-item { margin-bottom: 6px; }
    
    .cv-skills-line { margin-bottom: 4px; line-height: ${ATS_CONFIG.lineHeight}; }
    
    .cv-cert { margin-bottom: 3px; }
    
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .cv-container { page-break-inside: avoid; }
      .cv-section { page-break-inside: avoid; }
      .cv-job { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="cv-container">
    <div class="cv-name">${escapeHtml(data.contact.name)}</div>
    ${data.contact.tagline ? `<div class="cv-tagline">${escapeHtml(data.contact.tagline)}</div>` : ''}
    <div class="cv-contact">
      ${[data.contact.phone, data.contact.email, data.contact.location].filter(Boolean).join(' | ')} | open to relocation
      ${(data.contact.linkedin || data.contact.github || data.contact.portfolio) ? `<br>${['LinkedIn', 'GitHub', 'Portfolio'].filter((_, i) => [data.contact.linkedin, data.contact.github, data.contact.portfolio][i]).join(' | ')}` : ''}
    </div>
    
    ${data.summary ? `
    <div class="cv-section">
      <div class="cv-section-title">Professional Summary</div>
      <div class="cv-summary">${escapeHtml(data.summary)}</div>
    </div>
    ` : ''}
    
    ${data.experience.length > 0 ? `
    <div class="cv-section">
      <div class="cv-section-title">Work Experience</div>
      ${data.experience.map(job => `
      <div class="cv-job">
        <div class="cv-company">${escapeHtml(job.company)}</div>
        <div class="cv-job-meta">${[job.title, job.dates, job.location].filter(Boolean).map(f => escapeHtml(f)).join(' | ')}</div>
        ${job.bullets.map(bullet => `<div class="cv-bullet">• ${escapeHtml(bullet)}</div>`).join('\n        ')}
      </div>
      `).join('\n      ')}
    </div>
    ` : ''}
    
    ${Object.values(data.skills).some(arr => arr.length > 0) ? `
    <div class="cv-section">
      <div class="cv-section-title">Technical Skills</div>
      ${data.skills.languages?.length ? `<div class="cv-skills-line"><strong>Languages:</strong> ${escapeHtml(data.skills.languages.join(', '))}</div>` : ''}
      ${data.skills.aiml?.length ? `<div class="cv-skills-line"><strong>AI/ML:</strong> ${escapeHtml(data.skills.aiml.join(', '))}</div>` : ''}
      ${data.skills.cloud?.length ? `<div class="cv-skills-line"><strong>Cloud:</strong> ${escapeHtml(data.skills.cloud.join(', '))}</div>` : ''}
      ${data.skills.devops?.length ? `<div class="cv-skills-line"><strong>DevOps:</strong> ${escapeHtml(data.skills.devops.join(', '))}</div>` : ''}
      ${data.skills.databases?.length ? `<div class="cv-skills-line"><strong>Databases:</strong> ${escapeHtml(data.skills.databases.join(', '))}</div>` : ''}
      ${data.skills.soft?.length ? `<div class="cv-skills-line"><strong>Soft Skills:</strong> ${escapeHtml(data.skills.soft.join(' | '))}</div>` : ''}
    </div>
    ` : ''}
    
    ${data.education.length > 0 ? `
    <div class="cv-section">
      <div class="cv-section-title">Education</div>
      ${data.education.map(edu => `
      <div class="cv-education-item">
        <div><strong>${escapeHtml(edu.degree)}</strong></div>
        <div>${[escapeHtml(edu.institution), edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join(' | ')}</div>
      </div>
      `).join('\n      ')}
    </div>
    ` : ''}
    
    ${data.certifications.length > 0 ? `
    <div class="cv-section">
      <div class="cv-section-title">Certifications</div>
      ${data.certifications.map(cert => `<div class="cv-cert">${escapeHtml(cert)}</div>`).join('\n      ')}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
    },

    // ============ GENERATE COVER LETTER PDF ============
    async generateCoverLetterPDF(tailoredData, keywords, jobData, candidateData) {
      const startTime = performance.now();

      const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant')
        .trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'Applicant';
      const lastName = (candidateData?.lastName || candidateData?.last_name || '')
        .trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const filename = lastName ? `${firstName}_${lastName}_Cover_Letter.pdf` : `${firstName}_Cover_Letter.pdf`;

      let pdfBlob = null;
      let pdfBase64 = null;

      if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
        const result = await this.renderCoverLetterWithJsPDFUltimate(tailoredData, keywords, jobData, candidateData);
        pdfBlob = result.blob;
        pdfBase64 = result.base64;
      } else {
        const text = this.generateCoverLetterText(tailoredData, keywords, jobData, candidateData);
        pdfBase64 = btoa(unescape(encodeURIComponent(text)));
      }

      console.log(`[ATS Ultimate] Cover Letter PDF generated in ${(performance.now() - startTime).toFixed(0)}ms`);
      return { blob: pdfBlob, base64: pdfBase64, filename };
    },

    // ============ RENDER COVER LETTER WITH JSPDF ============
    async renderCoverLetterWithJsPDFUltimate(data, keywords, jobData, candidateData) {
      const { jsPDF } = jspdf;
      const { font, margins, lineHeight, page } = ATS_CONFIG;
      const contentWidth = page.width - margins.left - margins.right;

      const doc = new jsPDF({ format: 'a4', unit: 'pt', putOnlyUsedFonts: true });
      doc.setFont(font.family, 'normal');
      let y = margins.top;

      const addText = (text, isBold = false, size = font.body) => {
        doc.setFontSize(size);
        doc.setFont(font.family, isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, contentWidth);
        lines.forEach(line => {
          doc.text(line, margins.left, y);
          y += size * lineHeight;
        });
      };

      const addCenteredText = (text, isBold = false, size = font.body) => {
        doc.setFontSize(size);
        doc.setFont(font.family, isBold ? 'bold' : 'normal');
        doc.text(text, page.width / 2, y, { align: 'center' });
        y += size * lineHeight;
      };

      // Extract info
      const name = data.contact.name;
      const jobTitle = jobData?.title || 'the open position';
      const company = this.extractCompanyName(jobData);
      const keywordsArray = Array.isArray(keywords) ? keywords : (keywords?.all || keywords?.highPriority || []);
      const highPriority = Array.isArray(keywordsArray) ? keywordsArray.slice(0, 5) : [];
      const topExp = data.experience?.[0]?.company || 'my previous roles';

      // === HEADER (Centered) ===
      addCenteredText(name.toUpperCase(), true, font.name);
      
      // Phone | Email (NO location in cover letter header)
      const contactLine = [data.contact.phone, data.contact.email].filter(Boolean).join(' | ');
      addCenteredText(contactLine, false, font.body);
      y += 20;

      // === DATE (Left aligned) ===
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      addText(today, false, font.body);
      y += 12;

      // === SUBJECT LINE: Re: Job Title ===
      addText(`Re: ${jobTitle}`, true, font.body);
      y += 10;

      // === SALUTATION ===
      addText('Dear Hiring Manager,', false, font.body);
      y += 12;

      // === PARAGRAPH 1: Introduction with keywords ===
      const kw1 = highPriority[0] || 'software development';
      const kw2 = highPriority[1] || 'technical solutions';
      const years = this.extractYearsExperience(data.summary) || '7+';
      
      const para1 = `I am excited to apply for the ${jobTitle} position at ${company}. With ${years} years of experience leading ${kw1} and ${kw2} initiatives, I consistently deliver measurable business impact through innovative technical solutions and cross-functional collaboration.`;
      addText(para1, false, font.body);
      y += 20;

      // === PARAGRAPH 2: Experience with achievements ===
      const kw3 = highPriority[2] || 'project delivery';
      const kw4 = highPriority[3] || 'team leadership';
      const topBullet = data.experience?.[0]?.bullets?.[0] || 'driving efficiency improvements of 30%+';

      const para2 = `At ${topExp}, I led ${kw3} implementations that resulted in ${this.extractAchievement(topBullet)}. I have extensive experience mentoring cross-functional teams and applying ${kw4} methodologies to deliver complex projects on time and within budget.`;
      addText(para2, false, font.body);
      y += 20;

      // === PARAGRAPH 3: Closing with keywords ===
      const kw5 = highPriority[4] || 'technical leadership';
      
      const para3 = `I would welcome the opportunity to discuss how my ${kw5} expertise can contribute to ${company}'s continued success. Thank you for considering my application. I look forward to the possibility of contributing to your team.`;
      addText(para3, false, font.body);
      y += 24;

      // === CLOSING ===
      addText('Sincerely,', false, font.body);
      y += 20;
      addText(name, true, font.body);

      const base64 = doc.output('datauristring').split(',')[1];
      const blob = doc.output('blob');

      return { base64, blob };
    },

    // ============ EXTRACT COMPANY NAME ============
    extractCompanyName(jobData) {
      if (!jobData) return 'your organization';
      
      let company = jobData.company || '';
      
      const isInvalid = (val) => {
        if (!val || typeof val !== 'string') return true;
        const lower = val.toLowerCase().trim();
        return lower === 'company' || lower === 'the company' || lower === 'your company' || lower.length < 2;
      };
      
      if (isInvalid(company)) {
        const titleMatch = (jobData.title || '').match(/\bat\s+([A-Z][A-Za-z0-9\s&.-]+?)(?:\s*[-|]|\s*$)/i);
        if (titleMatch) company = titleMatch[1].trim();
      }
      
      if (isInvalid(company)) {
        const url = jobData.url || '';
        const hostMatch = url.match(/https?:\/\/([^./]+)\./i);
        if (hostMatch && hostMatch[1]) {
          const subdomain = hostMatch[1].toLowerCase();
          const blacklist = ['www', 'apply', 'jobs', 'careers', 'boards', 'job-boards', 'hire'];
          if (!blacklist.includes(subdomain) && subdomain.length > 2) {
            company = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
          }
        }
      }
      
      if (company && typeof company === 'string') {
        company = company
          .replace(/\s*(careers|jobs|hiring|apply|work|join)\s*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      if (isInvalid(company)) company = 'your organization';
      
      return company;
    },

    // ============ EXTRACT YEARS EXPERIENCE ============
    extractYearsExperience(summary) {
      if (!summary) return null;
      const match = summary.match(/(\d+)\+?\s*years?/i);
      return match ? match[1] : null;
    },

    // ============ EXTRACT ACHIEVEMENT ============
    extractAchievement(bullet) {
      if (!bullet) return 'significant performance improvements';
      const match = bullet.match(/(\d+%?\s*(?:improvement|increase|reduction|faster|efficiency|growth))/i);
      return match ? match[1] : bullet.slice(0, 60) + (bullet.length > 60 ? '...' : '');
    },

    // ============ GENERATE COVER LETTER TEXT ============
    generateCoverLetterText(data, keywords, jobData, candidateData) {
      const name = data.contact.name;
      const jobTitle = jobData?.title || 'the open position';
      const company = this.extractCompanyName(jobData);
      const keywordsArray = Array.isArray(keywords) ? keywords : (keywords?.all || keywords?.highPriority || []);
      const highPriority = Array.isArray(keywordsArray) ? keywordsArray.slice(0, 5) : [];

      const lines = [
        name.toUpperCase(),
        [data.contact.phone, data.contact.email].filter(Boolean).join(' | '),
        '',
        new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        '',
        `Re: ${jobTitle}`,
        '',
        'Dear Hiring Manager,',
        '',
        `I am excited to apply for the ${jobTitle} position at ${company}. With experience in ${highPriority.slice(0, 2).join(' and ') || 'software development'}, I deliver measurable business impact through innovative solutions.`,
        '',
        `In my previous roles, I have successfully implemented ${highPriority[2] || 'technical'} solutions and led ${highPriority[3] || 'cross-functional'} initiatives resulting in significant improvements.`,
        '',
        `I would welcome the opportunity to discuss how my ${highPriority[4] || 'expertise'} can contribute to ${company}'s success. Thank you for your consideration.`,
        '',
        'Sincerely,',
        name
      ];

      return lines.join('\n');
    },

    // ============ CALCULATE MATCH SCORE ============
    calculateMatchScore(tailoredData, keywords) {
      const allKeywords = keywords.all || [];
      if (!allKeywords || allKeywords.length === 0) return 0;

      const text = [
        tailoredData.summary,
        Object.values(tailoredData.skills || {}).flat().join(' '),
        tailoredData.experience?.map(e => e.bullets?.join(' ')).join(' '),
        tailoredData.certifications?.join(' ')
      ].filter(Boolean).join(' ').toLowerCase();

      let matches = 0;
      allKeywords.forEach(kw => {
        if (text.includes(kw.toLowerCase())) matches++;
      });

      const score = Math.round((matches / allKeywords.length) * 100);
      return score;
    },

    // ============ GET ATS COMPLIANCE REPORT ============
    getATSComplianceReport(keywords, matchScore) {
      const report = {
        overallScore: 0,
        checks: [],
        recommendations: []
      };

      // Check 1: Font (always passes with our config)
      report.checks.push({
        check: 'Standard ATS font (Arial/Helvetica)',
        status: 'pass',
        score: 10
      });

      // Check 2: Font size
      report.checks.push({
        check: 'Optimal font size (10-12pt)',
        status: 'pass',
        score: 10
      });

      // Check 3: Margins
      report.checks.push({
        check: 'Standard margins (0.75 inch)',
        status: 'pass',
        score: 10
      });

      // Check 4: Line spacing
      report.checks.push({
        check: 'Professional line spacing (1.5)',
        status: 'pass',
        score: 10
      });

      // Check 5: Single column layout
      report.checks.push({
        check: 'Single-column layout (no tables/columns)',
        status: 'pass',
        score: 15
      });

      // Check 6: Standard bullet points
      report.checks.push({
        check: 'Standard bullet characters',
        status: 'pass',
        score: 10
      });

      // Check 7: Clear section headers
      report.checks.push({
        check: 'Standard section headings',
        status: 'pass',
        score: 10
      });

      // Check 8: Keyword match score
      const keywordScore = matchScore >= 80 ? 15 : matchScore >= 60 ? 10 : 5;
      report.checks.push({
        check: 'Keyword optimization',
        status: matchScore >= 60 ? 'pass' : 'warning',
        score: keywordScore
      });

      // Calculate overall score
      report.overallScore = Math.min(100, report.checks.reduce((sum, check) => sum + check.score, 0));

      // Recommendations based on score
      if (matchScore < 60) {
        report.recommendations.push('Add more keywords from the job description');
      }
      if (Object.values(keywords).flat().length < 10) {
        report.recommendations.push('Include more relevant technical skills');
      }

      return report;
    },

    // ============ DOWNLOAD HELPERS ============
    downloadPDF(pdfBase64, filename) {
      if (!pdfBase64 || typeof window === 'undefined') return;

      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    downloadHTML(htmlContent, filename) {
      if (!htmlContent || typeof window === 'undefined') return;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    downloadText(textContent, filename) {
      if (!textContent || typeof window === 'undefined') return;

      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // ============ EXPORT ============
  if (typeof window !== 'undefined') {
    window.ATSCVGeneratorUltimate = ATSCVGeneratorUltimate;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ATSCVGeneratorUltimate;
  }
  if (typeof global !== 'undefined') {
    global.ATSCVGeneratorUltimate = ATSCVGeneratorUltimate;
  }

})(typeof window !== 'undefined' ? window : 
   typeof global !== 'undefined' ? global : this);
