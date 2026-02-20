import { LiveFaceCamera } from '@gbgplc/smartcapture-web';

const liveFaceCamera = document.getElementById('live-face-camera');
const menuButtons = document.getElementById('menu');
const livenessResult = document.getElementById('face-result');
const liveFaceCaptureButton = document.getElementById('live-face-button');
const spinner = document.getElementById('spinner');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const modalBackButton = document.getElementById('modal-back-button');
const modalTryAgainButton = document.getElementById('modal-try-again');
const modalClose = document.getElementById('modal-close');
const errorCamera = document.getElementById('error-camera');
const faceCanvas = document.getElementById('face-canvas');
const saveButton = document.getElementById('face-save-button');

const setUIValues = (id, value) => {
  const el = document.getElementById(id);
  el.value = value;
};

const onCapture = async (e) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] capture received at', new Date().toISOString());

  // Hide the menu buttons and show the spinner
  menuButtons.classList.add('hidden');
  spinner.classList.remove('hidden');

  const { imageBase64, encryptedFile } = e.detail;

  // Get the base64 image data from e.detail
  const capturedImage = `data:image/jpeg;base64,${imageBase64}`;

  // Converting the encryptedFile to a base64 string
  const reader = new FileReader();
  reader.readAsDataURL(encryptedFile);
  reader.onloadend = () => {
    const base64Data = reader.result;
    setUIValues('face-base64-img-input', base64Data.replace(/^data:application\/octet-stream;base64,/, ''));
  };

  // Create a new Image element
  const img = new Image();
  img.src = capturedImage;

  // Once the image is loaded, draw it on the canvas
  img.onload = () => {
    // Get canvas context and set dimensions based on the image data
    const faceContext = faceCanvas.getContext('2d');
    faceCanvas.height = img.naturalHeight;
    faceCanvas.width = img.naturalWidth;

    // Draw the image onto the canvas
    faceContext.drawImage(img, 0, 0);

    // Show the result section, and hide the spinner (keep menu hidden for consistency)
    menuButtons.classList.add('hidden');
    livenessResult.classList.remove('hidden');
    spinner.classList.add('hidden');
  };

  // Handle any image loading errors
  img.onerror = () => {
    console.error('[SmartCapture LiveFaceCamera Demo] failed to load the image at', new Date().toISOString());

    menuButtons.classList.remove('hidden');
    livenessResult.classList.add('hidden');
    spinner.classList.add('hidden');
  };
};

const saveImage = () => {
  const link = document.createElement('a');
  document.body.appendChild(link); // for Firefox
  const dataURL = faceCanvas.toDataURL('image/png');

  link.setAttribute('href', dataURL);
  link.setAttribute('download', `${Date.now()}.jpg`);
  link.click();

  document.body.removeChild(link);
};

const openLiveCamera = () => {
  console.debug('[SmartCapture LiveFaceCamera Demo] opening live face camera at', new Date().toISOString());

  // Always hide any visible results when opening the camera
  livenessResult.classList.add('hidden');
  const docResult = document.getElementById('doc-result');
  if (docResult) docResult.classList.add('hidden');

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(async function(stream) {
      console.log('[SmartCapture LiveFaceCamera Demo] camera access granted');
      livenessResult.classList.add('hidden');

      liveFaceCamera.isOpen = true;
      errorCamera.classList.add('hidden');
      // Stop the stream after getting permission
      stream.getTracks().forEach(track => track.stop());
    })
    .catch(function(err) {
      console.error('[SmartCapture LiveFaceCamera Demo] error accessing the camera at', new Date().toISOString(), ':', err);

      errorCamera.classList.remove('hidden');
    });
};

const onBeforeInitialize = (_) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] beforeInitialize received at', new Date().toISOString());
}

const onInitialize = (_) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] initialize received at', new Date().toISOString());
}

const onBeforeOpen = (_) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] beforeOpen received at', new Date().toISOString());
};

