/**
 * LensLingo - Script Utama (Camera-First Mobile-First)
 * Langkah 4: Bottom Sheet, API Identify, Cache, Suara, Simpan Kata.
 */

// 1. Registrasi Konfigurasi Mode (Extensible Mode Registry)
const APP_MODES = {
  translation: { id: 'translation', title: 'Terjemahan', enabled: true },
  asl: { id: 'asl', title: 'ASL', enabled: true }
};

const STORAGE_KEYS = {
  ACTIVE_MODE: 'lenslingo_active_mode',
  SAVED_WORDS: 'lenslingo_saved_words',
  IDENTIFY_CACHE: 'lenslingo_cache',
  ASL_CACHE: 'lenslingo_asl_cache'
};

const CROP_CONFIG = {
  MAX_DIMENSION: 800,
  JPEG_QUALITY: 0.8,
  MIN_BOX_SIZE: 64
};

// Konfigurasi API & Sheet
const API_CONFIG = {
  ENDPOINT: '/api/identify',
  TIMEOUT_MS: 25000,
  COOLDOWN_MS: 3000,
  CACHE_MAX_ENTRIES: 20
};

// Konfigurasi API YouTube ASL
const ASL_CONFIG = {
  ENDPOINT: '/api/asl',
  TIMEOUT_MS: 15000,
  CACHE_MAX_ENTRIES: 30,
  CACHE_TTL_MS: 7 * 24 * 60 * 60 * 1000 // 7 hari
};

// Snap positions sheet (dalam persen dari bawah layar)
const SHEET_SNAPS = { SMALL: 20, MID: 50, FULL: 90 };

// 2. State Aplikasi
let currentStream = null;
let currentFacingMode = 'environment';
let activeModeId = 'translation';
let isFrameFrozen = false;
let currentCroppedData = null;

// State Bottom Sheet
let sheetCurrentSnap = SHEET_SNAPS.SMALL;
let sheetIsDragging = false;
let sheetDragStartY = 0;
let sheetDragStartTranslate = 0;
let sheetCurrentTranslate = 100; // 100 = tersembunyi di bawah

// State API
let lastRequestTime = 0;
let isApiRequestRunning = false;
let currentSheetData = null; // Data yang sedang ditampilkan di sheet

// Cache Hasil Identify (key: hash base64, value: { result, ts })
let identifyCache = {};

// Cache Hasil ASL YouTube (key: kata lowercase, value: { videos, ts })
let aslCache = {};

// State Khusus Mode ASL
let currentAslWord = null;
let currentAslVideos = [];
let currentAslIndex = 0;
let aslAbortController = null;
let isAslFetching = false;

// Data words.json yang dimuat di awal
let wordsData = [];

// State Interaksi Pointer Bounding Box
let isInteracting = false;
let interactionType = null; // 'drag' | 'resize'
let activeHandle = null;    // 'tl' | 'tr' | 'bl' | 'br'
let startPointerX = 0;
let startPointerY = 0;
let startBoxRect = { left: 0, top: 0, width: 0, height: 0 };

// 3. Elemen DOM
const cameraViewport = document.getElementById('cameraViewport');
const cameraVideo = document.getElementById('cameraVideo');
const freezeCanvas = document.getElementById('freezeCanvas');

const cameraNotice = document.getElementById('cameraNotice');
const cameraNoticeTitle = document.getElementById('cameraNoticeTitle');
const cameraNoticeMessage = document.getElementById('cameraNoticeMessage');
const btnNoticeGallery = document.getElementById('btnNoticeGallery');

const boundingBox = document.getElementById('boundingBox');
const cornerHandles = document.querySelectorAll('.corner-handle');
const scrimTop = document.getElementById('scrimTop');
const scrimBottom = document.getElementById('scrimBottom');
const scrimLeft = document.getElementById('scrimLeft');
const scrimRight = document.getElementById('scrimRight');

const liveActionsRow = document.getElementById('liveActionsRow');
const frozenActionsRow = document.getElementById('frozenActionsRow');
const btnShutter = document.getElementById('btnShutter');
const btnGallery = document.getElementById('btnGallery');
const btnFlipCamera = document.getElementById('btnFlipCamera');
const btnRetake = document.getElementById('btnRetake');
const btnAnalyzeCrop = document.getElementById('btnAnalyzeCrop');
const galleryFileInput = document.getElementById('galleryFileInput');

const cropInfoBadge = document.getElementById('cropInfoBadge');
const cropDimensionsText = document.getElementById('cropDimensionsText');
const cropSizeText = document.getElementById('cropSizeText');

const modeSwitcher = document.getElementById('modeSwitcher');
const modeChips = document.querySelectorAll('.mode-chip');

const btnOpenMenu = document.getElementById('btnOpenMenu');
const btnCloseMenu = document.getElementById('btnCloseMenu');
const menuOverlay = document.getElementById('menuOverlay');
const menuTabButtons = document.querySelectorAll('.menu-tab-btn');
const menuSubviews = document.querySelectorAll('.menu-subview');

// Elemen Bottom Sheet & Status
const statusOverlay = document.getElementById('statusOverlay');
const statusMessage = document.getElementById('statusMessage');
const bottomSheet = document.getElementById('bottomSheet');
const sheetHandle = document.getElementById('sheetHandle');
const sheetScrollArea = document.getElementById('sheetScrollArea');
const wordEn = document.getElementById('wordEn');
const wordId = document.getElementById('wordId');
const wordSourceBadge = document.getElementById('wordSourceBadge');
const sheetModeTabs = document.querySelectorAll('.sheet-mode-tab');
const translationContentBlock = document.getElementById('translationContentBlock');
const aslContentBlock = document.getElementById('aslContentBlock');

const aslIndexBadge = document.getElementById('aslIndexBadge');
const aslLoadingCard = document.getElementById('aslLoadingCard');
const aslPlayerWrapper = document.getElementById('aslPlayerWrapper');
const aslVideoSlot = document.getElementById('aslVideoSlot');
const aslCreditBlock = document.getElementById('aslCreditBlock');
const aslVideoTitle = document.getElementById('aslVideoTitle');
const aslVideoChannel = document.getElementById('aslVideoChannel');
const btnNextAslVideo = document.getElementById('btnNextAslVideo');
const aslFallbackCard = document.getElementById('aslFallbackCard');
const aslFallbackMsg = document.getElementById('aslFallbackMsg');
const btnOpenYouTubeSearch = document.getElementById('btnOpenYouTubeSearch');

