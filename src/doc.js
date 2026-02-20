import { LiveDocumentCamera, SmartCaptureModule } from '@gbgplc/smartcapture-web';

const liveDocumentCamera = document.getElementById('live-document-camera');
const menuButtons = document.getElementById('menu');
const errorCamera = document.getElementById('error-camera');
const loader = document.getElementById('spinner');
const liveDocumentCaptureButton = document.getElementById('live-doc-button');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const modalBackButton = document.getElementById('modal-back-button');
const modalTryAgainButton = document.getElementById('modal-try-again');
const modalClose = document.getElementById('modal-close');
const documentResult = document.getElementById('doc-result');
const documentCanvas = document.getElementById('doc-canvas');
const saveButton = document.getElementById('doc-save-button');
const resetCameraButton = document.getElementById('reset-camera-button');

// Configure timeout for auto-capture
liveDocumentCamera.autoCaptureTimeout = 60000; // 1 minute (default)
liveDocumentCamera.enableAutoCaptureTimeout = true;

// Removed demo-only console hijack and manual timeout logic.
// LiveDocumentCamera now manages auto-capture timeout internally and
// dispatches FailureEvent with error.code === 'auto-capture-timeout'.

const setUIValues = (id, value) => {
  const el = document.getElementById(id);
  el.value = value;
};

const onOpen = (_) => {
  console.debug('[SmartCapture LiveDocumentCamera Demo] open received at', new Date().toISOString());
  menuButtons.classList.add('hidden');
};

const onDetect = (_) => {
  console.debug('[SmartCapture LiveDocumentCamera Demo] detect received at', new Date().toISOString());
};

const onClose = (_) => {
  console.debug('[SmartCapture LiveDocumentCamera Demo] close received at', new Date().toISOString());

  liveDocumentCamera.classList.add('hidden');
  if (modal.classList.contains('hidden') && documentResult.classList.contains('hidden')) {
    menuButtons.classList.remove('hidden');
  }
};

const onUserCanceled = (_) => {
  console.debug('[SmartCapture LiveDocumentCamera Demo] userCanceled received at', new Date().toISOString());
  onClose();
};

const resolveCheckStatus = (status) => {
  if (status == null) {
    return 'N/A';
  }
  return (status ? 'OK' : 'Failed');
};

const onCapture = (e) => {
  const { captureResponse } = e.detail;
  console.debug('[SmartCapture LiveDocumentCamera Demo] capture received at', new Date().toISOString());

  let baseStr = 'NA';
  liveDocumentCamera.classList.add('hidden');

  if (captureResponse.imageData) {
    documentResult.classList.remove('hidden');

    const documentContext = documentCanvas.getContext('2d');
    documentCanvas.height = captureResponse.imageHeight;
    documentCanvas.width = captureResponse.imageWidth;
    documentContext.putImageData(captureResponse.imageData, 0, 0);

    const offScreenCanvas = document.createElement('canvas');
    const offScreenContext = offScreenCanvas.getContext('2d');
    offScreenCanvas.width = captureResponse.imageWidth;
    offScreenCanvas.height = captureResponse.imageHeight;
    offScreenContext.putImageData(captureResponse.imageData, 0, 0);

    baseStr = offScreenCanvas.toDataURL('image/png');
    baseStr = baseStr.replace(/^data:image\/png;base64,/, '');
  } else {
    menuButtons.classList.remove('hidden');
  }

  setUIValues('base64-img-input', baseStr);
  setUIValues('doc-is-good-input', captureResponse.isGood ? 'OK' : 'Failed');
  setUIValues('doc-sharpness-input', resolveCheckStatus(captureResponse.isSharp));
  setUIValues('doc-glare-input', resolveCheckStatus(captureResponse.isGlareFree));
  setUIValues('doc-dpi-input', resolveCheckStatus(captureResponse.isAdequateDpi));

  if (captureResponse.failedChecks) {
    setUIValues('doc-failed-checks-input', captureResponse.failedChecks.length && `${captureResponse.failedChecks.map(checkName => checkName)}`);
  }
};

