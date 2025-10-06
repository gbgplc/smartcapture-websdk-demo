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

const onOpened = () => {
  menuButtons.style.display = 'none';
};

const onClosed = () => {
  liveDocumentCamera.style.display = 'none';
  if (modal.style.display === 'none' && documentResult.style.display === 'none') {
    menuButtons.style.display = 'flex';
  }
};

const onUserCanceled = () => {
  onClosed();
};

const resolveCheckStatus = (status) => {
  if (status == null) {
    return 'N/A';
  }
  return (status ? 'OK' : 'Failed');
};

const onCaptured = (e) => {
  const { captureResponse } = e.detail;
  let baseStr = 'NA';
  liveDocumentCamera.style.display = 'none';
  liveDocumentCamera.isOpen = false;

  if (captureResponse.imageData) {
    documentResult.style.display = 'block';

    const documentContext = documentCanvas.getContext('2d');
    documentCanvas.height = captureResponse.imageHeight;
    documentCanvas.width = captureResponse.imageWidth;
    documentContext.putImageData(captureResponse.imageData, 0, 0);

    const offScreenCanvas = document.createElement('canvas');
    const offScreenContext = offScreenCanvas.getContext('2d');
    offScreenCanvas.width = captureResponse.imageWidth;
    offScreenCanvas.height = captureResponse.imageHeight;
    offScreenContext.putImageData(captureResponse.imageData, 0, 0);

    const base64Image = offScreenCanvas.toDataURL('image/png');
    baseStr = base64Image;
    baseStr = baseStr.replace(/^data:image\/png;base64,/, '');
  } else {
    menuButtons.style.display = 'flex';
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

  menuButtons.style.display = 'none';
  modal.style.display = 'flex';
};

const goHome = () => {
  // Close modal
  modal.style.display = 'none';
  // Hide results
  documentResult.style.display = 'none';
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.style.display = 'none';
  // Hide cameras and ensure they are closed
  liveDocumentCamera.style.display = 'none';
  liveDocumentCamera.isOpen = false;
  const liveFace = document.getElementById('live-face-camera');
  if (liveFace) {
    liveFace.style.display = 'none';
    liveFace.isOpen = false;
  }
  // Show menu
  menuButtons.style.display = 'flex';
};

const restartCamera = () => {
  // Hide modal and any visible results (both document and face)
  modal.style.display = 'none';
  documentResult.style.display = 'none';
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.style.display = 'none';

  // Restart the document camera
  liveDocumentCamera.style.display = 'block';
  // Toggle camera to reset internal timeout state without public API
  liveDocumentCamera.isOpen = false;
  // Allow microtask flush
  setTimeout(() => {
    liveDocumentCamera.style.display = 'block';
    liveDocumentCamera.isOpen = true;
  }, 0);
};

const openLiveCamera = () => {
  // Always hide any visible results when opening the camera
  documentResult.style.display = 'none';
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.style.display = 'none';

  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      menuButtons.style.display = 'none';
      liveDocumentCamera.style.display = 'block';
      liveDocumentCamera.isOpen = true;
      errorCamera.style.display = 'none';
      stream.getTracks().forEach(track => track.stop());
    })
    .catch((err) => {
      console.error('[SmartCapture LiveDocumentCamera Demo] error accessing the camera at', new Date().toISOString(), ':', err);
      errorCamera.style.display = 'flex';
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
  documentResult.style.display = 'none';
  liveDocumentCamera.style.display = 'block';
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
  liveDocumentCamera.addEventListener(LiveDocumentCamera.OpenEventName, onOpened);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.CloseEventName, onClosed);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.UserCanceledEventName, onUserCanceled);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.FailureEventName, onFailure);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.CaptureEventName, onCaptured);
  loader.style.display = 'none';
  modal.style.display = 'none';
  menuButtons.style.display = 'flex';
};

setupDocCamera();