const btnSpeakNormal = document.getElementById('btnSpeakNormal');
const btnSpeakSlow = document.getElementById('btnSpeakSlow');
const altChips = document.querySelectorAll('.alt-chip');
const exampleEn = document.getElementById('exampleEn');
const exampleId = document.getElementById('exampleId');
const manualWordInput = document.getElementById('manualWordInput');
const btnManualSubmit = document.getElementById('btnManualSubmit');
const btnSaveWord = document.getElementById('btnSaveWord');
const btnReanalyze = document.getElementById('btnReanalyze');
const btnRetakeFromSheet = document.getElementById('btnRetakeFromSheet');
const sheetError = document.getElementById('sheetError');
const sheetErrorText = document.getElementById('sheetErrorText');
const btnDismissSheetError = document.getElementById('btnDismissSheetError');
const savedWordCount = document.getElementById('savedWordCount');
const savedEmptyPrompt = document.getElementById('savedEmptyPrompt');
const savedWordsList = document.getElementById('savedWordsList');

/**
 * 4. Penyesuaian Panel Gelap (Scrim) Mengelilingi Bounding Box
 */
function updateScrimLayout() {
  if (!boundingBox) return;
  const rect = boundingBox.getBoundingClientRect();
  const parentWidth = window.innerWidth;
  const parentHeight = window.innerHeight;

  scrimTop.style.top = '0px';
  scrimTop.style.left = '0px';
  scrimTop.style.width = '100%';
  scrimTop.style.height = `${Math.max(0, rect.top)}px`;

  scrimBottom.style.top = `${rect.bottom}px`;
  scrimBottom.style.left = '0px';
  scrimBottom.style.width = '100%';
  scrimBottom.style.height = `${Math.max(0, parentHeight - rect.bottom)}px`;

  scrimLeft.style.top = `${rect.top}px`;
  scrimLeft.style.left = '0px';
  scrimLeft.style.width = `${Math.max(0, rect.left)}px`;
  scrimLeft.style.height = `${rect.height}px`;

  scrimRight.style.top = `${rect.top}px`;
  scrimRight.style.left = `${rect.right}px`;
  scrimRight.style.width = `${Math.max(0, parentWidth - rect.right)}px`;
  scrimRight.style.height = `${rect.height}px`;
}

/**
 * 5. Bounding Box - Memulai Interaksi Drag / Resize
 */
function handleBoxPointerDown(e) {
  if (e.target.classList.contains('corner-handle')) {
    interactionType = 'resize';
    activeHandle = e.target.dataset.handle;
  } else {
    interactionType = 'drag';
    activeHandle = null;
  }

  isInteracting = true;
  startPointerX = e.clientX;
  startPointerY = e.clientY;

  const currentRect = boundingBox.getBoundingClientRect();
  startBoxRect = {
    left: currentRect.left,
    top: currentRect.top,
    width: currentRect.width,
    height: currentRect.height
  };

  boundingBox.setPointerCapture(e.pointerId);
  e.preventDefault();
}

/**
 * 6. Bounding Box - Pergerakan Pointer (Menggeser atau Mengubah Ukuran)
 */
function handleBoxPointerMove(e) {
  if (!isInteracting) return;

  const deltaX = e.clientX - startPointerX;
  const deltaY = e.clientY - startPointerY;
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;

  if (interactionType === 'drag') {
    applyBoxDrag(deltaX, deltaY, vpWidth, vpHeight);
  } else if (interactionType === 'resize') {
    applyBoxResize(deltaX, deltaY, vpWidth, vpHeight);
  }

  updateScrimLayout();
}

/**
 * 7. Bounding Box - Eksekusi Pergeseran (Drag)
 */
function applyBoxDrag(deltaX, deltaY, vpWidth, vpHeight) {
  let newLeft = startBoxRect.left + deltaX;
  let newTop = startBoxRect.top + deltaY;

  newLeft = Math.max(0, Math.min(newLeft, vpWidth - startBoxRect.width));
  newTop = Math.max(0, Math.min(newTop, vpHeight - startBoxRect.height));

  boundingBox.style.left = `${newLeft}px`;
  boundingBox.style.top = `${newTop}px`;
  boundingBox.style.width = `${startBoxRect.width}px`;
  boundingBox.style.height = `${startBoxRect.height}px`;
}

/**
 * 8. Bounding Box - Eksekusi Pengubahan Ukuran Sudut (Resize)
 */
function applyBoxResize(deltaX, deltaY, vpWidth, vpHeight) {
  let { left, top, width, height } = startBoxRect;
  const minSize = CROP_CONFIG.MIN_BOX_SIZE;

  if (activeHandle === 'br') {
    width = Math.min(Math.max(minSize, width + deltaX), vpWidth - left);
    height = Math.min(Math.max(minSize, height + deltaY), vpHeight - top);
  } else if (activeHandle === 'bl') {
    const maxLeft = left + width - minSize;
    const newLeft = Math.max(0, Math.min(left + deltaX, maxLeft));
    width = left + width - newLeft;
    left = newLeft;
    height = Math.min(Math.max(minSize, height + deltaY), vpHeight - top);
  } else if (activeHandle === 'tr') {
    const maxTop = top + height - minSize;
    const newTop = Math.max(0, Math.min(top + deltaY, maxTop));
    height = top + height - newTop;
    top = newTop;
    width = Math.min(Math.max(minSize, width + deltaX), vpWidth - left);
  } else if (activeHandle === 'tl') {
    const maxLeft = left + width - minSize;
    const maxTop = top + height - minSize;
    const newLeft = Math.max(0, Math.min(left + deltaX, maxLeft));
    const newTop = Math.max(0, Math.min(top + deltaY, maxTop));
    width = left + width - newLeft;
    height = top + height - newTop;
    left = newLeft;
    top = newTop;
  }

  boundingBox.style.left = `${left}px`;
  boundingBox.style.top = `${top}px`;
  boundingBox.style.width = `${width}px`;
  boundingBox.style.height = `${height}px`;
}

/**
 * 9. Bounding Box - Selesai Interaksi
 */
function handleBoxPointerUp(e) {
  if (!isInteracting) return;
  isInteracting = false;
  try {
    boundingBox.releasePointerCapture(e.pointerId);
  } catch {
    // Abaikan jika pointer capture telah terlepas
  }
  if (isFrameFrozen) {
    updateCropPreviewInfo();
  }
}

/**
 * 10. Membekukan Frame Kamera (Shutter Action)
 */
function captureCameraFrame() {
  if (!currentStream || cameraVideo.readyState < 2) {
    return;
  }

  const videoWidth = cameraVideo.videoWidth || cameraVideo.clientWidth || 1280;
  const videoHeight = cameraVideo.videoHeight || cameraVideo.clientHeight || 720;

  freezeCanvas.width = videoWidth;
  freezeCanvas.height = videoHeight;
  const ctx = freezeCanvas.getContext('2d');
  ctx.drawImage(cameraVideo, 0, 0, videoWidth, videoHeight);

  freezeCanvas.hidden = false;
  cameraVideo.pause();
  isFrameFrozen = true;

  liveActionsRow.hidden = true;
  frozenActionsRow.hidden = false;

  updateCropPreviewInfo();
}