const onOpen = (_) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] open received at', new Date().toISOString());

  // Component manages its own visibility
  menuButtons.classList.add('hidden');
};

const onDetect = (_) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] detect received at', new Date().toISOString());
};

const onBeforeCapture = (_) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] beforeCapture received at', new Date().toISOString());
};

const onClose = (_) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] close received at', new Date().toISOString());

  if (modal.classList.contains('hidden') && livenessResult.classList.contains('hidden')) {
    menuButtons.classList.remove('hidden');
  }
};

const onUserCanceled = (_) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] userCanceled received at', new Date().toISOString());

  if (modal.classList.contains('hidden') && livenessResult.classList.contains('hidden')) {
    menuButtons.classList.remove('hidden');
  }
};

const onFailure = (e) => {
  console.error('[SmartCapture LiveFaceCamera Demo] failure received at', new Date().toISOString(), 'error:', e.detail?.error);

  const { error } = e.detail;

  // Handle different error types (plain text for consistency)
  if (error.code === 4) {
    modalText.textContent = 'Face auto-capture timed out. Please try again and ensure your face is properly positioned within the frame.';
  } else if (error.code === 3) {
    modalText.textContent = 'Camera initialization timed out. Please check your camera permissions and try again.';
  } else if (error.code === 1) {
    modalText.textContent = 'Camera permission denied. Please grant camera access and try again.';
  } else {
    modalText.textContent = `An error occurred: ${error.message}`;
  }

  menuButtons.classList.add('hidden');
  modal.classList.remove('hidden');
  // Wire modal actions: Back → goHome, Try again → restartFaceCamera, X → goHome
  if (modalBackButton) modalBackButton.onclick = goHome;
  if (modalTryAgainButton) modalTryAgainButton.onclick = restartFaceCamera;
  if (modalClose) modalClose.onclick = goHome;
};

const goHome = () => {
  // Close modal
  modal.classList.add('hidden');
  // Hide results
  livenessResult.classList.add('hidden');
  const docResult = document.getElementById('doc-result');
  if (docResult) docResult.classList.add('hidden');

  // Show the menu
  menuButtons.classList.remove('hidden');
};

const restartFaceCamera = () => {
  // Hide modal and any visible results (both face and document)
  modal.classList.add('hidden');
  livenessResult.classList.add('hidden');
  const docResult = document.getElementById('doc-result');
  if (docResult) docResult.classList.add('hidden');

  // Restart the face camera using public API
  liveFaceCamera.isOpen = true;
};

const setupLiveCamera = async () => {
  liveFaceCamera.addEventListener(LiveFaceCamera.BeforeInitializeEventName, onBeforeInitialize);
  liveFaceCamera.addEventListener(LiveFaceCamera.InitializeEventName, onInitialize);

  liveFaceCamera.addEventListener(LiveFaceCamera.BeforeOpenEventName, onBeforeOpen);
  liveFaceCamera.addEventListener(LiveFaceCamera.OpenEventName, onOpen);

  liveFaceCamera.addEventListener(LiveFaceCamera.DetectEventName, onDetect);

  liveFaceCamera.addEventListener(LiveFaceCamera.BeforeCaptureEventName, onBeforeCapture);
  liveFaceCamera.addEventListener(LiveFaceCamera.CaptureEventName, onCapture);

  liveFaceCamera.addEventListener(LiveFaceCamera.CloseEventName, onClose);
  liveFaceCamera.addEventListener(LiveFaceCamera.UserCanceledEventName, onUserCanceled);
  liveFaceCamera.addEventListener(LiveFaceCamera.FailureEventName, onFailure);

  liveFaceCaptureButton.addEventListener('click', openLiveCamera);
  saveButton.addEventListener('click', saveImage);
  const faceCloseBtn = document.getElementById('face-close-results-button');
  if (faceCloseBtn) faceCloseBtn.addEventListener('click', goHome);
};

await setupLiveCamera();
