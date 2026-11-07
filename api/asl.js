/**
 * LensLingo - Serverless Backend Handler (api/asl.js)
 * Mencari video demonstrasi American Sign Language (ASL) via YouTube Data API v3.
 * Mengembalikan daftar video embeddable dengan proteksi kuota, sanitasi, dan caching.
 */

const REQUEST_TIMEOUT_MS = 15000;

/**
 * 1. Validasi & Sanitasi Kata Kunci
 * Hanya menerima huruf a-z, spasi, dan tanda hubung (-), maksimal 30 karakter.
 */
function sanitizeWord(rawWord) {
  if (typeof rawWord !== 'string') return null;
  const trimmed = rawWord.trim().toLowerCase();
  if (!trimmed || trimmed.length > 30) return null;
  if (!/^[a-z\s-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * 2. Panggilan ke YouTube Data API v3 (search.list)
 */
async function fetchYouTubeAslVideos(word, apiKey) {
  const query = `how to sign ${word} in ASL`;
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoEmbeddable: 'true',
    videoDuration: 'short',
    safeSearch: 'strict',
    maxResults: '5',
    key: apiKey
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      const timeoutErr = new Error('Waktu pencarian video melebihi 15 detik (timeout).');
      timeoutErr.statusCode = 504;
      throw timeoutErr;
    }
    const netErr = new Error('Gagal terhubung ke layanan YouTube. Periksa koneksi internet.');
    netErr.statusCode = 502;
    throw netErr;
  }

  // Tangani kegagalan HTTP dari YouTube
  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch {
      // Abaikan jika respons bukan JSON
    }

    const firstReason = errorData?.error?.errors?.[0]?.reason || '';
    const status = response.status;

    // Kuota habis (403 quotaExceeded)
    if (status === 403 && (firstReason === 'quotaExceeded' || firstReason === 'rateLimitExceeded')) {
      const quotaErr = new Error(
        'Kuota harian pencarian video YouTube sedang habis. Silakan gunakan tombol cari langsung atau coba lagi besok.'
      );
      quotaErr.statusCode = 429;
      quotaErr.isQuota = true;
      throw quotaErr;
    }

    // Masalah autentikasi API Key
    if (status === 400 || status === 401 || status === 403) {
      const authErr = new Error('Autentikasi YouTube API gagal. Periksa YOUTUBE_API_KEY di server.');
      authErr.statusCode = 502;
      throw authErr;
    }

    // Error umum lainnya dari YouTube
    const genErr = new Error('Layanan video YouTube sedang mengalami gangguan. Silakan coba beberapa saat lagi.');
    genErr.statusCode = 502;
    throw genErr;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const parseErr = new Error('Format data dari YouTube tidak dapat dibaca.');
    parseErr.statusCode = 502;
    throw parseErr;
  }

  const items = Array.isArray(data.items) ? data.items : [];
  const videos = items
    .filter((item) => item?.id?.videoId)
    .map((item) => ({
      videoId: item.id.videoId,
      title: (item.snippet?.title || '').slice(0, 150),
      channelTitle: (item.snippet?.channelTitle || '').slice(0, 100)
    }));

  return videos;
}

/**
 * 3. Handler Utama Serverless Function
 */
module.exports = async function handler(req, res) {
  // Hanya menerima metode GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Metode request tidak diizinkan. Hanya menerima GET.'
    });
  }

  // Validasi parameter ?word=...
  const rawWord = req.query?.word || (new URL(req.url, 'http://localhost')).searchParams.get('word');
  const word = sanitizeWord(rawWord);

  if (!word) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(400).json({
      error: 'Parameter kata (word) tidak valid. Hanya boleh huruf a-z, spasi, atau tanda hubung (-), maksimal 30 karakter.'
    });
  }

  // Jalur Mock Mode untuk Testing Lokal jika belum ada API key
  if (process.env.MOCK_MODE === 'true' && !process.env.YOUTUBE_API_KEY) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
    return res.status(200).json({
      word,
      query: `how to sign ${word} in ASL`,
      videos: [
        {
          videoId: '0FcwzMQ4i4Q',
          title: `How to Sign "${word.toUpperCase()}" in American Sign Language`,
          channelTitle: 'Learn How to Sign'
        },
        {
          videoId: 'tkMg8UGqNmA',
          title: `Sign Language for Beginners: "${word}"`,
          channelTitle: 'ASL Meredith'
        }
      ]
    });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(500).json({
      error: 'Kunci API YouTube (YOUTUBE_API_KEY) belum disetel di environment variables server.'
    });
  }

  try {
    const videos = await fetchYouTubeAslVideos(word, apiKey);

    // Jika video ditemukan, pasang cache panjang (24 jam edge cache, 12 jam stale)
    if (videos.length > 0) {
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    return res.status(200).json({
      word,
      query: `how to sign ${word} in ASL`,
      videos
    });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const statusCode = err.statusCode || (err.name === 'TimeoutError' ? 504 : 500);
    const message = err.message || 'Gagal memproses pencarian video isyarat.';
    return res.status(statusCode).json({
      error: message,
      isQuota: !!err.isQuota
    });
  }
};

// Vercel serverless function max duration
module.exports.config = { maxDuration: 20 };