/**
 * 11. Mengembalikan Tampilan ke Kamera Live (Ambil Ulang)
 */
function retakeCamera() {
  freezeCanvas.hidden = true;
  isFrameFrozen = false;
  currentCroppedData = null;

  const ctx = freezeCanvas.getContext('2d');
  ctx.clearRect(0, 0, freezeCanvas.width, freezeCanvas.height);

  frozenActionsRow.hidden = true;
  liveActionsRow.hidden = false;
  cropInfoBadge.hidden = true;

  if (!currentStream) {
    showCameraNotice(
      'Kamera Memerlukan HTTPS',
      'Tidak dapat mengakses kamera live. Silakan pilih foto dari galeri untuk melanjutkan.'
    );
  } else {
    cameraVideo.play().catch(() => {});
  }
}

/**
 * 12. Memuat Gambar dari Galeri File (EXIF-Aware)
 */
async function handleGalleryFile(file) {
  if (!file) return;

  try {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Gagal membaca gambar galeri.'));
        };
        img.src = objectUrl;
      });
    }

    freezeCanvas.width = bitmap.width;
    freezeCanvas.height = bitmap.height;
    const ctx = freezeCanvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }

    freezeCanvas.hidden = false;
    cameraVideo.pause();
    isFrameFrozen = true;

    liveActionsRow.hidden = true;
    frozenActionsRow.hidden = false;
    hideCameraNotice();

    updateCropPreviewInfo();
  } catch (err) {
    showCameraNotice('Gagal Memuat Gambar', 'File gambar tidak dapat diproses. Coba pilih foto lain.');
  }
}

/**
 * 13. Menghitung Dimensi Scaling Maksimal 800px
 */
function scaleDimensions(width, height, maxDim) {
  if (width > height) {
    if (width > maxDim) {
      return { width: maxDim, height: Math.round((height * maxDim) / width) };
    }
  } else if (height > maxDim) {
    return { width: Math.round((width * maxDim) / height), height: maxDim };
  }
  return { width, height };
}

/**
 * 14. Menghitung Area Crop Bounding Box pada Dimensi Asli Gambar
 */
function calculateCropArea(srcWidth, srcHeight, boxRect) {
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;
  const scale = Math.max(vpWidth / srcWidth, vpHeight / srcHeight);
  const renderedWidth = srcWidth * scale;
  const renderedHeight = srcHeight * scale;
  const offsetX = (renderedWidth - vpWidth) / 2;
  const offsetY = (renderedHeight - vpHeight) / 2;

  const cropX = Math.max(0, Math.round((boxRect.left + offsetX) / scale));
  const cropY = Math.max(0, Math.round((boxRect.top + offsetY) / scale));
  const cropW = Math.min(srcWidth - cropX, Math.round(boxRect.width / scale));
  const cropH = Math.min(srcHeight - cropY, Math.round(boxRect.height / scale));

  return { cropX, cropY, cropW, cropH };
}

/**
 * 15. Merender Hasil Potongan ke Format JPEG Kualitas 0.8
 */
async function renderCanvasBlob(source, cropArea, targetDim) {
  const canvas = document.createElement('canvas');
  canvas.width = targetDim.width;
  canvas.height = targetDim.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    source,
    cropArea.cropX,
    cropArea.cropY,
    cropArea.cropW,
    cropArea.cropH,
    0,
    0,
    targetDim.width,
    targetDim.height
  );

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', CROP_CONFIG.JPEG_QUALITY);
  });
}

/**
 * 16. Memotong (Crop) Gambar di dalam Bounding Box & Kompresi JPEG 0.8
 */
async function cropBoundingBoxImage() {
  const source = isFrameFrozen ? freezeCanvas : cameraVideo;
  const srcWidth = isFrameFrozen ? freezeCanvas.width : (cameraVideo.videoWidth || cameraVideo.clientWidth);
  const srcHeight = isFrameFrozen ? freezeCanvas.height : (cameraVideo.videoHeight || cameraVideo.clientHeight);

  if (!srcWidth || !srcHeight) return null;

  const boxRect = boundingBox.getBoundingClientRect();
  const cropArea = calculateCropArea(srcWidth, srcHeight, boxRect);
  if (cropArea.cropW <= 0 || cropArea.cropH <= 0) return null;

  const targetDim = scaleDimensions(cropArea.cropW, cropArea.cropH, CROP_CONFIG.MAX_DIMENSION);
  const blob = await renderCanvasBlob(source, cropArea, targetDim);
  if (!blob) return null;

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return {
    blob,
    dataUrl,
    base64: dataUrl.split(',')[1],
    sizeKb: Math.round(blob.size / 1024),
    width: targetDim.width,
    height: targetDim.height
  };
}

/**
 * 15. Memperbarui Tampilan Informasi Crop di Layar
 */
async function updateCropPreviewInfo() {
  try {
    const cropData = await cropBoundingBoxImage();
    if (!cropData) return;
    currentCroppedData = cropData;
    cropDimensionsText.textContent = `${cropData.width} × ${cropData.height} px`;
    cropSizeText.textContent = `${cropData.sizeKb} KB`;
    cropInfoBadge.hidden = false;
  } catch {
    // Abaikan error saat kalkulasi frame belum siap
  }
}

/**
 * 16. Inisialisasi Aliran Video Kamera Langsung (getUserMedia)
 */
async function startCameraStream(facingMode = 'environment') {
  stopCameraStream();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraNotice(
      'Kamera Memerlukan HTTPS',
      'Browser membatasi kamera live pada sambungan non-HTTPS. Silakan pilih foto dari galeri untuk melanjutkan.'
    );
    return;
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    cameraVideo.srcObject = stream;
    await cameraVideo.play();
    hideCameraNotice();
    checkCameraDeviceCount();
    updateScrimLayout();
  } catch (err) {
    handleCameraStreamError(err);
  }
}

function stopCameraStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
}

function handleCameraStreamError(error) {
  let title = 'Kamera Tidak Tersedia';
  let message = 'Tidak dapat mengakses kamera. Silakan pilih foto dari galeri untuk melanjutkan.';

  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    title = 'Izin Kamera Ditolak';
    message = 'Mohon izinkan akses kamera di pengaturan browser Anda, atau gunakan foto dari galeri.';
  } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    title = 'Kamera Tidak Ditemukan';
    message = 'Tidak ada perangkat kamera yang terdeteksi di perangkat Anda.';
  }

  showCameraNotice(title, message);
}

