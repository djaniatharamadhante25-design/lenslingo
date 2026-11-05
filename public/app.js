/**
 * LensLingo - Script Utama (Camera-First Mobile-First)
 * Langkah 1: Kerangka UI, Kamera Full-Screen, Palet Sage, dan Mode Switcher.
 */

// 1. Registrasi Konfigurasi Mode (Extensible Mode Registry)
const APP_MODES = {
  translation: {
    id: 'translation',
    title: 'Terjemahan',
    enabled: true
  },
  asl: {
    id: 'asl',
    title: 'ASL',
    enabled: false,
    badge: 'Segera'
  }
};

const STORAGE_KEYS = {
  ACTIVE_MODE: 'lenslingo_active_mode',
  SAVED_WORDS: 'lenslingo_saved_words'
};

// 2. State Aplikasi
let currentStream = null;
let currentFacingMode = 'environment';
let activeModeId = 'translation';

// 3. Elemen DOM Utama
const cameraVideo = document.getElementById('cameraVideo');
const cameraNotice = document.getElementById('cameraNotice');
const cameraNoticeTitle = document.getElementById('cameraNoticeTitle');
const cameraNoticeMessage = document.getElementById('cameraNoticeMessage');
const btnNoticeGallery = document.getElementById('btnNoticeGallery');

const boundingBox = document.getElementById('boundingBox');
const scrimTop = document.getElementById('scrimTop');
const scrimBottom = document.getElementById('scrimBottom');
const scrimLeft = document.getElementById('scrimLeft');
const scrimRight = document.getElementById('scrimRight');

const btnShutter = document.getElementById('btnShutter');
const btnGallery = document.getElementById('btnGallery');
const btnFlipCamera = document.getElementById('btnFlipCamera');
const galleryFileInput = document.getElementById('galleryFileInput');

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
  scrimTop.style.height = `${rect.top}px`;

  scrimBottom.style.top = `${rect.bottom}px`;
  scrimBottom.style.left = '0px';
  scrimBottom.style.width = '100%';
  scrimBottom.style.height = `${parentHeight - rect.bottom}px`;

  scrimLeft.style.top = `${rect.top}px`;
  scrimLeft.style.left = '0px';
  scrimLeft.style.width = `${rect.left}px`;
  scrimLeft.style.height = `${rect.height}px`;

  scrimRight.style.top = `${rect.top}px`;
  scrimRight.style.left = `${rect.right}px`;
  scrimRight.style.width = `${parentWidth - rect.right}px`;
  scrimRight.style.height = `${rect.height}px`;
}

/**
 * 5. Inisialisasi Aliran Video Kamera Langsung (getUserMedia)
 */
async function startCameraStream(facingMode = 'environment') {
  stopCameraStream();

  // Validasi dukungan browser dan konteks aman (HTTPS / localhost)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraNotice(
      'Kamera Tidak Didukung',
      'Browser atau koneksi Anda belum mendukung kamera web (memerlukan HTTPS). Silakan pilih foto dari galeri.'
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
  } catch (err) {
    handleCameraStreamError(err);
  }
}

/**
 * 6. Menghentikan Aliran Kamera Saat Ini
 */
function stopCameraStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
}

/**
 * 7. Penanganan Error Kamera (Izin, Perangkat, atau HTTPS)
 */
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

/**
 * 8. Menampilkan Kartu Pemberitahuan Kamera
 */
function showCameraNotice(title, message) {
  cameraNoticeTitle.textContent = title;
  cameraNoticeMessage.textContent = message;
  cameraNotice.hidden = false;
}

/**
 * 9. Menyembunyikan Kartu Pemberitahuan Kamera
 */
function hideCameraNotice() {
  cameraNotice.hidden = true;
}

/**
 * 10. Memeriksa Jumlah Kamera (Sembunyikan Tombol Flip Jika Hanya 1 Kamera)
 */
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

/**
 * 11. Beralih Kamera Depan / Belakang
 */
async function toggleCameraFacing() {
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  await startCameraStream(currentFacingMode);
}

/**
 * 12. Manajemen Mode Switcher (Terjemahan vs ASL)
 */
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

/**
 * 13. Memuat Mode dari LocalStorage Saat Aplikasi Dimulai
 */
function loadStoredAppMode() {
  const savedMode = localStorage.getItem(STORAGE_KEYS.ACTIVE_MODE);
  if (savedMode && APP_MODES[savedMode] && APP_MODES[savedMode].enabled) {
    setAppMode(savedMode);
  } else {
    setAppMode('translation');
  }
}

/**
 * 14. Kontrol Overlay Menu Layar Penuh
 */
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
    const shouldShow = subview.id === `menuView${capitalizeFirst(targetViewName)}`;
    subview.hidden = !shouldShow;
  });
}

function capitalizeFirst(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * 15. Inisialisasi Seluruh Listener Event Antarmuka
 */
function setupEventListeners() {
  // Tombol Shutter & Galeri
  btnShutter.addEventListener('click', () => {
    // Shutter klik memberi efek aktif
  });

  btnGallery.addEventListener('click', () => {
    galleryFileInput.click();
  });

  btnNoticeGallery.addEventListener('click', () => {
    galleryFileInput.click();
  });

  galleryFileInput.addEventListener('change', () => {
    galleryFileInput.value = '';
  });

  // Tombol Flip Kamera
  btnFlipCamera.addEventListener('click', toggleCameraFacing);

  // Mode Switcher Chips
  modeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      setAppMode(chip.dataset.mode);
    });
  });

  // Menu Overlay
  btnOpenMenu.addEventListener('click', openMenuOverlay);
  btnCloseMenu.addEventListener('click', closeMenuOverlay);

  menuTabButtons.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      switchMenuView(tabBtn.dataset.menuView);
    });
  });

  // Resize Viewport
  window.addEventListener('resize', updateScrimLayout);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateScrimLayout, 150);
  });
}

/**
 * 16. Inisialisasi Aplikasi Utama
 */
function initializeApp() {
  setupEventListeners();
  loadStoredAppMode();
  updateScrimLayout();
  startCameraStream(currentFacingMode);
}

document.addEventListener('DOMContentLoaded', initializeApp);
