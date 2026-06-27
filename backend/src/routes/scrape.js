const express = require('express');
const router = express.Router();

// POST /api/scrape  — Extract listing data from URL
router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante.' });

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL invalide.' });
  }

  try {
    // Fetch the page HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    const html = await response.text();

    // Platform-specific extraction
    const hostname = parsedUrl.hostname.toLowerCase();
    let extracted = {};

    if (hostname.includes('leboncoin')) {
      extracted = extractLeboncoin(html);
    } else if (hostname.includes('seloger') || hostname.includes('logic-immo')) {
      extracted = extractSeloger(html);
    } else if (hostname.includes('pap.fr')) {
      extracted = extractPAP(html);
    } else if (hostname.includes('laforet') || hostname.includes('orpi') || hostname.includes('century21')) {
      extracted = extractAgency(html);
    } else {
      extracted = extractGeneric(html);
    }

    return res.json({ success: true, data: extracted, source: hostname });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(408).json({ error: 'Délai dépassé. Le site met trop de temps à répondre.' });
    }
    return res.status(500).json({ error: 'Impossible de récupérer cette annonce. Remplissez manuellement.' });
  }
});

// ── Extractors ────────────────────────────────────────────────────

function extractLeboncoin(html) {
  const result = {};

  // Title / description
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  // Price
  const priceMatch = html.match(/(\d[\d\s]*)\s*€\s*(?:\/\s*mois|CC|HC)/i)
    || html.match(/"price":\s*(\d+)/);
  if (priceMatch) result.prix = priceMatch[1].replace(/\s/g, '');

  // Location
  const locMatch = html.match(/"city":\s*"([^"]+)"/i)
    || html.match(/data-qa-id="adview_location_informations"[^>]*>([^<]+)/i);
  if (locMatch) result.localisation = locMatch[1];

  // Description text
  const descMatch = html.match(/"description":\s*"([^"]{50,})"/i)
    || html.match(/data-qa-id="adview_description_container"[^>]*>([\s\S]{50,?})<\/div>/i);
  if (descMatch) {
    result.description = descMatch[1]
      .replace(/\\n/g, '\n').replace(/\\"/g, '"')
      .replace(/<[^>]+>/g, '').trim().slice(0, 2000);
  }

  return result;
}

function extractSeloger(html) {
  const result = {};

  const priceMatch = html.match(/"price":\s*(\d+)/)
    || html.match(/(\d[\d\s]+)\s*€\/mois/i);
  if (priceMatch) result.prix = priceMatch[1].replace(/\s/g, '');

  const cityMatch = html.match(/"city":\s*"([^"]+)"/)
    || html.match(/"postalCode":\s*"(\d{5})"/);
  if (cityMatch) result.localisation = cityMatch[1];

  const descMatch = html.match(/"description":\s*"([^"]{50,})"/);
  if (descMatch) {
    result.description = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').slice(0, 2000);
  }

  return result;
}

function extractPAP(html) {
  const result = {};

  const priceMatch = html.match(/(\d[\d\s]+)\s*€\/mois/i);
  if (priceMatch) result.prix = priceMatch[1].replace(/\s/g, '');

  const cityMatch = html.match(/<span[^>]*class="[^"]*localisation[^"]*"[^>]*>([^<]+)</i);
  if (cityMatch) result.localisation = cityMatch[1].trim();

  const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]{50,?})<\/div>/i);
  if (descMatch) {
    result.description = descMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 2000);
  }

  return result;
}

function extractAgency(html) {
  return extractGeneric(html);
}

function extractGeneric(html) {
  const result = {};

  // JSON-LD structured data
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const content = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const data = JSON.parse(content);
        if (data.price || data.offers?.price) {
          result.prix = String(data.price || data.offers?.price).replace(/\D/g, '');
        }
        if (data.name) result.title = data.name;
        if (data.description) result.description = data.description.slice(0, 2000);
        if (data.address?.addressLocality) result.localisation = data.address.addressLocality;
      } catch {}
    }
  }

  // Open Graph fallback
  if (!result.title) {
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitle) result.title = ogTitle[1];
  }
  if (!result.description) {
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    if (ogDesc) result.description = ogDesc[1].slice(0, 2000);
  }

  // Generic price fallback
  if (!result.prix) {
    const priceMatch = html.match(/(\d{3,5})\s*€\s*(?:\/\s*mois|par mois|\/mois)/i);
    if (priceMatch) result.prix = priceMatch[1];
  }

  return result;
}

module.exports = router;