function showCameraNotice(title, message) {
  cameraNoticeTitle.textContent = title;
  cameraNoticeMessage.textContent = message;
  cameraNotice.hidden = false;
}

function hideCameraNotice() {
  cameraNotice.hidden = true;
}

async function checkCameraDeviceCount() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    btnFlipCamera.hidden = true;
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((device) => device.kind === 'videoinput');
    btnFlipCamera.hidden = videoInputs.length <= 1;
  } catch {
    btnFlipCamera.hidden = false;
  }
}

async function toggleCameraFacing() {
  if (isFrameFrozen) return;
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  await startCameraStream(currentFacingMode);
}

function setAppMode(targetModeId) {
  const modeConfig = APP_MODES[targetModeId];
  if (!modeConfig || !modeConfig.enabled) return;

  activeModeId = targetModeId;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_MODE, targetModeId);

  // Update mode chips di bottom dock
  modeChips.forEach((chip) => {
    const isCurrent = chip.dataset.mode === targetModeId;
    chip.classList.toggle('active', isCurrent);
    chip.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
  });

  // Update tab mode di dalam bottom sheet
  sheetModeTabs.forEach((tab) => {
    const isCurrent = tab.dataset.sheetMode === targetModeId;
    tab.classList.toggle('active', isCurrent);
    tab.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
  });

  // Ganti tampilan blok konten di dalam bottom sheet
  const isAsl = targetModeId === 'asl';
  if (aslContentBlock) aslContentBlock.hidden = !isAsl;
  if (translationContentBlock) translationContentBlock.hidden = isAsl;

  // Jika beralih ke mode ASL dan hasil kata sudah ada di layar, langsung tampilkan video ASL (tanpa panggil Gemini)
  if (isAsl && currentSheetData && currentSheetData.word) {
    loadAslForCurrentWord(currentSheetData.word);
  }
}

function loadStoredAppMode() {
  const savedMode = localStorage.getItem(STORAGE_KEYS.ACTIVE_MODE);
  if (savedMode && APP_MODES[savedMode] && APP_MODES[savedMode].enabled) {
    setAppMode(savedMode);
  } else {
    setAppMode('translation');
  }
}

function openMenuOverlay() {
  menuOverlay.hidden = false;
}

function closeMenuOverlay() {
  menuOverlay.hidden = true;
}

function switchMenuView(targetViewName) {
  menuTabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.menuView === targetViewName);
  });

  menuSubviews.forEach((subview) => {
    const isTarget = subview.id === `menuView${targetViewName.charAt(0).toUpperCase() + targetViewName.slice(1)}`;
    subview.hidden = !isTarget;
  });
}

/**
 * 21. Memperbarui tombol Kenali Objek dan menyambungkannya ke API
 */
function setupCameraControlEvents() {
  btnShutter.addEventListener('click', captureCameraFrame);
  btnRetake.addEventListener('click', retakeCamera);

  btnAnalyzeCrop.addEventListener('click', async () => {
    const cropData = await cropBoundingBoxImage();
    if (cropData) {
      currentCroppedData = cropData;
      cropDimensionsText.textContent = `${cropData.width} × ${cropData.height} px`;
      cropSizeText.textContent = `${cropData.sizeKb} KB`;
      cropInfoBadge.hidden = false;
      await runIdentifyRequest(cropData);
    }
  });

  btnGallery.addEventListener('click', () => galleryFileInput.click());
  btnNoticeGallery.addEventListener('click', () => galleryFileInput.click());

  galleryFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleGalleryFile(file);
    galleryFileInput.value = '';
  });

  btnFlipCamera.addEventListener('click', toggleCameraFacing);
}

/* =====================================================================
   BOTTOM SHEET — Snap, Drag, Tampilkan Hasil
   ===================================================================== */

/**
 * 22. Menghitung tinggi sheet yang sudah terlihat (px) dari snap persen
 */
function snapToTranslateY(snapPercent) {
  const sheetHeight = bottomSheet.offsetHeight || window.innerHeight * 0.9;
  const visiblePx = (snapPercent / 100) * window.innerHeight;
  // translateY = tinggi sheet dikurangi bagian yang terlihat
  return Math.max(0, sheetHeight - visiblePx);
}

/**
 * 23. Pindahkan sheet ke snap position tertentu
 * @param {number} snapPercent - 20, 50, atau 90
 * @param {boolean} animate - gunakan transisi CSS
 */
function moveSheetToSnap(snapPercent, animate = true) {
  sheetCurrentSnap = snapPercent;
  const ty = snapToTranslateY(snapPercent);
  sheetCurrentTranslate = ty;

  if (!animate) {
    bottomSheet.style.transition = 'none';
  } else {
    bottomSheet.style.transition = '';
  }
  bottomSheet.style.transform = `translateY(${ty}px)`;

  // Aktifkan scroll di area konten hanya saat sheet penuh
  sheetScrollArea.style.overflow = snapPercent >= SHEET_SNAPS.FULL ? 'auto' : 'hidden';
}

/**
 * 24. Tampilkan Bottom Sheet
 */
function showBottomSheet(snapPercent = SHEET_SNAPS.SMALL) {
  bottomSheet.hidden = false;
  // Mulai dari bawah lalu animasikan ke snap
  bottomSheet.style.transition = 'none';
  bottomSheet.style.transform = 'translateY(100%)';
  // Paksa reflow agar transisi berjalan
  void bottomSheet.offsetHeight;
  moveSheetToSnap(snapPercent, true);
}

/**
 * 25. Sembunyikan Bottom Sheet
 */
function hideBottomSheet() {
  bottomSheet.style.transition = '';
  bottomSheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    bottomSheet.hidden = true;
  }, 350);
  sheetCurrentSnap = 0;
}

/**
 * 26. Drag sheet dengan Pointer Events
 */
function setupSheetDragEvents() {
  sheetHandle.addEventListener('pointerdown', (e) => {
    sheetIsDragging = true;
    sheetDragStartY = e.clientY;
    sheetDragStartTranslate = sheetCurrentTranslate;
    sheetHandle.setPointerCapture(e.pointerId);
    // Nonaktifkan transisi saat drag
    bottomSheet.style.transition = 'none';
  });

  sheetHandle.addEventListener('pointermove', (e) => {
    if (!sheetIsDragging) return;
    const delta = e.clientY - sheetDragStartY;
    const newTY = Math.max(0, sheetDragStartTranslate + delta);
    sheetCurrentTranslate = newTY;
    bottomSheet.style.transform = `translateY(${newTY}px)`;
  });

  sheetHandle.addEventListener('pointerup', () => {
    if (!sheetIsDragging) return;
    sheetIsDragging = false;
    snapSheetAfterDrag();
  });

  sheetHandle.addEventListener('pointercancel', () => {
    sheetIsDragging = false;
    snapSheetAfterDrag();
  });
}

