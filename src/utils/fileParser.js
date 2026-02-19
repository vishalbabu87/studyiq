/**
 * File Parser Utility
 * Properly extracts text from PDF, DOCX, XLSX, and other file formats
 * Works on both client-side and server-side (Vercel compatible)
 */

// Dynamic imports for server-side parsing
let pdfParse = null;
let mammoth = null;
let xlsx = null;

// Check if running on server
const isServer = typeof window === 'undefined';

// Lazy load server-side libraries
async function loadLibraries() {
  if (isServer) {
    try { pdfParse = (await import('pdf-parse')).default; } catch (e) { console.warn('pdf-parse not available'); }
    try { mammoth = (await import('mammoth')).default; } catch (e) { console.warn('mammoth not available'); }
    try { xlsx = (await import('xlsx')).default; } catch (e) { console.warn('xlsx not available'); }
  }
}

/**
 * Extract text from a PDF file
 * @param {ArrayBuffer} buffer - File buffer
 * @returns {Promise<string>} Extracted text
 */
export async function extractPDFText(buffer) {
  if (isServer && pdfParse) {
    try {
      const data = await pdfParse(Buffer.from(buffer));
      return data.text || '';
    } catch (e) {
      console.error('PDF parse error:', e.message);
    }
  }
  // Fallback: try to extract readable text from PDF bytes
  return extractTextFromBuffer(buffer);
}

/**
 * Extract text from a DOCX file
 * @param {ArrayBuffer} buffer - File buffer
 * @returns {Promise<string>} Extracted text
 */
export async function extractDOCXText(buffer) {
  if (isServer && mammoth) {
    try {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      return result.value || '';
    } catch (e) {
      console.error('DOCX parse error:', e.message);
    }
  }
  // Fallback: try to extract readable text from DOCX bytes
  return extractTextFromBuffer(buffer);
}

/**
 * Extract text from an XLSX file
 * @param {ArrayBuffer} buffer - File buffer
 * @returns {Promise<string>} Extracted text as CSV-like format
 */
export async function extractXLSXText(buffer) {
  if (isServer && xlsx) {
    try {
      const workbook = xlsx.read(buffer, { type: 'array' });
      const texts = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = xlsx.utils.sheet_to_csv(sheet);
        texts.push(csv);
      }
      return texts.join('\n\n');
    } catch (e) {
      console.error('XLSX parse error:', e.message);
    }
  }
  // Fallback
  return extractTextFromBuffer(buffer);
}

/**
 * Fallback: Extract readable text from any buffer
 * Filters out binary garbage and keeps readable characters
 */
function extractTextFromBuffer(buffer) {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const rawText = decoder.decode(buffer);
  
  // Clean up: remove non-printable characters, keep letters/numbers/punctuation
  const cleaned = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // Remove control chars
    .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, ' ') // Keep printable + unicode
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/([a-z])\s+([a-z])/gi, '$1 $2') // Fix broken words
    .trim();
    
  return cleaned;
}

/**
 * Main function: Extract text from any file type
 * @param {File|ArrayBuffer} file - File object or buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromFile(file, fileName = '', mimeType = '') {
  await loadLibraries();
  
  const name = (fileName || file?.name || '').toLowerCase();
  const type = mimeType || file?.type || '';
  
  // Get buffer
  let buffer;
  if (file instanceof ArrayBuffer) {
    buffer = file;
  } else if (file.arrayBuffer) {
    buffer = await file.arrayBuffer();
  } else {
    return '';
  }
  
  // PDF
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return extractPDFText(buffer);
  }
  
  // DOCX
  if (name.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDOCXText(buffer);
  }
  
  // DOC (old format - harder to parse, try mammoth anyway)
  if (name.endsWith('.doc') || type === 'application/msword') {
    // Try DOCX parser first (some .doc files are actually .docx)
    const docxText = await extractDOCXText(buffer);
    if (docxText && docxText.length > 100) {
      return docxText;
    }
    // Fallback to raw text extraction
    return extractTextFromBuffer(buffer);
  }
  
  // XLSX
  if (name.endsWith('.xlsx') || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return extractXLSXText(buffer);
  }
  
  // XLS
  if (name.endsWith('.xls') || type === 'application/vnd.ms-excel') {
    return extractXLSXText(buffer);
  }
  
  // Plain text files
  if (name.endsWith('.txt') || type === 'text/plain' || name.endsWith('.csv') || type === 'text/csv') {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
  
  // JSON
  if (name.endsWith('.json') || type === 'application/json') {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
  
  // Unknown: try fallback extraction
  return extractTextFromBuffer(buffer);
}

export default {
  extractTextFromFile,
  extractPDFText,
  extractDOCXText,
  extractXLSXText
};