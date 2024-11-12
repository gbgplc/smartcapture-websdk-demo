import { startManualFaceCamera, LiveFaceCamera } from '@gbgplc/smartcapture-web';

const liveFaceCamera = document.getElementById('live-face-camera');
const menuButtons = document.getElementById('menu');
const livenessResult = document.getElementById('face-result');
const liveFaceCaptureButton = document.getElementById('live-face-button');
const spinner = document.getElementById('spinner');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const modalButton = document.getElementById('modal-button');
const errorCamera = document.getElementById('error-camera');
const faceCanvas = document.getElementById('face-canvas');

const setUIValues = (id, value) => {
  const el = document.getElementById(id);
  el.value = value;
};

const onCaptured = (e) => {
  // Hide the menu buttons and show the spinner
  menuButtons.style.display = 'none';
  spinner.style.display = 'flex';
  liveFaceCamera.style.display = 'none';
  liveFaceCamera.isOpen = false;

  const { imageBase64, encryptedFile } = e.detail;

  // Get the base64 image data from e.detail
  const capturedImage = `data:image/jpeg;base64,${imageBase64}`;

  // Converting the encryptedFile to a base64 string
  const reader = new FileReader();
  reader.readAsDataURL(encryptedFile);
  reader.onloadend = () => {
    const base64Data = reader.result;
    setUIValues('face-base64-img-input', base64Data. replace(/^data:application\/octet-stream;base64,/, ''));
  };


  // Create a new Image element
  const img = new Image();
  img.src = capturedImage;

  // Once the image is loaded, draw it on the canvas
  img.onload = () => {
    // Get canvas context and set dimensions based on the image data
    const faceContext = faceCanvas.getContext('2d');
    faceCanvas.height = img.imageHeight;
    faceCanvas.width = img.imageWidth;

    // Draw the image onto the canvas
    faceContext.drawImage(img, 0, 0);

    // Restore menu buttons, show result section, and hide spinner
    menuButtons.style.display = 'flex';
    livenessResult.style.display = 'block';
    spinner.style.display = 'none';
  };

  // Handle any image loading errors
  img.onerror = () => {
    console.error("Failed to load the image.");
    menuButtons.style.display = 'flex';
    livenessResult.style.display = 'none';
    spinner.style.display = 'none';
  };
};
const openLiveCamera = () => {
  console.log('live face');
  navigator.mediaDevices.getUserMedia({ video: true })
  .then(function(stream) {
      console.log('Camera access granted');
      livenessResult.style.display = 'none';
      liveFaceCamera.isOpen = true;
      errorCamera.style.display = 'none';
      // Stop the stream after getting permission
      stream.getTracks().forEach(track => track.stop());
  })
  .catch(function(err) {
      console.error('Error accessing the camera:', err);
      errorCamera.style.display = 'flex';
  });
};


const onOpened = () => {
  liveFaceCamera.style.display = 'block';
  menuButtons.style.display = 'none';
};

const onClosed = () => {
  liveFaceCamera.style.display = 'hidden';
  if (modal.style.display === 'none' && livenessResult.style.display === 'none') {
    menuButtons.style.display = 'flex';
  }
};

const onFailure = (e) => {
  const {error} = e.detail;
  menuButtons.style.display = 'none';
  modal.style.display = 'flex';
  modalText.innerHTML = error.message;
  modalButton.addEventListener('click', openManualCamera);
};

const setupLiveCamera = () => {
  liveFaceCamera.addEventListener(LiveFaceCamera.OpenEventName, onOpened);
  liveFaceCamera.addEventListener(LiveFaceCamera.CloseEventName, onClosed);
  liveFaceCamera.addEventListener(LiveFaceCamera.CaptureEventName, onCaptured);
  liveFaceCamera.addEventListener(LiveFaceCamera.FailureEventName, onFailure);
  liveFaceCaptureButton.addEventListener('click', openLiveCamera);
};



setupLiveCamera();