/**
 * 27. Setelah drag selesai, snap ke posisi terdekat
 */
function snapSheetAfterDrag() {
  const sheetHeight = bottomSheet.offsetHeight || window.innerHeight * 0.9;
  // Hitung berapa persen layar yang terlihat sekarang
  const visiblePx = sheetHeight - sheetCurrentTranslate;
  const visiblePct = (visiblePx / window.innerHeight) * 100;

  // Tentukan snap terdekat
  const snaps = [SHEET_SNAPS.SMALL, SHEET_SNAPS.MID, SHEET_SNAPS.FULL];
  let closest = snaps[0];
  let minDiff = Math.abs(visiblePct - snaps[0]);

  for (const snap of snaps) {
    const diff = Math.abs(visiblePct - snap);
    if (diff < minDiff) {
      minDiff = diff;
      closest = snap;
    }
  }

  // Kalau ditarik jauh ke bawah (< 10% terlihat), sembunyikan sheet
  if (visiblePct < 10) {
    hideBottomSheet();
    return;
  }

  moveSheetToSnap(closest, true);
}

/* =====================================================================
   CACHE localStorage — Hindari request ulang untuk gambar yang sama
   ===================================================================== */

/**
 * 28. Muat cache dari localStorage
 */
function loadIdentifyCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.IDENTIFY_CACHE);
    identifyCache = raw ? JSON.parse(raw) : {};
  } catch {
    identifyCache = {};
  }
}

/**
 * 29. Buat kunci hash sederhana dari data base64
 * (panjang + 8 karakter pertama + 8 terakhir)
 */
function makeBase64Hash(base64Str) {
  const len = base64Str.length;
  return `${len}_${base64Str.slice(0, 8)}_${base64Str.slice(-8)}`;
}

/**
 * 30. Ambil dari cache (null kalau tidak ada)
 */
function getCachedResult(base64Str) {
  const key = makeBase64Hash(base64Str);
  return identifyCache[key] || null;
}

/**
 * 31. Simpan ke cache (maks 20 entri, buang yang tertua)
 */
function setCachedResult(base64Str, result) {
  const key = makeBase64Hash(base64Str);
  identifyCache[key] = { result, ts: Date.now() };

  // Batasi maks 20 entri
  const keys = Object.keys(identifyCache);
  if (keys.length > API_CONFIG.CACHE_MAX_ENTRIES) {
    // Urutkan dari terlama, buang yang terlama
    keys.sort((a, b) => identifyCache[a].ts - identifyCache[b].ts);
    delete identifyCache[keys[0]];
  }

  try {
    localStorage.setItem(STORAGE_KEYS.IDENTIFY_CACHE, JSON.stringify(identifyCache));
  } catch {
    // Abaikan QuotaExceededError
  }
}

/**
 * 31b. Muat cache video ASL dari localStorage
 */
function loadAslCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ASL_CACHE);
    aslCache = raw ? JSON.parse(raw) : {};
  } catch {
    aslCache = {};
  }
}

/**
 * 31c. Ambil video ASL dari cache jika masih berlaku
 */
function getCachedAsl(word) {
  if (!word) return null;
  const key = word.toLowerCase().trim();
  const entry = aslCache[key];
  if (!entry) return null;

  // Cek apakah data sudah kedaluwarsa (TTL 7 hari)
  if (Date.now() - entry.ts > ASL_CONFIG.CACHE_TTL_MS) {
    delete aslCache[key];
    return null;
  }
  return entry.videos || null;
}

/**
 * 31d. Simpan video ASL ke cache (hanya video sukses, maks 30 entri)
 */
function setCachedAsl(word, videos) {
  if (!word || !Array.isArray(videos) || videos.length === 0) return;
  const key = word.toLowerCase().trim();
  aslCache[key] = { videos, ts: Date.now() };

  // Batasi maksimal 30 entri
  const keys = Object.keys(aslCache);
  if (keys.length > ASL_CONFIG.CACHE_MAX_ENTRIES) {
    keys.sort((a, b) => aslCache[a].ts - aslCache[b].ts);
    delete aslCache[keys[0]];
  }

  try {
    localStorage.setItem(STORAGE_KEYS.ASL_CACHE, JSON.stringify(aslCache));
  } catch {
    // Abaikan QuotaExceededError
  }
}

/* =====================================================================
   WORDS.JSON — Muat data kata lokal untuk pengayaan arti
   ===================================================================== */

/**
 * 32. Muat words.json di awal aplikasi
 */
async function loadWordsData() {
  try {
    const res = await fetch('data/words.json');
    if (res.ok) {
      wordsData = await res.json();
    }
  } catch {
    wordsData = [];
  }
}

/**
 * 33. Cari kata di words.json (case-insensitive, handle jamak sederhana)
 * @returns {object|null} data kata atau null
 */
function findWordLocal(word) {
  if (!word) return null;
  const lower = word.toLowerCase().trim();
  // Coba tepat
  let found = wordsData.find((w) => w.english && w.english.toLowerCase() === lower);
  if (found) return found;
  // Coba strip 's' di akhir (jamak dasar)
  if (lower.endsWith('s')) {
    const singular = lower.slice(0, -1);
    found = wordsData.find((w) => w.english && w.english.toLowerCase() === singular);
    if (found) return found;
  }
  return null;
}

/* =====================================================================
   SPEECH SYNTHESIS — Suara pengucapan
   ===================================================================== */

/**
 * 34. Ucapkan kata dalam bahasa Inggris
 * @param {string} word
 * @param {number} rate - 1.0 normal, 0.5 pelan
 */
