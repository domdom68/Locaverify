/**
 * imageAnalyzer.js
 * Extracts images from listing HTML and checks them via Google Vision API
 * for web detection (reverse image search) — AND against Seculoca's own
 * proprietary registry of perceptual image hashes (reported_images table).
 *
 * Flow per image:
 *  1. Download image bytes once
 *  2. Compute a perceptual hash (local, free, instant)
 *  3. Check that hash against reported_images — exact match first, then a
 *     fuzzy (Hamming-distance) match to catch lightly filtered/recompressed
 *     re-uploads that an exact match would miss
 *     -> if a confirmed-fraud match is found, skip the paid Vision API call
 *  4. Otherwise, fall back to Google Vision Web Detection (now also using
 *     visuallySimilarImages, not just exact/partial matches) + metadata checks
 *  5. Every computed hash is returned so the caller can feed it back into
 *     the registry once a fraud verdict is confirmed (see updateImageRegistry)
 *
 * NOTE on remaining limits: the fuzzy hash match tolerates brightness/
 * contrast/saturation-type filters and recompression, but still won't catch
 * heavy crops or rotations reliably — that's where Vision's
 * visuallySimilarImages (ML-based, not pixel-based) fills the gap instead.
 */

const https = require('https');
const Jimp = require('jimp');
const { supabase } = require('../middleware/auth');

const GOOGLE_VISION_ENDPOINT =
  'https://vision.googleapis.com/v1/images:annotate';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB safety cap per image

// ── Extract image URLs from raw HTML ────────────────────────────
function extractImageUrls(html, baseUrl) {
  const urls = new Set();

  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    try { urls.add(new URL(m[1], baseUrl).href); } catch {}
  }

  const jsonImgRe = /"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
  while ((m = jsonImgRe.exec(html)) !== null) {
    if (!m[1].includes('icon') && !m[1].includes('logo') && !m[1].includes('avatar')) {
      urls.add(m[1]);
    }
  }

  const ogRe = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i;
  const og = html.match(ogRe);
  if (og) { try { urls.add(new URL(og[1], baseUrl).href); } catch {} }

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
    .slice(0, 8);
}