const onFailure = (e) => {
  console.error('[SmartCapture LiveDocumentCamera Demo] failure received at', new Date().toISOString(), 'error:', e.detail?.error);
  const { error } = e.detail;

  if (error.code === 'auto-capture-timeout') {
    modalText.textContent = 'Document auto-capture timed out. Please try again with better lighting and positioning.';
  } else if (error.code === 'initialization-timeout') {
    modalText.textContent = 'Camera initialization timed out. Please check your camera permissions and try again.';
  } else if (error.code === 'permission-denied') {
    modalText.textContent = 'Camera permission denied. Please grant camera access and try again.';
  } else {
    modalText.textContent = `An error occurred: ${error.message}`;
  }

  // Wire modal actions: Back → goHome, Try again → restartCamera, X → goHome
  if (modalBackButton) modalBackButton.onclick = goHome;
  if (modalTryAgainButton) modalTryAgainButton.onclick = restartCamera;
  if (modalClose) modalClose.onclick = goHome;

  menuButtons.classList.add('hidden');
  modal.classList.remove('hidden');
};

const goHome = () => {
  // Close modal
  modal.classList.add('hidden');
  // Hide results
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');

  // Show the menu
  menuButtons.classList.remove('hidden');
};

const restartCamera = () => {
  // Hide modal and any visible results (both document and face)
  modal.classList.add('hidden');
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');

  // Restart the document camera
  liveDocumentCamera.classList.remove('hidden');
  // Toggle camera to reset internal timeout state without public API
  liveDocumentCamera.isOpen = false;
  // Allow microtask flush
  setTimeout(() => {
    liveDocumentCamera.classList.remove('hidden');
    liveDocumentCamera.isOpen = true;
  }, 0);
};

const openLiveCamera = () => {
  // Always hide any visible results when opening the camera
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');

  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      menuButtons.classList.add('hidden');
      liveDocumentCamera.classList.remove('hidden');
      liveDocumentCamera.isOpen = true;
      errorCamera.classList.add('hidden');
      stream.getTracks().forEach(track => track.stop());
    })
    .catch((err) => {
      console.error('[SmartCapture LiveDocumentCamera Demo] error accessing the camera at', new Date().toISOString(), ':', err);
      errorCamera.classList.remove('hidden');
    });
};

const saveImage = () => {
  const link = document.createElement('a');
  document.body.appendChild(link);
  const dataURL = documentCanvas.toDataURL('image/png');

  link.setAttribute('href', dataURL);
  link.setAttribute('download', `${Date.now()}.jpg`);
  link.click();

  document.body.removeChild(link);
};

const resetCamera = () => {
  documentResult.classList.add('hidden');
  liveDocumentCamera.classList.remove('hidden');
  liveDocumentCamera.isOpen = true;
  if (liveDocumentCamera.showBackOfDocumentAnimation) liveDocumentCamera.showBackOfDocumentAnimation = true;
};

const setupDocCamera = () => {

  liveDocumentCamera.isOpen = false;
  liveDocumentCamera.showToggle = true;
  liveDocumentCamera.showBackButton = true; // Example: Configure back button visibility
  liveDocumentCamera.successTime = 500;
  liveDocumentCamera.showHelpIcon = true;
  liveDocumentCamera.forceManualCamera = false;
  // liveDocumentCamera.hints = {
  //   moveCloserHint: { title: 'Move closer', description: 'Move your device closer to the document' },
  //   fixBlurHint: { title: 'Hold steady', description: 'Keep your device and document steady' },
  //   fixGlareHint: { title: 'Reduce glare', description: 'Avoid direct light sources' },
  //   outOfFrameHint: { title: 'Center document', description: 'Keep document within the frame' },
  //   capturingHint: { title: 'Capturing...', description: 'Please hold still' }
  // };

  // Core functionality from main branch - maintain existing functionality

  SmartCaptureModule.getInstance().init();
  liveDocumentCaptureButton.addEventListener('click', openLiveCamera);
  saveButton.addEventListener('click', saveImage);
  resetCameraButton.addEventListener('click', resetCamera);
  const docCloseBtn = document.getElementById('doc-close-results-button');
  if (docCloseBtn) docCloseBtn.addEventListener('click', goHome);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.OpenEventName, onOpen);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.CaptureEventName, onCapture);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.DetectEventName, onDetect);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.CloseEventName, onClose);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.UserCanceledEventName, onUserCanceled);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.FailureEventName, onFailure);

  loader.classList.add('hidden');
  modal.classList.add('hidden');
  menuButtons.classList.remove('hidden');
};

setupDocCamera();