function speakWord(word, rate = 1.0) {
  if (!word || !window.speechSynthesis) {
    showSheetError('Browser ini tidak mendukung fitur suara pengucapan.');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
}

/* =====================================================================
   TAMPILKAN HASIL DI SHEET
   ===================================================================== */

/**
 * 35. Isi konten sheet dengan data hasil identify
 * @param {object} data - { word, indonesian, alternatives, example_en, example_id, fromAI }
 */
function populateSheet(data) {
  currentSheetData = data;

  // Kata utama
  wordEn.textContent = data.word || '-';

  // Arti — utamakan words.json, fallback ke data dari Gemini
  const localWord = findWordLocal(data.word);
  if (localWord && localWord.indonesian) {
    wordId.textContent = localWord.indonesian;
    wordSourceBadge.hidden = true;
  } else if (data.indonesian) {
    wordId.textContent = data.indonesian;
    wordSourceBadge.hidden = false;
  } else {
    wordId.textContent = 'Arti belum tersedia';
    wordSourceBadge.hidden = true;
  }

  // Chip alternatif
  altChips.forEach((chip, i) => {
    const alt = data.alternatives && data.alternatives[i];
    if (alt) {
      chip.textContent = alt;
      chip.removeAttribute('data-empty');
      chip.disabled = false;
      chip.classList.remove('active');
    } else {
      chip.textContent = '-';
      chip.setAttribute('data-empty', 'true');
      chip.disabled = true;
    }
  });

  // Contoh kalimat
  exampleEn.textContent = data.example_en || '-';
  exampleId.textContent = data.example_id || '-';

  // Bersihkan input manual
  manualWordInput.value = '';

  // Sembunyikan error jika ada
  hideSheetError();

  // Sinkronkan tampilan mode aktif (Terjemahan vs ASL)
  const isAsl = activeModeId === 'asl';
  if (aslContentBlock) aslContentBlock.hidden = !isAsl;
  if (translationContentBlock) translationContentBlock.hidden = isAsl;

  // Jika sedang dalam mode ASL dan ada kata, langsung muat video ASL
  if (isAsl && data.word) {
    loadAslForCurrentWord(data.word);
  } else {
    currentAslWord = null;
  }
}

/**
 * 36. Ketika chip alternatif ditekan — tampilkan kata alternatif itu di sheet
 */
function handleAltChipClick(chip) {
  const altWord = chip.textContent;
  if (!altWord || altWord === '-') return;

  // Tandai chip yang dipilih
  altChips.forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');

  // Buat data sementara untuk kata alternatif
  const localWord = findWordLocal(altWord);
  const altData = {
    word: altWord,
    indonesian: localWord ? localWord.indonesian : currentSheetData.indonesian,
    alternatives: currentSheetData ? currentSheetData.alternatives : [],
    example_en: currentSheetData ? currentSheetData.example_en : '-',
    example_id: currentSheetData ? currentSheetData.example_id : '-',
    fromAI: !localWord
  };

  // Update tampilan kata tanpa request API baru
  wordEn.textContent = altData.word;
  if (localWord && localWord.indonesian) {
    wordId.textContent = localWord.indonesian;
    wordSourceBadge.hidden = true;
  } else {
    wordId.textContent = currentSheetData ? currentSheetData.indonesian : '-';
    wordSourceBadge.hidden = false;
  }
  currentSheetData = { ...currentSheetData, word: altData.word };

  // Jika sedang dalam mode ASL, langsung perbarui video untuk kata alternatif ini
  if (activeModeId === 'asl' && altData.word) {
    loadAslForCurrentWord(altData.word);
  }
}

/* =====================================================================
   MANAJEMEN VIDEO ISYARAT ASL (YouTube Data API v3)
   ===================================================================== */

/**
 * 36b. Memuat daftar video ASL untuk kata yang aktif
 * Membatalkan request lama jika kata berganti cepat, mencegah klik berulang,
 * dan menggunakan cache browser jika sudah pernah dicari.
 */
async function loadAslForCurrentWord(word) {
  if (!word || typeof word !== 'string') return;
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord) return;

  // Jika kata sama dan video sudah tampil, tidak perlu memuat ulang
  if (currentAslWord === cleanWord && currentAslVideos.length > 0 && !aslPlayerWrapper.hidden) {
    return;
  }

  // Batalkan request yang sedang berjalan jika kata berganti cepat
  if (aslAbortController) {
    aslAbortController.abort();
    aslAbortController = null;
  }

  currentAslWord = cleanWord;
  currentAslVideos = [];
  currentAslIndex = 0;

  // Bersihkan slot video sebelumnya
  if (aslVideoSlot) aslVideoSlot.innerHTML = '';

  // Atur state tampilan ke kondisi memuat (loading)
  if (aslLoadingCard) aslLoadingCard.hidden = false;
  if (aslPlayerWrapper) aslPlayerWrapper.hidden = true;
  if (aslCreditBlock) aslCreditBlock.hidden = true;
  if (btnNextAslVideo) btnNextAslVideo.hidden = true;
  if (aslIndexBadge) aslIndexBadge.hidden = true;
  if (aslFallbackCard) aslFallbackCard.hidden = true;

  // 1. Periksa cache lokal terlebih dahulu
  const cachedVideos = getCachedAsl(cleanWord);
  if (cachedVideos && cachedVideos.length > 0) {
    currentAslVideos = cachedVideos;
    if (aslLoadingCard) aslLoadingCard.hidden = true;
    renderCurrentAslVideo();
    return;
  }

  // 2. Cegah klik berulang dan panggil API /api/asl
  if (isAslFetching) return;
  isAslFetching = true;

  const controller = new AbortController();
  aslAbortController = controller;

  try {
    const url = `${ASL_CONFIG.ENDPOINT}?word=${encodeURIComponent(cleanWord)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Gagal membaca data dari server video.');
    }

    if (!response.ok) {
      throw new Error(data.error || 'Gagal mencari video isyarat.');
    }

    const videos = Array.isArray(data.videos) ? data.videos : [];
    if (videos.length === 0) {
      showAslFallback(`Tidak ditemukan video isyarat untuk kata "${cleanWord}".`, cleanWord);
      return;
    }

    // Simpan ke cache (hanya hasil sukses)
    setCachedAsl(cleanWord, videos);

    currentAslVideos = videos;
    currentAslIndex = 0;
    if (aslLoadingCard) aslLoadingCard.hidden = true;
    renderCurrentAslVideo();

  } catch (err) {
    // Abaikan jika request dibatalkan karena pengguna mengganti kata
    if (err.name === 'AbortError') return;

    if (aslLoadingCard) aslLoadingCard.hidden = true;
    const errorMsg = err.message || 'Pencarian video isyarat mengalami kendala.';
    showAslFallback(errorMsg, cleanWord);

  } finally {
    isAslFetching = false;
    aslAbortController = null;
  }
}

/**
 * 36c. Menyematkan video iframe dan informasi kredit di layar
 */
function renderCurrentAslVideo() {
  if (!currentAslVideos || currentAslVideos.length === 0) return;

  const video = currentAslVideos[currentAslIndex];
  if (!video || !video.videoId) return;

  // Bersihkan dan sematkan iframe baru via JavaScript (hanya saat ada video)
  if (aslVideoSlot) {
    aslVideoSlot.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?autoplay=1&mute=1&playsinline=1&rel=0`;
    iframe.title = video.title || 'Video Isyarat ASL';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    aslVideoSlot.appendChild(iframe);
  }

  // Tampilkan judul dan nama channel dengan textContent (keamanan anti XSS)
  if (aslVideoTitle) aslVideoTitle.textContent = video.title || '-';
  if (aslVideoChannel) aslVideoChannel.textContent = video.channelTitle ? `Oleh: ${video.channelTitle}` : '';

  // Perbarui indikator video (misal: Video 1/5)
  if (aslIndexBadge) {
    aslIndexBadge.textContent = `Video ${currentAslIndex + 1}/${currentAslVideos.length}`;
    aslIndexBadge.hidden = currentAslVideos.length <= 1;
  }

  // Tampilkan tombol "Coba video lain" hanya jika ada lebih dari 1 video
  if (btnNextAslVideo) {
    btnNextAslVideo.hidden = currentAslVideos.length <= 1;
  }

  if (aslPlayerWrapper) aslPlayerWrapper.hidden = false;
  if (aslCreditBlock) aslCreditBlock.hidden = false;
  if (aslFallbackCard) aslFallbackCard.hidden = true;
}

