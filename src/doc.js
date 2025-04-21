import { LiveDocumentCamera, SmartCaptureModule } from '@gbgplc/smartcapture-web';

const liveDocumentCamera = document.getElementById('live-document-camera');
const menuButtons = document.getElementById('menu');
const errorCamera = document.getElementById('error-camera');
const loader = document.getElementById('spinner');
const liveDocumentCaptureButton = document.getElementById('live-doc-button');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const modalButton = document.getElementById('modal-button');
const documentResult = document.getElementById('doc-result');
const documentCanvas = document.getElementById('doc-canvas');
const saveButton = document.getElementById('doc-save-button');
const resetCameraButton = document.getElementById('reset-camera-button');

const setUIValues = (id, value) => {
  const el = document.getElementById(id);
  el.value = value;
};

const onOpened = () => {
  console.log('opened');
  menuButtons.style.display = 'none';
};

const onClosed = () => {
  console.log('closed');
  liveDocumentCamera.style.display = 'none';
  if (modal.style.display === 'none' && documentResult.style.display === 'none') {
    menuButtons.style.display = 'flex';
  }
};

const resolveCheckStatus = (status) => {
  if (status == null) {
    return 'N/A';
  }
  return (status ? 'OK' : 'Failed');
};

const onCaptured = (e) => {
  console.log('captured');
  const { captureResponse } = e.detail;
  let baseStr = 'NA';
  // Hide live document camera and update UI state
  liveDocumentCamera.style.display = 'none';
  liveDocumentCamera.isOpen = false;
  if (captureResponse.imageData) {
    // Show document result
    documentResult.style.display = 'block';

    // Get canvas context and set dimensions based on the image data
    const documentContext = documentCanvas.getContext('2d');
    documentCanvas.height = captureResponse.imageHeight;
    documentCanvas.width = captureResponse.imageWidth;

    // Draw the ImageData onto the canvas
    documentContext.putImageData(captureResponse.imageData, 0, 0);

    // Create an off-screen canvas to convert ImageData to base64
    const offScreenCanvas = document.createElement('canvas');
    const offScreenContext = offScreenCanvas.getContext('2d');

    // Set the off-screen canvas dimensions to match the image data
    offScreenCanvas.width = captureResponse.imageWidth;
    offScreenCanvas.height = captureResponse.imageHeight;

    // Draw the ImageData onto the off-screen canvas
    offScreenContext.putImageData(captureResponse.imageData, 0, 0);

    // Convert the off-screen canvas to base64
    const base64Image = offScreenCanvas.toDataURL('image/png');
    baseStr = base64Image;
    baseStr = baseStr.replace(/^data:image\/png;base64,/, '');

  } else {
    // Show menu buttons if no image data is present
    menuButtons.style.display = 'flex';
  }

  // Set various UI values based on captureResponse
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
  console.log(error.code, error.message);
  menuButtons.style.display = 'none';
  modal.style.display = 'flex';
  modalText.innerHTML = error.message;
  modalButton.addEventListener('click', openManualCamera);
};

const openLiveCamera = () => {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      console.log('Camera access granted');

      liveDocumentCamera.forceManualCamera = false;
      menuButtons.style.display = 'none';
      liveDocumentCamera.style.display = 'block';
      liveDocumentCamera.isOpen = true;
      errorCamera.style.display = 'none';
      // Stop the stream after getting permission
      stream.getTracks().forEach(track => track.stop());
    })
    .catch((err) => {
      console.error('Error accessing the camera:', err);
      errorCamera.style.display = 'flex';
    });
};


const saveImage = () => {
  const link = document.createElement('a');
  document.body.appendChild(link); // for Firefox
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

  SmartCaptureModule.getInstance().init();
  liveDocumentCaptureButton.addEventListener('click', openLiveCamera);
  saveButton.addEventListener('click', saveImage);
  resetCameraButton.addEventListener('click', resetCamera);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.OpenEventName, onOpened);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.CloseEventName, onClosed);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.FailureEventName, onFailure);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.CaptureEventName, onCaptured);
  loader.style.display = 'none';
  modal.style.display = 'none';
  menuButtons.style.display = 'flex';
};

setupDocCamera();
