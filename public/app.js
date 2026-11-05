/**
 * LensLingo - Script Utama (Camera-First Mobile-First)
 * Langkah 2: Bounding Box (Drag & Resize), Shutter, Frame Freezing, Crop & Resize, Galeri.
 */

// 1. Registrasi Konfigurasi Mode (Extensible Mode Registry)
const APP_MODES = {
  translation: { id: 'translation', title: 'Terjemahan', enabled: true },
  asl: { id: 'asl', title: 'ASL', enabled: false, badge: 'Segera' }
};

const STORAGE_KEYS = {
  ACTIVE_MODE: 'lenslingo_active_mode',
  SAVED_WORDS: 'lenslingo_saved_words'
};

const CROP_CONFIG = {
  MAX_DIMENSION: 800,
  JPEG_QUALITY: 0.8,
  MIN_BOX_SIZE: 64
};

// 2. State Aplikasi
let currentStream = null;
let currentFacingMode = 'environment';
let activeModeId = 'translation';
let isFrameFrozen = false;
let currentCroppedData = null;

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

  modeChips.forEach((chip) => {
    const isCurrent = chip.dataset.mode === targetModeId;
    chip.classList.toggle('active', isCurrent);
    chip.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
  });
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
      cropSizeText.textContent = `${cropData.sizeKb} KB (Siap)`;
      cropInfoBadge.hidden = false;
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
 * 20. Listener untuk Mode Switcher dan Menu Overlay
 */
function setupMenuAndModeEvents() {
  modeChips.forEach((chip) => {
    chip.addEventListener('click', () => setAppMode(chip.dataset.mode));
  });

  btnOpenMenu.addEventListener('click', openMenuOverlay);
  btnCloseMenu.addEventListener('click', closeMenuOverlay);

  menuTabButtons.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => switchMenuView(tabBtn.dataset.menuView));
  });

  window.addEventListener('resize', updateScrimLayout);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateScrimLayout, 150);
  });
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
  updateScrimLayout();
  startCameraStream(currentFacingMode);
}

document.addEventListener('DOMContentLoaded', initializeApp);
