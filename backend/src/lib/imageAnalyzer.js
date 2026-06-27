/**
 * imageAnalyzer.js
 * Extracts images from listing HTML and checks them via Google Vision API
 * for web detection (reverse image search).
 *
 * Google Vision Web Detection returns:
 *  - fullMatchingImages  : exact copies on the web
 *  - partialMatchingImages : partial copies / cropped versions
 *  - pagesWithMatchingImages : pages containing matching images
 *  - visuallySimilarImages : similar (not identical) images
 */

const https = require('https');

const GOOGLE_VISION_ENDPOINT =
  'https://vision.googleapis.com/v1/images:annotate';

// ── Extract image URLs from raw HTML ────────────────────────────
function extractImageUrls(html, baseUrl) {
  const urls = new Set();

  // Standard <img src="...">
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    try { urls.add(new URL(m[1], baseUrl).href); } catch {}
  }

  // JSON-embedded image arrays (LeBonCoin, SeLoger style)
  const jsonImgRe = /"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
  while ((m = jsonImgRe.exec(html)) !== null) {
    if (!m[1].includes('icon') && !m[1].includes('logo') && !m[1].includes('avatar')) {
      urls.add(m[1]);
    }
  }

  // og:image meta
  const ogRe = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i;
  const og = html.match(ogRe);
  if (og) { try { urls.add(new URL(og[1], baseUrl).href); } catch {} }

  // Filter: keep only likely listing photos (skip tiny icons, trackers)
  return [...urls]
    .filter(u => {
      const lower = u.toLowerCase();
      return (
        (lower.includes('.jpg') || lower.includes('.jpeg') ||
         lower.includes('.png') || lower.includes('.webp')) &&
        !lower.includes('icon') && !lower.includes('logo') &&
        !lower.includes('pixel') && !lower.includes('tracking') &&
        !lower.includes('favicon') && !lower.includes('sprite')
      );
    })
    .slice(0, 8); // max 8 images per listing to control API cost
}