/**
 * 36d. Berpindah ke video berikutnya (berputar kembali jika habis)
 */
function handleNextAslVideo() {
  if (!currentAslVideos || currentAslVideos.length <= 1) return;
  currentAslIndex = (currentAslIndex + 1) % currentAslVideos.length;
  renderCurrentAslVideo();
}

/**
 * 36e. Menampilkan kartu fallback dengan tombol langsung ke YouTube
 */
function showAslFallback(message, word) {
  if (aslPlayerWrapper) aslPlayerWrapper.hidden = true;
  if (aslCreditBlock) aslCreditBlock.hidden = true;
  if (btnNextAslVideo) btnNextAslVideo.hidden = true;
  if (aslIndexBadge) aslIndexBadge.hidden = true;

  if (aslFallbackMsg) aslFallbackMsg.textContent = message;

  if (btnOpenYouTubeSearch) {
    const encodedQuery = encodeURIComponent(`how to sign ${word || ''} in ASL`);
    btnOpenYouTubeSearch.href = `https://www.youtube.com/results?search_query=${encodedQuery}`;
  }

  if (aslFallbackCard) aslFallbackCard.hidden = false;
}

/* =====================================================================
   PESAN ERROR DI SHEET
   ===================================================================== */

function showSheetError(message) {
  sheetErrorText.textContent = message;
  sheetError.hidden = false;
}

function hideSheetError() {
  sheetError.hidden = true;
}

/* =====================================================================
   STATUS SPINNER
   ===================================================================== */

function showStatus(message) {
  statusMessage.textContent = message;
  statusOverlay.hidden = false;
}

function hideStatus() {
  statusOverlay.hidden = true;
}

/* =====================================================================
   REQUEST API IDENTIFY — Kirim gambar ke backend
   ===================================================================== */

/**
 * 37. Kirim potongan gambar ke /api/identify
 * @param {object} cropData - { base64, ... }
 */
async function runIdentifyRequest(cropData) {
  if (!cropData || !cropData.base64) return;

  // Cooldown: hindari request terlalu cepat
  const now = Date.now();
  if (now - lastRequestTime < API_CONFIG.COOLDOWN_MS) {
    const sisaDetik = Math.ceil((API_CONFIG.COOLDOWN_MS - (now - lastRequestTime)) / 1000);
    showSheetError(`Tunggu ${sisaDetik} detik sebelum mencari lagi.`);
    if (bottomSheet.hidden) showBottomSheet(SHEET_SNAPS.SMALL);
    return;
  }

  // Cek cache dulu
  const cached = getCachedResult(cropData.base64);
  if (cached) {
    populateSheet(cached.result);
    showBottomSheet(SHEET_SNAPS.SMALL);
    return;
  }

  // Cegah double request
  if (isApiRequestRunning) return;
  isApiRequestRunning = true;
  lastRequestTime = now;

  // Nonaktifkan tombol agar tidak bisa ditekan ganda
  btnAnalyzeCrop.disabled = true;

  showStatus('Mengunggah gambar...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  try {
    showStatus('Mengenali benda...');

    const response = await fetch(API_CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: cropData.base64 }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    let responseData;
    try {
      responseData = await response.json();
    } catch {
      throw new Error('Server mengembalikan respons yang tidak dapat dibaca.');
    }

    if (!response.ok) {
      throw new Error(responseData.error || `Terjadi kesalahan server (${response.status}).`);
    }

    // Simpan ke cache
    setCachedResult(cropData.base64, responseData);

    hideStatus();
    populateSheet(responseData);
    showBottomSheet(SHEET_SNAPS.SMALL);

  } catch (err) {
    clearTimeout(timeoutId);
    hideStatus();

    let pesan;
    if (err.name === 'AbortError') {
      pesan = 'Waktu pengenalan habis (timeout 25 detik). Coba lagi.';
    } else {
      pesan = err.message || 'Gagal mengenali objek. Periksa koneksi internet.';
    }

    // Tampilkan error di sheet agar user tahu
    if (bottomSheet.hidden) {
      // Jika sheet belum terbuka, isi dengan data kosong dulu lalu tampilkan error
      populateSheet({ word: '', indonesian: '', alternatives: ['', '', ''], example_en: '', example_id: '' });
      showBottomSheet(SHEET_SNAPS.SMALL);
    }
    showSheetError(pesan);

  } finally {
    isApiRequestRunning = false;
    btnAnalyzeCrop.disabled = false;
  }
}

/* =====================================================================
   SIMPAN KATA KE DAFTAR BELAJARKU
   ===================================================================== */

/**
 * 38. Muat daftar kata tersimpan dari localStorage
 */
function loadSavedWords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_WORDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 39. Simpan kata ke localStorage
 */
function saveWordToList(wordData) {
  const saved = loadSavedWords();
  // Hindari duplikat (berdasarkan kata Inggris)
  const exists = saved.some(
    (w) => w.english && w.english.toLowerCase() === (wordData.english || '').toLowerCase()
  );
  if (exists) return false;

  saved.unshift({
    english: wordData.english,
    indonesian: wordData.indonesian,
    savedAt: Date.now()
  });

  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_WORDS, JSON.stringify(saved));
  } catch {
    // QuotaExceededError
  }
  return true;
}

/**
 * 40. Render ulang daftar kata tersimpan di menu overlay
 */
function renderSavedWordsList() {
  const saved = loadSavedWords();
  savedWordCount.textContent = `${saved.length} kata`;

  if (saved.length === 0) {
    savedEmptyPrompt.hidden = false;
    savedWordsList.innerHTML = '';
    return;
  }

  savedEmptyPrompt.hidden = true;
  savedWordsList.innerHTML = '';

  saved.forEach((w) => {
    const li = document.createElement('li');
    li.className = 'saved-word-item';

    const enSpan = document.createElement('span');
    enSpan.className = 'saved-word-en';
    enSpan.textContent = w.english || '-';

    const idSpan = document.createElement('span');
    idSpan.className = 'saved-word-id';
    idSpan.textContent = w.indonesian || '-';

    li.appendChild(enSpan);
    li.appendChild(idSpan);
    savedWordsList.appendChild(li);
  });
}

