// ATS Tailor Pro - Content Script
console.log('[ATS Tailor Pro] Content script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'attachDocument') {
    attachDocument(message.type, message.pdf, message.text, message.filename)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, message: error.message }));
    return true;
  }
});

async function attachDocument(type, pdfBase64, textContent, filename) {
  const fileInput = findFileInput(type);
  if (!fileInput) return { success: false, message: `No ${type} upload field found` };

  try {
    let file;
    if (pdfBase64) {
      const byteCharacters = atob(pdfBase64);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      file = new File([byteArray], filename, { type: 'application/pdf' });
    } else if (textContent) {
      file = new File([textContent], filename.replace('.pdf', '.txt'), { type: 'text/plain' });
    } else {
      return { success: false, message: 'No document content' };
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function findFileInput(type) {
  const selectors = type === 'cv' 
    ? ['input[type="file"][name*="resume" i]', 'input[type="file"][name*="cv" i]', 'input[type="file"]']
    : ['input[type="file"][name*="cover" i]', 'input[type="file"][name*="letter" i]'];
  for (const sel of selectors) {
    const input = document.querySelector(sel);
    if (input) return input;
  }
  return null;
}
