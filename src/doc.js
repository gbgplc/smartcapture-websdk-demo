import {
  LiveDocumentCamera,
  SmartCaptureModule,
} from '@gbgplc/smartcapture-web';

const liveDocumentCamera = document.getElementById('live-document-camera');
const documentCameraShell = document.querySelector('.documentCameraShell');
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

let capturedImageBase64 = null;

liveDocumentCamera.autoCaptureTimeout = 60000; // 1 minute (default)
liveDocumentCamera.enableAutoCaptureTimeout = true;

const setUIValues = (id, value) => {
  const el = document.getElementById(id);
  el.value = value;
};

const onOpen = _ => {
  menuButtons.classList.add('hidden');
};

const onClose = _ => {
  liveDocumentCamera.classList.add('hidden');
  documentCameraShell.classList.remove('documentCameraShellActive');
  if (
    modal.classList.contains('hidden') &&
    documentResult.classList.contains('hidden')
  ) {
    menuButtons.classList.remove('hidden');
  }
};

const onUserCanceled = _ => {
  onClose();
};

const resolveCheckStatus = status => {
  if (status == null) {
    return 'N/A';
  }
  return status ? 'OK' : 'Failed';
};

const onCapture = e => {
  const { captureResponse } = e.detail;

  liveDocumentCamera.classList.add('hidden');
  documentCameraShell.classList.remove('documentCameraShellActive');

  capturedImageBase64 = captureResponse.imageBase64 ?? null;
  const baseStr = capturedImageBase64
    ? capturedImageBase64.replace(/^data:image\/\w+;base64,/, '')
    : 'NA';

  if (captureResponse.imageData) {
    documentResult.classList.remove('hidden');

    const documentContext = documentCanvas.getContext('2d');
    documentCanvas.height = captureResponse.imageHeight;
    documentCanvas.width = captureResponse.imageWidth;
    documentContext.putImageData(captureResponse.imageData, 0, 0);
  } else {
    menuButtons.classList.remove('hidden');
  }

  setUIValues('base64-img-input', baseStr);
  setUIValues('doc-is-good-input', captureResponse.isGood ? 'OK' : 'Failed');
  setUIValues(
    'doc-sharpness-input',
    resolveCheckStatus(captureResponse.isSharp),
  );
  setUIValues(
    'doc-glare-input',
    resolveCheckStatus(captureResponse.isGlareFree),
  );
  setUIValues(
    'doc-dpi-input',
    resolveCheckStatus(captureResponse.isAdequateDpi),
  );

  if (captureResponse.failedChecks) {
    setUIValues(
      'doc-failed-checks-input',
      captureResponse.failedChecks.length &&
        `${captureResponse.failedChecks.map(checkName => checkName)}`,
    );
  }
};

const onFailure = e => {
  console.error(
    '[SmartCapture LiveDocumentCamera Demo] failure received at',
    new Date().toISOString(),
    'error:',
    e.detail?.error,
  );
  const { error } = e.detail;

  if (error.code === 'auto-capture-timeout') {
    modalText.textContent =
      'Document auto-capture timed out. Please try again with better lighting and positioning.';
  } else if (error.code === 'initialization-timeout') {
    modalText.textContent =
      'Camera initialization timed out. Please check your camera permissions and try again.';
  } else if (error.code === 'permission-denied') {
    modalText.textContent =
      'Camera permission denied. Please grant camera access and try again.';
  } else {
    modalText.textContent = `An error occurred: ${error.message}`;
  }

  // Wire modal actions: Back -> goHome, Try again -> restartCamera, X -> goHome
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
  documentCameraShell.classList.remove('documentCameraShellActive');
  menuButtons.classList.remove('hidden');
};

const restartCamera = async () => {
  // Hide modal and any visible results (both document and face)
  modal.classList.add('hidden');
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');

  // Restart the document camera
  documentCameraShell.classList.add('documentCameraShellActive');
  liveDocumentCamera.classList.remove('hidden');
  liveDocumentCamera.isOpen = false;
  await liveDocumentCamera.updateComplete;
  liveDocumentCamera.classList.remove('hidden');
  liveDocumentCamera.isOpen = true;
};

const openLiveCamera = () => {
  // Always hide any visible results when opening the camera
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');

  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(stream => {
      menuButtons.classList.add('hidden');
      documentCameraShell.classList.add('documentCameraShellActive');
      liveDocumentCamera.classList.remove('hidden');
      liveDocumentCamera.showBackOfDocumentAnimation = false;
      liveDocumentCamera.isOpen = true;
      errorCamera.classList.add('hidden');
      stream.getTracks().forEach(track => track.stop());
    })
    .catch(err => {
      console.error(
        '[SmartCapture LiveDocumentCamera Demo] error accessing the camera at',
        new Date().toISOString(),
        ':',
        err,
      );
      errorCamera.classList.remove('hidden');
    });
};

const saveImage = () => {
  if (!capturedImageBase64) return;

  const link = document.createElement('a');
  document.body.appendChild(link);

  link.setAttribute('href', capturedImageBase64);
  link.setAttribute('download', `${Date.now()}.jpg`);
  link.click();

  document.body.removeChild(link);
};

const resetCamera = async () => {
  documentResult.classList.add('hidden');
  documentCameraShell.classList.add('documentCameraShellActive');
  liveDocumentCamera.isOpen = false;
  await liveDocumentCamera.updateComplete;
  liveDocumentCamera.showBackOfDocumentAnimation = true;
  liveDocumentCamera.classList.remove('hidden');
  liveDocumentCamera.isOpen = true;
};

const setupDocCamera = () => {
  liveDocumentCamera.isOpen = false;
  liveDocumentCamera.showToggle = true;
  liveDocumentCamera.showBackButton = true; // Example: Configure back button visibility
  liveDocumentCamera.successTime = 500;
  liveDocumentCamera.showHelpIcon = true;
  liveDocumentCamera.forceManualCamera = false;

  SmartCaptureModule.getInstance().init();
  liveDocumentCaptureButton.addEventListener('click', openLiveCamera);
  saveButton.addEventListener('click', saveImage);
  resetCameraButton.addEventListener('click', resetCamera);
  const docCloseBtn = document.getElementById('doc-close-results-button');
  if (docCloseBtn) docCloseBtn.addEventListener('click', goHome);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.OpenEventName, onOpen);
  liveDocumentCamera.addEventListener(
    LiveDocumentCamera.CaptureEventName,
    onCapture,
  );
  liveDocumentCamera.addEventListener(
    LiveDocumentCamera.CloseEventName,
    onClose,
  );
  liveDocumentCamera.addEventListener(
    LiveDocumentCamera.UserCanceledEventName,
    onUserCanceled,
  );
  liveDocumentCamera.addEventListener(
    LiveDocumentCamera.FailureEventName,
    onFailure,
  );
  loader.classList.add('hidden');
  modal.classList.add('hidden');
  menuButtons.classList.remove('hidden');
};

setupDocCamera();
