/**
 * Netflix Email Reader - Google Apps Script
 * 
 * Script ini membaca email Netflix dari Gmail dan mengembalikan:
 * - Kode OTP (6 digit)
 * - Link Update Household
 * 
 * SETUP:
 * 1. Buka https://script.google.com
 * 2. Create New Project
 * 3. Copy-paste code ini
 * 4. Deploy > New Deployment > Web App
 * 5. Execute as: Me, Who has access: Anyone
 * 6. Copy URL dan masukkan ke script.js di frontend
 */

// Konfigurasi
const CONFIG = {
  // Email Netflix yang akan difilter
  NETFLIX_SENDERS: [
    'info@account.netflix.com',
    'info@members.netflix.com',
    'info@mailer.netflix.com'
  ],
  // Jumlah email yang dibaca (max)
  MAX_EMAILS: 20,
  // Hanya email dalam X hari terakhir
  DAYS_BACK: 7
};

/**
 * Handler untuk HTTP GET requests
 * Ini yang dipanggil saat frontend fetch data
 */
function doGet(e) {
  try {
    const data = getNetflixEmails();
    
    // Return JSON dengan CORS headers
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        data: data
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Fungsi utama untuk mengambil email Netflix
 */
function getNetflixEmails() {
  const results = {
    otpCodes: [],
    householdLinks: [],
    tempAccessLinks: [] // NEW: Kode akses sementara
  };
  
  // Buat query untuk mencari email Netflix
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - CONFIG.DAYS_BACK);
  const dateString = Utilities.formatDate(dateLimit, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  
  // Search query: dari Netflix, setelah tanggal tertentu
  const senderQuery = CONFIG.NETFLIX_SENDERS.map(s => `from:${s}`).join(' OR ');
  const query = `(${senderQuery}) after:${dateString}`;
  
  // Cari threads yang match
  const threads = GmailApp.search(query, 0, CONFIG.MAX_EMAILS);
  
  for (const thread of threads) {
    const messages = thread.getMessages();
    
    for (const message of messages) {
      const subject = message.getSubject();
      const body = message.getPlainBody();
      const htmlBody = message.getBody();
      const date = message.getDate();
      const from = message.getFrom();
      const to = message.getTo(); // Email tujuan (dengan +suffix jika ada)
      
      // Ekstrak akun Netflix dari alamat email tujuan
      const accountEmail = extractAccountEmail(to);
      
      // Cek apakah email OTP
      const otpMatch = extractOTP(subject, body);
      if (otpMatch) {
        results.otpCodes.push({
          code: otpMatch,
          subject: subject,
          date: date.toISOString(),
          from: from,
          to: to,
          account: accountEmail
        });
        continue; // Skip to next message
      }
      
      // Cek apakah email Temporary Access Code (Kode akses sementara)
      const tempAccessLink = extractTempAccessLink(subject, body, htmlBody);
      if (tempAccessLink) {
        // Ekstrak info requester dari body
        const requesterInfo = extractRequesterInfo(body, htmlBody);
        results.tempAccessLinks.push({
          link: tempAccessLink,
          subject: subject,
          requester: requesterInfo,
          date: date.toISOString(),
          from: from,
          to: to,
          account: accountEmail
        });
        continue;
      }
      
      // Cek apakah email Household
      const householdLink = extractHouseholdLink(subject, body, htmlBody);
      if (householdLink) {
        results.householdLinks.push({
          link: householdLink,
          subject: subject,
          date: date.toISOString(),
          from: from,
          to: to,
          account: accountEmail
        });
      }
    }
  }
  
  // Sort by date (newest first)
  results.otpCodes.sort((a, b) => new Date(b.date) - new Date(a.date));
  results.householdLinks.sort((a, b) => new Date(b.date) - new Date(a.date));
  results.tempAccessLinks.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return results;
}

/**
 * Ekstrak link "Dapatkan Kode" untuk kode akses sementara
 */
function extractTempAccessLink(subject, body, htmlBody) {
  const subjectLower = subject.toLowerCase();
  
  // Cek apakah email tentang kode akses sementara
  if (subjectLower.includes('kode akses sementara') || 
      subjectLower.includes('temporary access') ||
      subjectLower.includes('temporary code')) {
    
    // Pattern spesifik untuk link "Dapatkan Kode" / travel verify
    // URL format: https://www.netflix.com/account/travel/verify?nftoken=...
    const linkPatterns = [
      // Pattern utama: travel/verify dengan nftoken
      /href="(https:\/\/www\.netflix\.com\/account\/travel\/verify\?[^"]+)"/i,
      // Pattern alternatif: travel path
      /href="(https:\/\/www\.netflix\.com\/account\/travel\/[^"]+)"/i,
      // Pattern dengan anchor text "Dapatkan Kode"
      /href="(https:\/\/www\.netflix\.com\/[^"]+)"[^>]*>[^<]*Dapatkan Kode/i,
      // Pattern dengan anchor text "Get Code"
      /href="(https:\/\/www\.netflix\.com\/[^"]+)"[^>]*>[^<]*Get Code/i
    ];
    
    for (const pattern of linkPatterns) {
      const match = htmlBody.match(pattern);
      if (match) {
        // Clean up the URL (remove HTML entities)
        let url = match[1];
        url = url.replace(/&amp;/g, '&');
        return url;
      }
    }
    
    // Fallback: cari semua Netflix links di email ini
    const allLinks = htmlBody.match(/href="(https:\/\/www\.netflix\.com\/[^"]+)"/gi);
    if (allLinks && allLinks.length > 0) {
      // Prioritaskan link yang mengandung travel atau verify
      for (const link of allLinks) {
        const urlMatch = link.match(/href="([^"]+)"/);
        if (urlMatch) {
          const url = urlMatch[1].replace(/&amp;/g, '&');
          if (url.includes('travel') || url.includes('verify')) {
            return url;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Ekstrak info peminta dari body email
 * "Diminta oleh Intan dari PC Chrome - Browser Web pada pukul..."
 */
function extractRequesterInfo(body, htmlBody) {
  // Try plain text body first
  const patterns = [
    /Diminta oleh\s+(.+?)\s+dari\s+(.+?)\s+pada/i,
    /Requested by\s+(.+?)\s+from\s+(.+?)\s+at/i
  ];
  
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) {
      return {
        name: match[1].trim(),
        device: match[2].trim()
      };
    }
  }
  
  // If not found in plain text, try HTML body
  // First, strip HTML tags but keep the text
  if (htmlBody) {
    const strippedHtml = htmlBody
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/td>/gi, ' ')
      .replace(/<\/tr>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ');
    
    // Try patterns on stripped HTML
    for (const pattern of patterns) {
      const match = strippedHtml.match(pattern);
      if (match) {
        return {
          name: match[1].trim(),
          device: match[2].trim()
        };
      }
    }
    
    // Try more flexible pattern for HTML where elements might be split
    // Look for "Diminta oleh [name] dari" pattern
    const htmlPatterns = [
      /Diminta oleh\s+([^<]+?)\s+dari\s*(?:<[^>]*>)*\s*(?:<b[^>]*>)?([^<]+)/i,
      /Diminta oleh\s+([A-Za-z0-9\s]+)\s+dari/i
    ];
    
    for (const pattern of htmlPatterns) {
      const match = htmlBody.match(pattern);
      if (match) {
        let name = match[1].replace(/<[^>]+>/g, '').trim();
        let device = match[2] ? match[2].replace(/<[^>]+>/g, '').trim() : '';
        
        // If device is empty, try to find it separately
        if (!device) {
          const deviceMatch = htmlBody.match(/dari\s*(?:<[^>]*>)*\s*(?:<b[^>]*>)?([^<]+?)(?:<\/b>)?\s*pada/i);
          if (deviceMatch) {
            device = deviceMatch[1].replace(/<[^>]+>/g, '').trim();
          }
        }
        
        if (name) {
          return {
            name: name,
            device: device || 'Unknown Device'
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Ekstrak email akun dari alamat tujuan
 * Contoh: "harisratnopambudi+netflix1@gmail.com" -> "harisratnopambudi+netflix1@gmail.com"
 * Atau tampilkan label yang lebih user-friendly
 */
function extractAccountEmail(toAddress) {
  // Coba ekstrak email dari format "Name <email>" 
  const emailMatch = toAddress.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : toAddress;
  
  // Cek apakah ada +suffix
  const suffixMatch = email.match(/\+([^@]+)@/);
  if (suffixMatch) {
    // Return label yang mudah dibaca, misal "netflix1" atau "netflix2"
    return suffixMatch[1]; // Hanya return suffix (misal: "netflix1")
  }
  
  return email; // Return full email jika tidak ada suffix
}

/**
 * Ekstrak kode OTP dari email
 * Netflix OTP biasanya 6 digit
 */
function extractOTP(subject, body) {
  // Pattern untuk mencari OTP di subject atau body
  const patterns = [
    /\b(\d{6})\b/,  // 6 digit berurutan
    /code[:\s]+(\d{6})/i,
    /kode[:\s]+(\d{6})/i,
    /verification[:\s]+(\d{6})/i,
    /verifikasi[:\s]+(\d{6})/i
  ];
  
  // Cek subject dulu
  const subjectLower = subject.toLowerCase();
  if (subjectLower.includes('sign-in') || 
      subjectLower.includes('verification') || 
      subjectLower.includes('code') ||
      subjectLower.includes('kode') ||
      subjectLower.includes('otp')) {
    
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // Cek di subject juga
    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match) {
        return match[1];
      }
    }
  }
  
  return null;
}

/**
 * Ekstrak link Household dari email
 */
function extractHouseholdLink(subject, body, htmlBody) {
  const subjectLower = subject.toLowerCase();
  
  // Cek apakah email tentang household
  if (subjectLower.includes('household') || 
      subjectLower.includes('tv household') ||
      subjectLower.includes('update') ||
      subjectLower.includes('confirm') ||
      subjectLower.includes('verify your')) {
    
    // Cari link Netflix di HTML body
    const linkPatterns = [
      /href="(https:\/\/www\.netflix\.com\/account\/update-primary-location[^"]+)"/i,
      /href="(https:\/\/www\.netflix\.com\/account\/household[^"]+)"/i,
      /href="(https:\/\/www\.netflix\.com\/[^"]*confirm[^"]+)"/i,
      /(https:\/\/www\.netflix\.com\/account\/update-primary-location[^\s<]+)/i,
      /(https:\/\/www\.netflix\.com\/account\/household[^\s<]+)/i
    ];
    
    for (const pattern of linkPatterns) {
      const match = htmlBody.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // Fallback: cari di plain body
    for (const pattern of linkPatterns) {
      const match = body.match(pattern);
      if (match) {
        return match[1];
      }
    }
  }
  
  return null;
}

/**
 * Test function - jalankan ini untuk test
 */
function testGetEmails() {
  const result = getNetflixEmails();
  Logger.log(JSON.stringify(result, null, 2));
}