/**
 * 41. Listener tombol Simpan ke Daftar
 */
function handleSaveWord() {
  if (!currentSheetData || !currentSheetData.word) {
    showSheetError('Tidak ada kata yang bisa disimpan saat ini.');
    return;
  }

  const localEntry = findWordLocal(currentSheetData.word);
  const indonesian = localEntry
    ? localEntry.indonesian
    : currentSheetData.indonesian || '';

  const success = saveWordToList({
    english: currentSheetData.word,
    indonesian
  });

  if (success) {
    btnSaveWord.textContent = '✓ Tersimpan!';
    btnSaveWord.disabled = true;
    renderSavedWordsList();
    setTimeout(() => {
      btnSaveWord.innerHTML = `<svg viewBox="0 0 24 24" class="svg-icon" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg> Simpan ke Daftar Belajarku`;
      btnSaveWord.disabled = false;
    }, 2000);
  } else {
    showSheetError(`"${currentSheetData.word}" sudah ada di daftar belajarmu.`);
  }
}

/**
 * 42. Listener tombol Ketik Manual
 */
function handleManualSubmit() {
  const rawInput = manualWordInput.value.trim();
  if (!rawInput) return;

  // Sanitasi input manual: hanya huruf, spasi, dan tanda hubung
  const cleaned = rawInput.toLowerCase().replace(/[^a-z\s-]/g, '').slice(0, 30);
  if (!cleaned) {
    showSheetError('Kata yang dimasukkan tidak valid. Hanya boleh huruf a-z, spasi, atau tanda hubung (-).');
    return;
  }

  const localWord = findWordLocal(cleaned);
  const manualData = {
    word: cleaned,
    indonesian: localWord ? localWord.indonesian : '(arti belum tersedia)',
    alternatives: currentSheetData ? currentSheetData.alternatives : ['', '', ''],
    example_en: localWord ? '' : (currentSheetData ? currentSheetData.example_en : ''),
    example_id: localWord ? '' : (currentSheetData ? currentSheetData.example_id : ''),
    fromAI: false
  };

  populateSheet(manualData);
  manualWordInput.blur();
}

/**
 * 18. Listener untuk Interaksi Bounding Box
 */
function setupBoundingBoxEvents() {
  boundingBox.addEventListener('pointerdown', handleBoxPointerDown);
  window.addEventListener('pointermove', handleBoxPointerMove);
  window.addEventListener('pointerup', handleBoxPointerUp);
  window.addEventListener('pointercancel', handleBoxPointerUp);
}

/**
 * 19. Listener untuk Tombol Kontrol Kamera & Galeri
 */
function setupCameraControlEvents() {
  btnShutter.addEventListener('click', captureCameraFrame);
  btnRetake.addEventListener('click', retakeCamera);

  btnAnalyzeCrop.addEventListener('click', async () => {
    const cropData = await cropBoundingBoxImage();
    if (cropData) {
      currentCroppedData = cropData;
      cropDimensionsText.textContent = `${cropData.width} × ${cropData.height} px`;
      cropSizeText.textContent = `${cropData.sizeKb} KB`;
      cropInfoBadge.hidden = false;
      await runIdentifyRequest(cropData);
    }
  });

  btnGallery.addEventListener('click', () => galleryFileInput.click());
  btnNoticeGallery.addEventListener('click', () => galleryFileInput.click());

  galleryFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleGalleryFile(file);
    galleryFileInput.value = '';
  });

  btnFlipCamera.addEventListener('click', toggleCameraFacing);
}

/**
 * 20. Listener untuk Mode Switcher, Menu Overlay, Sheet, dan Tombol Hasil
 */
function setupMenuAndModeEvents() {
  // Mode switcher chips
  modeChips.forEach((chip) => {
    chip.addEventListener('click', () => setAppMode(chip.dataset.mode));
  });

  // Tab mode di dalam bottom sheet
  sheetModeTabs.forEach((tab) => {
    tab.addEventListener('click', () => setAppMode(tab.dataset.sheetMode));
  });

  // Tombol ganti video ASL
  if (btnNextAslVideo) {
    btnNextAslVideo.addEventListener('click', handleNextAslVideo);
  }

  // Menu overlay
  btnOpenMenu.addEventListener('click', openMenuOverlay);
  btnCloseMenu.addEventListener('click', closeMenuOverlay);

  menuTabButtons.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => switchMenuView(tabBtn.dataset.menuView));
  });

  // Resize & orientasi
  window.addEventListener('resize', updateScrimLayout);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateScrimLayout, 150);
  });

  // Sheet drag handle
  setupSheetDragEvents();

  // Tombol audio di sheet
  btnSpeakNormal.addEventListener('click', () => {
    const word = wordEn.textContent;
    if (word && word !== '-') speakWord(word, 1.0);
  });
  btnSpeakSlow.addEventListener('click', () => {
    const word = wordEn.textContent;
    if (word && word !== '-') speakWord(word, 0.5);
  });

  // Chip alternatif
  altChips.forEach((chip) => {
    chip.addEventListener('click', () => handleAltChipClick(chip));
  });

  // Simpan kata
  btnSaveWord.addEventListener('click', handleSaveWord);

  // Input manual
  btnManualSubmit.addEventListener('click', handleManualSubmit);
  manualWordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleManualSubmit();
  });

  // Tombol Cari Ulang — crop ulang area bounding box saat ini lalu kirim
  btnReanalyze.addEventListener('click', async () => {
    hideSheetError();
    const cropData = await cropBoundingBoxImage();
    if (cropData) {
      currentCroppedData = cropData;
      await runIdentifyRequest(cropData);
    }
  });

  // Tombol Ambil Ulang dari dalam sheet
  btnRetakeFromSheet.addEventListener('click', () => {
    hideBottomSheet();
    retakeCamera();
  });

  // Tutup pesan error di sheet
  btnDismissSheetError.addEventListener('click', hideSheetError);

  // Tutup menu juga saat klik tombol Ambil Ulang di baris frozen
  btnRetake.addEventListener('click', () => hideBottomSheet());
}

/**
 * 21. Inisialisasi Seluruh Listener Event
 */
function setupEventListeners() {
  setupBoundingBoxEvents();
  setupCameraControlEvents();
  setupMenuAndModeEvents();
}

/**
 * 18. Inisialisasi Aplikasi Utama
 */
function initializeApp() {
  setupEventListeners();
  loadStoredAppMode();
  loadIdentifyCache();
  loadAslCache();
  loadWordsData();
  renderSavedWordsList();
  updateScrimLayout();
  startCameraStream(currentFacingMode);
}

document.addEventListener('DOMContentLoaded', initializeApp);
