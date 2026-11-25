import { LiveFaceCamera } from '@gbgplc/smartcapture-web';

const liveFaceCamera = document.getElementById('live-face-camera');
const menuButtons = document.getElementById('menu');
const livenessResult = document.getElementById('face-result');
const liveFaceCaptureButton = document.getElementById('live-face-button');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const modalBackButton = document.getElementById('modal-back-button');
const modalTryAgainButton = document.getElementById('modal-try-again');
const modalClose = document.getElementById('modal-close');
const errorCamera = document.getElementById('error-camera');
const faceImage = document.getElementById('face-image');
const saveButton = document.getElementById('face-save-button');

let capturedImageBase64 = null;

// Rendering the full ~1MB base64 string into the textarea costs iOS Safari
// ~4s of layout, which blocked the whole transition into this results view
// (same issue measured on the document capture results view). Show a short
// summary instead and only inject the full string when the user actually
// asks for it, so they can still select/copy it on demand.
const BASE64_PREVIEW_CHARS = 120;
let pendingBase64 = null;

const setBase64Field = (id, base64) => {
  const el = document.getElementById(id);
  if (!base64 || base64 === 'NA') {
    pendingBase64 = null;
    el.value = base64 || 'NA';
    return;
  }

  pendingBase64 = base64;
  const sizeKb = (base64.length / 1024).toFixed(0);
  el.value = `${base64.slice(0, BASE64_PREVIEW_CHARS)}… [${sizeKb}KB truncated — tap here to load the full string]`;
};

const loadFullBase64 = event => {
  if (!pendingBase64) return;
  event.target.value = pendingBase64;
  pendingBase64 = null;
};

const onCapture = (e) => {
  console.debug('[SmartCapture LiveFaceCamera Demo] capture received at', new Date().toISOString());

  const { imageBase64, encryptedFile } = e.detail;

  // Get the base64 image data from e.detail
  capturedImageBase64 = `data:image/jpeg;base64,${imageBase64}`;

  // Reveal the results synchronously. The SDK dispatches close on the microtask
  // straight after capture, and onClose re-shows the menu unless the results are
  // already visible — revealing them from an img.onload callback instead let the
  // home screen reappear underneath the spinner until the decode finished, which
  // on a phone is seconds rather than a sub-frame flicker.
  // Handing the base64 to the <img> also drops our decode-into-canvas step, so
  // the browser decodes once, for display, off the main thread.
  faceImage.src = capturedImageBase64;
  menuButtons.classList.add('hidden');
  livenessResult.classList.remove('hidden');

  // Converting the encryptedFile to a base64 string
  const reader = new FileReader();
  reader.readAsDataURL(encryptedFile);
  reader.onloadend = () => {
    const base64Data = reader.result;
    setBase64Field('face-base64-img-input', base64Data.replace(/^data:application\/octet-stream;base64,/, ''));
  };
};

const dataUrlToBlob = (dataUrl) => {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const saveImage = () => {
  if (!capturedImageBase64) return;

  const blobUrl = URL.createObjectURL(dataUrlToBlob(capturedImageBase64));

  const link = document.createElement('a');
  document.body.appendChild(link); // for Firefox

  link.setAttribute('href', blobUrl);
  link.setAttribute('download', `${Date.now()}.jpg`);
  link.click();

  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
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

  // Drop the previous capture so the next results screen can't briefly show the
  // old face while the new image decodes.
  faceImage.removeAttribute('src');
  capturedImageBase64 = null;
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
    modalText.textContent = 'The face camera did not finish starting up. Please try again, or try a different browser on this device.';
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
  liveFaceCamera.showPreviewScreen = true; // Opt-in: false by default (see docs/web/face-camera.md)

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

  faceImage.onerror = () => {
    console.error('[SmartCapture LiveFaceCamera Demo] failed to load the image at', new Date().toISOString());
  };

  liveFaceCaptureButton.addEventListener('click', openLiveCamera);
  saveButton.addEventListener('click', saveImage);
  const faceCloseBtn = document.getElementById('face-close-results-button');
  if (faceCloseBtn) faceCloseBtn.addEventListener('click', goHome);
  const base64Field = document.getElementById('face-base64-img-input');
  if (base64Field) base64Field.addEventListener('focus', loadFullBase64);
};

await setupLiveCamera();
