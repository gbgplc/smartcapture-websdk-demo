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

const onCaptured = async (e) => {
  await new Promise(r => setTimeout(r, 2000));

  // Hide the menu buttons and show the spinner
  menuButtons.style.display = 'none';
  spinner.style.display = 'flex';
  liveFaceCamera.style.display = 'none';
  // liveFaceCamera.isOpen = false;

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
    menuButtons.style.display = 'none';
    livenessResult.style.display = 'block';
    spinner.style.display = 'none';
  };

  // Handle any image loading errors
  img.onerror = () => {
    console.error('[SmartCapture LiveFaceCamera Demo] failed to load the image at', new Date().toISOString());

    menuButtons.style.display = 'flex';
    livenessResult.style.display = 'none';
    spinner.style.display = 'none';
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
  livenessResult.style.display = 'none';
  const docResult = document.getElementById('doc-result');
  if (docResult) docResult.style.display = 'none';

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(async function(stream) {
      console.log('Camera access granted');
      livenessResult.style.display = 'none';

      liveFaceCamera.isOpen = true;
      errorCamera.style.display = 'none';
      // Stop the stream after getting permission
      stream.getTracks().forEach(track => track.stop());
    })
    .catch(function(err) {
      console.error('[SmartCapture LiveFaceCamera Demo] error accessing the camera at', new Date().toISOString(), ':', err);

      errorCamera.style.display = 'flex';
    });
};

const onBeforeInitialized = () => {
  console.debug('[SmartCapture LiveFaceCamera Demo] beforeInitialize received at', new Date().toISOString());
}

const onInitialized = () => {
  console.debug('[SmartCapture LiveFaceCamera Demo] initialize received at', new Date().toISOString());
}

const onOpened = () => {
  console.debug('[SmartCapture LiveFaceCamera Demo] open received at', new Date().toISOString());

  liveFaceCamera.style.display = 'block';
  menuButtons.style.display = 'none';
};

const onClosed = () => {
  console.debug('[LiveFaceCamera] close received at', new Date().toISOString());

  liveFaceCamera.style.display = 'none';
  if (modal.style.display === 'none' && livenessResult.style.display === 'none') {
    menuButtons.style.display = 'flex';
  }
};

const onUserCanceled = () => {
  console.debug('[SmartCapture LiveFaceCamera Demo] user canceled the capture at', new Date().toISOString());
  onClosed();
};

const onFailure = (e) => {
  console.error('[SmartCapture LiveFaceCamera Demo] onFailure at', new Date().toISOString(), ':', e);

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

  menuButtons.style.display = 'none';
  modal.style.display = 'flex';
  // Wire modal actions: Back → goHome, Try again → restartFaceCamera, X → goHome
  if (modalBackButton) modalBackButton.onclick = goHome;
  if (modalTryAgainButton) modalTryAgainButton.onclick = restartFaceCamera;
  if (modalClose) modalClose.onclick = goHome;
};

const goHome = () => {
  // Close modal
  modal.style.display = 'none';
  // Hide results
  livenessResult.style.display = 'none';
  const docResult = document.getElementById('doc-result');
  if (docResult) docResult.style.display = 'none';
  // Hide cameras and ensure they are closed
  liveFaceCamera.style.display = 'none';
  liveFaceCamera.isOpen = false;
  const liveDoc = document.getElementById('live-document-camera');
  if (liveDoc) {
    liveDoc.style.display = 'none';
    liveDoc.isOpen = false;
  }
  // Show menu
  menuButtons.style.display = 'flex';
};

const restartFaceCamera = () => {
  // Hide modal and any visible results (both face and document)
  modal.style.display = 'none';
  livenessResult.style.display = 'none';
  const docResult = document.getElementById('doc-result');
  if (docResult) docResult.style.display = 'none';

  // Restart the face camera
  liveFaceCamera.style.display = 'block';
  // Toggle camera to reset internal state
  liveFaceCamera.isOpen = false;
  setTimeout(() => {
    liveFaceCamera.style.display = 'block';
    liveFaceCamera.isOpen = true;
  }, 0);
};

const setupLiveCamera = async () => {
  liveFaceCamera.addEventListener(LiveFaceCamera.BeforeInitializeEventName, onBeforeInitialized);
  liveFaceCamera.addEventListener(LiveFaceCamera.InitializeEventName, onInitialized);
  liveFaceCamera.addEventListener(LiveFaceCamera.OpenEventName, onOpened);
  liveFaceCamera.addEventListener(LiveFaceCamera.CloseEventName, onClosed);
  liveFaceCamera.addEventListener(LiveFaceCamera.UserCanceledEventName, onUserCanceled);
  liveFaceCamera.addEventListener(LiveFaceCamera.CaptureEventName, onCaptured);
  liveFaceCamera.addEventListener(LiveFaceCamera.FailureEventName, onFailure);
  liveFaceCaptureButton.addEventListener('click', openLiveCamera);
  saveButton.addEventListener('click', saveImage);
  const faceCloseBtn = document.getElementById('face-close-results-button');
  if (faceCloseBtn) faceCloseBtn.addEventListener('click', goHome);
};

await setupLiveCamera();