// ── Call Google Vision Web Detection for one image ──────────────
async function checkImageWithVision(imageUrl, apiKey) {
  const body = JSON.stringify({
    requests: [{
      image: { source: { imageUri: imageUrl } },
      features: [{ type: 'WEB_DETECTION', maxResults: 10 }],
    }],
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${GOOGLE_VISION_ENDPOINT}?key=${apiKey}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.responses?.[0]?.webDetection || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Vision API timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Analyse results and return structured risk assessment ────────
function assessImageRisk(visionResult, imageUrl) {
  if (!visionResult) return null;

  const fullMatches    = visionResult.fullMatchingImages || [];
  const partialMatches = visionResult.partialMatchingImages || [];
  const pages          = visionResult.pagesWithMatchingImages || [];

  const totalMatches = fullMatches.length + partialMatches.length;

  // Extract suspicious domains (foreign sites, other listing platforms)
  const foreignDomains = pages
    .map(p => { try { return new URL(p.url).hostname; } catch { return null; } })
    .filter(Boolean)
    .filter(d => !d.includes('leboncoin') && !d.includes('seloger') &&
                 !d.includes('pap.fr') && !d.includes('google') &&
                 !d.includes('seculoca'));

  const uniqueForeign = [...new Set(foreignDomains)].slice(0, 5);

  if (fullMatches.length >= 3 || foreignDomains.length >= 2) {
    return {
      imageUrl,
      riskLevel: 'danger',
      matchCount: totalMatches,
      foreignDomains: uniqueForeign,
      detail: `Photo trouvée en ${fullMatches.length} copie(s) exacte(s) sur le web${uniqueForeign.length ? ` (${uniqueForeign.join(', ')})` : ''} — image volée très probable.`,
    };
  }

  if (fullMatches.length >= 1 || partialMatches.length >= 2) {
    return {
      imageUrl,
      riskLevel: 'warning',
      matchCount: totalMatches,
      foreignDomains: uniqueForeign,
      detail: `Photo trouvée en ${totalMatches} occurrence(s) sur le web — vérifiez qu'il s'agit bien d'autres annonces du même propriétaire.`,
    };
  }

  return {
    imageUrl,
    riskLevel: 'ok',
    matchCount: 0,
    foreignDomains: [],
    detail: `Aucune copie de cette photo détectée sur le web.`,
  };
}

// ── EXIF metadata check via URL analysis ────────────────────────
function checkImageMetadata(imageUrl) {
  const flags = [];
  const lower = imageUrl.toLowerCase();

  // Stock photo CDNs
  if (/shutterstock|gettyimages|istockphoto|depositphotos|123rf|dreamstime/i.test(lower)) {
    flags.push({ riskLevel: 'danger', detail: `Image provenant d'une banque de photos (${lower.match(/shutterstock|gettyimages|istockphoto|depositphotos|123rf|dreamstime/i)?.[0]}) — impossible qu'il s'agisse du logement réel.` });
  }

  // Social media (stolen profile photos used as "owner" photo)
  if (/instagram|facebook|twitter|linkedin|tiktok/i.test(lower)) {
    flags.push({ riskLevel: 'warning', detail: `Image hébergée sur un réseau social — possiblement une photo de profil volée.` });
  }

  return flags;
}

// ── Main export: analyse all images from a listing ───────────────
async function analyseListingImages(html, listingUrl, apiKey) {
  if (!apiKey) {
    return {
      checked: false,
      reason: 'Clé Google Vision non configurée',
      results: [],
      summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 },
    };
  }

  const imageUrls = extractImageUrls(html, listingUrl || 'https://example.com');

  if (imageUrls.length === 0) {
    return {
      checked: false,
      reason: 'Aucune image extraite de l\'annonce',
      results: [],
      summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 },
    };
  }

  // Run all checks in parallel (capped at 8 images)
  const results = await Promise.allSettled(
    imageUrls.map(async url => {
      // Metadata check (free, instant)
      const metaFlags = checkImageMetadata(url);
      if (metaFlags.length > 0) return { ...metaFlags[0], imageUrl: url };

      // Google Vision check
      try {
        const vision = await checkImageWithVision(url, apiKey);
        return assessImageRisk(vision, url);
      } catch {
        return null;
      }
    })
  );

  const valid = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  const dangerCount  = valid.filter(r => r.riskLevel === 'danger').length;
  const warningCount = valid.filter(r => r.riskLevel === 'warning').length;

  return {
    checked: true,
    imageCount: imageUrls.length,
    results: valid,
    summary: {
      dangerCount,
      warningCount,
      totalChecked: valid.length,
      worstLevel: dangerCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'ok',
    },
  };
}

// ── Build the criteria entry for the analysis report ─────────────
function buildImageCriterion(imageAnalysis) {
  if (!imageAnalysis.checked) {
    return {
      label: 'Vérification des photos',
      status: 'info',
      detail: imageAnalysis.reason || 'Photos non vérifiables depuis cette annonce.',
    };
  }

  const { summary, results } = imageAnalysis;
  const worst = results.find(r => r.riskLevel === 'danger') ||
                results.find(r => r.riskLevel === 'warning');

  if (summary.dangerCount > 0) {
    return {
      label: 'Vérification des photos',
      status: 'danger',
      detail: `${summary.dangerCount} photo(s) sur ${summary.totalChecked} identifiée(s) comme copiée(s) sur le web. ${worst?.detail || ''}`,
    };
  }

  if (summary.warningCount > 0) {
    return {
      label: 'Vérification des photos',
      status: 'warning',
      detail: `${summary.warningCount} photo(s) présente(s) ailleurs sur le web — peut être une autre annonce du même propriétaire. ${worst?.detail || ''}`,
    };
  }

  return {
    label: 'Vérification des photos',
    status: 'ok',
    detail: `${summary.totalChecked} photo(s) vérifiée(s) — aucune copie détectée sur le web.`,
  };
}

module.exports = { analyseListingImages, buildImageCriterion, extractImageUrls };