// ── Download image bytes with a size cap and timeout ─────────────
function downloadImageBuffer(imageUrl) {
  return new Promise((resolve, reject) => {
    const req = https.get(imageUrl, res => {
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      let total = 0;
      res.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_IMAGE_BYTES) {
          req.destroy();
          return reject(new Error('Image too large'));
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(6000, () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

// ── Compute a perceptual average-hash (aHash) from image bytes ──
// Returns a 16-char hex string (64-bit hash from an 8x8 greyscale grid).
async function computePerceptualHash(buffer) {
  const image = await Jimp.read(buffer);
  image.resize(8, 8).greyscale();

  const pixels = [];
  image.scan(0, 0, 8, 8, function (x, y, idx) {
    pixels.push(this.bitmap.data[idx]);
  });

  const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  const bits = pixels.map(p => (p >= avg ? '1' : '0')).join('');

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.substr(i, 4), 2).toString(16);
  }
  return hex;
}

// ── Check a perceptual hash against our own registry ─────────────
async function checkImageHash(hash) {
  if (!hash) return null;

  const { data } = await supabase
    .from('reported_images')
    .select('id, report_count, confirmed_scam_count, first_seen_at')
    .eq('perceptual_hash', hash)
    .single();

  if (!data) return null;

  return {
    found: true,
    reportCount: data.report_count,
    confirmedScamCount: data.confirmed_scam_count,
    firstSeenAt: data.first_seen_at,
    riskLevel: data.confirmed_scam_count >= 1 ? 'danger' : 'warning',
    detail: `Cette photo (empreinte identique) a été signalée ${data.report_count} fois dans notre base propriétaire Seculoca${data.confirmed_scam_count > 0 ? `, dont ${data.confirmed_scam_count} arnaque(s) confirmée(s)` : ''}.`,
  };
}

// ── Hamming distance between two 16-char hex hashes (64-bit) ─────
// Counts how many bits differ. 0 = identical. A small distance (≤5 out
// of 64 bits) still reliably indicates the same underlying photo, just
// re-compressed or lightly filtered (brightness/contrast/saturation).
function hammingDistance(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== hexB.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hexA.length; i++) {
    const xor = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    distance += xor.toString(2).split('').filter(b => b === '1').length;
  }
  return distance;
}

const HAMMING_THRESHOLD = 5; // out of 64 bits — tune if too many/few matches

// ── Fuzzy check: tolerate light filters/recompression that an exact
// hash match would miss. Only compares against hashes already known to
// the registry (not the whole internet), so the cost stays bounded by
// how many confirmed/reported images Seculoca has accumulated so far —
// this is itself part of the proprietary-data moat: it gets more useful
// as the registry grows, not more expensive per lookup in a meaningful way.
async function checkImageHashFuzzy(hash) {
  if (!hash) return null;

  const { data } = await supabase
    .from('reported_images')
    .select('perceptual_hash, report_count, confirmed_scam_count, first_seen_at')
    .neq('perceptual_hash', hash); // exact match already handled separately

  if (!data || data.length === 0) return null;

  let best = null;
  let bestDistance = Infinity;
  for (const row of data) {
    const d = hammingDistance(hash, row.perceptual_hash);
    if (d <= HAMMING_THRESHOLD && d < bestDistance) {
      best = row;
      bestDistance = d;
    }
  }

  if (!best) return null;

  return {
    found: true,
    reportCount: best.report_count,
    confirmedScamCount: best.confirmed_scam_count,
    firstSeenAt: best.first_seen_at,
    riskLevel: best.confirmed_scam_count >= 1 ? 'danger' : 'warning',
    detail: `Cette photo ressemble fortement (probablement retouchée ou recompressée) à une image signalée ${best.report_count} fois dans notre base propriétaire Seculoca${best.confirmed_scam_count > 0 ? `, dont ${best.confirmed_scam_count} arnaque(s) confirmée(s)` : ''}.`,
  };
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

  const fullMatches      = visionResult.fullMatchingImages || [];
  const partialMatches   = visionResult.partialMatchingImages || [];
  const similarImages    = visionResult.visuallySimilarImages || [];
  const pages            = visionResult.pagesWithMatchingImages || [];

  const totalMatches = fullMatches.length + partialMatches.length;

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

  // No exact/partial match, but Vision's own ML model found visually
  // similar images (catches crops/filters/edits that a strict hash or
  // pixel match would miss). Weaker signal — only "warning", never
  // "danger" on its own, since visual similarity alone isn't proof of
  // reuse (two different but similar-looking apartments, for instance).
  if (similarImages.length >= 3) {
    return {
      imageUrl,
      riskLevel: 'warning',
      matchCount: similarImages.length,
      foreignDomains: uniqueForeign,
      detail: `${similarImages.length} image(s) visuellement très proches trouvées sur le web (possible recadrage/filtre) — à vérifier manuellement.`,
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

// ── EXIF/URL-based metadata check (free, instant) ─────────────────
function checkImageMetadata(imageUrl) {
  const flags = [];
  const lower = imageUrl.toLowerCase();

  if (/shutterstock|gettyimages|istockphoto|depositphotos|123rf|dreamstime/i.test(lower)) {
    flags.push({ riskLevel: 'danger', detail: `Image provenant d'une banque de photos (${lower.match(/shutterstock|gettyimages|istockphoto|depositphotos|123rf|dreamstime/i)?.[0]}) — impossible qu'il s'agisse du logement réel.` });
  }

  if (/instagram|facebook|twitter|linkedin|tiktok/i.test(lower)) {
    flags.push({ riskLevel: 'warning', detail: `Image hébergée sur un réseau social — possiblement une photo de profil volée.` });
  }

  return flags;
}

// ── Main export: analyse all images from a listing ───────────────
async function analyseListingImages(html, listingUrl, apiKey) {
  const imageUrls = extractImageUrls(html, listingUrl || 'https://example.com');

  if (imageUrls.length === 0) {
    return {
      checked: false,
      reason: 'Aucune image extraite de l\'annonce',
      results: [],
      summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 },
    };
  }

  const results = await Promise.allSettled(
    imageUrls.map(async url => {
      // 1. Metadata check first (free, instant, no download needed)
      const metaFlags = checkImageMetadata(url);
      if (metaFlags.length > 0) return { ...metaFlags[0], imageUrl: url, perceptualHash: null };

      // 2. Download once, compute our own perceptual hash
      let hash = null;
      try {
        const buffer = await downloadImageBuffer(url);
        hash = await computePerceptualHash(buffer);
      } catch {
        // download/hash failure — fall through to Vision-only if apiKey available
      }

      // 3. Check our own free registry — exact match first, then a fuzzy
      // (Hamming-distance) match to catch lightly filtered re-uploads.
      if (hash) {
        const registryHit = await checkImageHash(hash);
        if (registryHit) {
          return {
            imageUrl: url,
            perceptualHash: hash,
            riskLevel: registryHit.riskLevel,
            matchCount: registryHit.reportCount,
            foreignDomains: [],
            detail: registryHit.detail,
            source: 'registre_seculoca',
          };
        }

        const fuzzyHit = await checkImageHashFuzzy(hash);
        if (fuzzyHit) {
          return {
            imageUrl: url,
            perceptualHash: hash,
            riskLevel: fuzzyHit.riskLevel,
            matchCount: fuzzyHit.reportCount,
            foreignDomains: [],
            detail: fuzzyHit.detail,
            source: 'registre_seculoca_flou',
          };
        }
      }

      // 4. Not in our registry — fall back to Google Vision (if configured)
      if (!apiKey) {
        return hash
          ? { imageUrl: url, perceptualHash: hash, riskLevel: 'ok', matchCount: 0, foreignDomains: [], detail: 'Aucune copie connue dans notre registre (Vision API non configurée).' }
          : null;
      }

      try {
        const vision = await checkImageWithVision(url, apiKey);
        const assessed = assessImageRisk(vision, url);
        return assessed ? { ...assessed, perceptualHash: hash, source: 'google_vision' } : null;
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

// ── Feed confirmed-fraud hashes back into the registry ────────────
// Call this once a feedback verdict ('scam' or 'legit') is submitted for
// an analysis, passing the perceptualHash values stored in that analysis'
// image_check_summary. Mirrors updateCommunityDB in communityCheck.js.
async function updateImageRegistry({ hashes, isScam, analyseId }) {
  if (!hashes || hashes.length === 0) return;

  const tasks = hashes
    .filter(Boolean)
    .map(hash =>
      supabase.rpc('upsert_reported_image', {
        p_hash: hash,
        p_is_scam: isScam,
        p_analyse_id: analyseId || null,
      })
    );

  await Promise.allSettled(tasks);
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

module.exports = {
  analyseListingImages,
  buildImageCriterion,
  extractImageUrls,
  computePerceptualHash,
  checkImageHash,
  checkImageHashFuzzy,
  hammingDistance,
  updateImageRegistry,
};