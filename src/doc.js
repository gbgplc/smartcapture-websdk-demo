import { LiveDocumentCamera, SmartCaptureModule } from '@gbgplc/smartcapture-web';

// ?iad turns on the internal IAD view: the SDK hands back the signals it sealed
// into the JBX (`yarn start` builds only) and the demo asks for the motion
// sensor permission. Signals are always collected and sealed either way.
const SHOW_IAD_SIGNALS = new URLSearchParams(globalThis.location?.search).has('iad');

const versionPill = document.getElementById('version-pill');
if (versionPill && globalThis.__SDK_VERSION__) {
  versionPill.textContent = `SmartCapture v${globalThis.__SDK_VERSION__} - Latest`;
}

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
let capturedImageBase64 = null;
let capturedJbx = null;
let capturedIadSignals = null;
const iadModal = document.getElementById('iad-modal');
const iadModalClose = document.getElementById('iad-modal-close');
const iadSignalsView = document.getElementById('iad-signals-view');
const iadCopyJsonButton = document.getElementById('iad-copy-json-button');
const iadDownloadJsonButton = document.getElementById('iad-download-json-button');
const inspectSignalsField = document.getElementById('doc-inspect-signals-field');
const inspectSignalsButton = document.getElementById('doc-inspect-signals-button');
const resetCameraButton = document.getElementById('reset-camera-button');

const getSensorPermissionStateFromResult = (result) => {
  if (result === 'granted' || result === 'denied' || result === 'prompt') {
    return result;
  }
  return 'error';
};

const mapSensorPermissionError = (error) => {
  const message = (error && error.message ? error.message : '').toLowerCase();
  if (message.includes('gesture') || message.includes('user activation')) {
    return 'gesture_required';
  }
  if (message.includes('policy') || message.includes('permissions policy')) {
    return 'blocked_by_policy';
  }
  return 'error';
};

const requestSingleSensorPermission = async (ctorName) => {
  const ctor = /** @type {Record<string, unknown>} */ (globalThis)[ctorName];
  if (!ctor) return 'unsupported';
  if (typeof /** @type {{ requestPermission?: unknown }} */ (ctor).requestPermission !== 'function') return 'granted';
  try {
    const result = await /** @type {{ requestPermission: () => Promise<string> }} */ (ctor).requestPermission();
    return getSensorPermissionStateFromResult(result);
  } catch (error) {
    return mapSensorPermissionError(error);
  }
};

const requestDeviceSensorPermissionsOnUserGesture = async () => {
  const motionState = await requestSingleSensorPermission('DeviceMotionEvent');
  const orientationState = await requestSingleSensorPermission('DeviceOrientationEvent');
  globalThis.__SC_MOTION_PERMISSION_STATE__ = motionState;
  globalThis.__SC_ORIENTATION_PERMISSION_STATE__ = orientationState;
};

liveDocumentCamera.exposeIadSignals = SHOW_IAD_SIGNALS;

const setUIValues = (id, value) => {
  const el = document.getElementById(id);
  el.value = value;
};

// Rendering the full ~1MB base64 string into the textarea costs iOS Safari
// ~4s of layout, which blocked the whole transition into this results view
// (measured on-device: the canvas and the layout itself are ~30ms each).
// Show a short summary instead and only inject the full string when the user
// actually asks for it, so they can still select/copy it on demand.
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

const syncBodyScrollLock = () => {
  const hasOpenModal = Array.from(document.querySelectorAll('.modalContainer'))
    .some(node => !node.classList.contains('hidden'));
  document.body.classList.toggle('modal-open', hasOpenModal);
};

const setCheckField = (id, isPassing) => {
  const el = document.getElementById(id);
  if (!el) return;

  if (isPassing == null) {
    el.value = 'N/A';
    el.dataset.status = 'na';
    return;
  }

  el.value = isPassing ? 'OK' : 'Failed';
  el.dataset.status = isPassing ? 'ok' : 'failed';
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

  // Launching moves focus onto the camera, so closing it would otherwise leave
  // focus on a `display: none` element. Hand focus to whatever replaces it.
  const cameraHadFocus =
    document.activeElement === liveDocumentCamera ||
    liveDocumentCamera.contains(document.activeElement);

  liveDocumentCamera.classList.add('hidden');
  documentCameraShell.classList.remove('documentCameraShellActive');
  if (modal.classList.contains('hidden') && documentResult.classList.contains('hidden')) {
    menuButtons.classList.remove('hidden');
  }

  if (cameraHadFocus) {
    const destination = !documentResult.classList.contains('hidden')
      ? document.getElementById('doc-save-button')
      : !modal.classList.contains('hidden')
        ? modalTryAgainButton
        : liveDocumentCaptureButton;
    destination?.focus();
  }
};

const onUserCanceled = (_) => {
  console.debug('[SmartCapture LiveDocumentCamera Demo] userCanceled received at', new Date().toISOString());
  onClose();
};

const onCapture = (e) => {
  const { captureResponse } = e.detail;
  console.debug('[SmartCapture LiveDocumentCamera Demo] capture received at', new Date().toISOString());

  liveDocumentCamera.classList.add('hidden');
  documentCameraShell.classList.remove('documentCameraShellActive');

  capturedImageBase64 = captureResponse.imageBase64 ?? null;
  capturedJbx = captureResponse.jbx?.bytes ?? null;
  capturedIadSignals = captureResponse.iadSignals ?? null;
  if (inspectSignalsField) inspectSignalsField.classList.toggle('hidden', !SHOW_IAD_SIGNALS);
  if (capturedJbx) {
    const hasJbxHeader =
      capturedJbx.length >= 10 &&
      capturedJbx[0] === 0xff &&
      capturedJbx[1] === 0xd8 &&
      capturedJbx[2] === 0xff &&
      capturedJbx[3] === 0xef &&
      capturedJbx[6] === 0x4a &&
      capturedJbx[7] === 0x42 &&
      capturedJbx[8] === 0x58 &&
      capturedJbx[9] === 0x00;
    console.info('[SmartCapture LiveDocumentCamera Demo] JBX evidence', {
      byteLength: capturedJbx.byteLength,
      hasJbxHeader,
    });
  }
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

  setBase64Field('base64-img-input', baseStr);
  setCheckField('doc-is-good-input', captureResponse.isGood);
  setCheckField('doc-sharpness-input', captureResponse.isSharp);
  setCheckField('doc-glare-input', captureResponse.isGlareFree);
  setCheckField('doc-dpi-input', captureResponse.isAdequateDpi);

  if (captureResponse.failedChecks?.length) {
    setUIValues('doc-failed-checks-input', `${captureResponse.failedChecks.map(checkName => checkName)}`);
  } else {
    setUIValues('doc-failed-checks-input', 'None');
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

  if (modalBackButton) modalBackButton.onclick = goHome;
  if (modalTryAgainButton) modalTryAgainButton.onclick = restartCamera;
  if (modalClose) modalClose.onclick = goHome;

  menuButtons.classList.add('hidden');
  modal.classList.remove('hidden');
  syncBodyScrollLock();
};

const goHome = () => {
  modal.classList.add('hidden');
  syncBodyScrollLock();
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');
  documentCameraShell.classList.remove('documentCameraShellActive');
  menuButtons.classList.remove('hidden');
};

const restartCamera = async () => {
  modal.classList.add('hidden');
  syncBodyScrollLock();
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');

  documentCameraShell.classList.add('documentCameraShellActive');
  liveDocumentCamera.classList.remove('hidden');
  liveDocumentCamera.isOpen = false;
  // Await the component's own update cycle before re-opening. A setTimeout(0)
  // does not guarantee Lit finished rendering the closed state, so the re-open
  // could race the render on slower devices.
  await liveDocumentCamera.updateComplete;
  liveDocumentCamera.classList.remove('hidden');
  liveDocumentCamera.isOpen = true;
};

// --- Document camera configuration ------------------------------------------
// The SC demo launches the document camera through a configuration modal so
// different SDK configurations can be demoed without a rebuild. Every control's
// starting value in index.html mirrors the SDK's own default, so launching
// without touching anything initialises the camera with the default settings.
const docConfigModal = document.getElementById('doc-config-modal');
const docConfigCloseButton = document.getElementById('doc-config-close');
const docConfigLaunchButton = document.getElementById('doc-config-launch');
const docConfigResetButton = document.getElementById('doc-config-reset');
const docConfigValidation = document.getElementById('doc-config-validation');

// Values are the SDK defaults, used by "Reset to defaults". Durations are in
// seconds here (as the user enters them) and converted to milliseconds on apply.
const DOC_CONFIG_DEFAULTS = {
  'cfg-show-back-button': true,
  'cfg-hide-help-icon': false,
  'cfg-show-preview-screen': false,
  'cfg-success-time': 1.5,
  'cfg-enable-auto-capture': true,
  'cfg-enable-tap-to-capture': true,
  'cfg-toggle-delay': 15,
  'cfg-show-toggle': true,
  'cfg-enable-auto-capture-timeout': true,
  'cfg-auto-capture-timeout': 60,
  'cfg-document-animation': 'front',
  'cfg-document-type': 'auto',
};

const docConfigInputs = () =>
  Object.keys(DOC_CONFIG_DEFAULTS).map(id => document.getElementById(id));

const readConfigFlag = (id) => document.getElementById(id).checked;

const readConfigChoice = (id) => document.getElementById(id).value;

// Returns null for anything that is not a usable duration, so validation can
// report it instead of pushing NaN into the component.
const readConfigSeconds = (id) => {
  const seconds = Number.parseFloat(document.getElementById(id).value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

// Resolve an unusable duration to the SDK default rather than letting
// `null * 1000` push a silent 0ms value. This is load-bearing for the
// auto-capture timeout, which validation deliberately does not require while it
// is disarmed, so a blank field can legitimately reach here for a property the
// SDK will not read.
const readConfigMs = (id) =>
  (readConfigSeconds(id) ?? DOC_CONFIG_DEFAULTS[id]) * 1000;

// The number inputs declare min/max/step (and required), so let the browser's
// own constraint validation be the source of truth: the spinner affordances and
// this check can then never disagree. Returns null when the field is fine.
const describeConfigConstraint = (id) => {
  const input = document.getElementById(id);
  if (input.checkValidity()) return null;
  const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() ?? id;
  const { valueMissing, rangeUnderflow, rangeOverflow, stepMismatch } = input.validity;
  const seconds = (value) => (Number(value) === 1 ? '1 second' : `${value} seconds`);
  if (valueMissing) return `${label} must be given as a number of seconds.`;
  if (rangeUnderflow) return `${label} must be at least ${seconds(input.min)}.`;
  if (rangeOverflow) return `${label} must be at most ${seconds(input.max)}.`;
  if (stepMismatch) return `${label} must be a multiple of ${seconds(input.step)}.`;
  return `${label} must be a valid number of seconds.`;
};

// A duration only has to satisfy its constraints when the SDK will actually act
// on it, so that the value shown in the field is always the value applied. The
// success overlay and the toggle delay are always read; the auto-capture
// timeout is only read when it is armed.
const validateDocConfig = () => {
  for (const id of ['cfg-success-time', 'cfg-toggle-delay']) {
    const constraint = describeConfigConstraint(id);
    if (constraint) return { error: constraint, field: id };
  }
  const toggleDelay = readConfigSeconds('cfg-toggle-delay');

  const autoCapture = readConfigFlag('cfg-enable-auto-capture');
  const tapToCapture = readConfigFlag('cfg-enable-tap-to-capture');
  // Mirrors the SDK: with both modes disabled it falls back to auto, so the
  // timeout is still armed in that row of the capture-mode matrix.
  const bothModesDisabled = !autoCapture && !tapToCapture;
  const autoModeOn = autoCapture || bothModesDisabled;
  const timeoutArmed = readConfigFlag('cfg-enable-auto-capture-timeout') && autoModeOn;

  const autoCaptureTimeout = readConfigSeconds('cfg-auto-capture-timeout');
  if (timeoutArmed) {
    const constraint = describeConfigConstraint('cfg-auto-capture-timeout');
    if (constraint) return { error: constraint, field: 'cfg-auto-capture-timeout' };
  }

  const notices = [];

  if (bothModesDisabled) {
    notices.push('Disabling both capture modes is a misconfiguration — the SDK normalises it back to the default behaviour (both enabled).');
  }

  // The SDK requires autoCaptureTimeout > toggleAutoCaptureDelay, but it
  // enforces that itself: LiveDocumentCamera raises the timeout to the delay
  // plus a 10s buffer and warns. Report what it will do instead of blocking a
  // configuration the SDK accepts.
  if (timeoutArmed && autoCaptureTimeout <= toggleDelay) {
    notices.push(`The auto-capture timeout (${autoCaptureTimeout}s) must be greater than the auto-capture toggle delay (${toggleDelay}s) — the SDK will raise it to ${toggleDelay + 10}s and log a warning.`);
  }

  return notices.length ? { notice: notices.join(' ') } : {};
};

// Renders the validation state and returns the blocking error, if any.
const refreshDocConfigValidation = () => {
  const { error, notice, field } = validateDocConfig();
  const message = error ?? notice ?? '';
  docConfigValidation.textContent = message;
  docConfigValidation.classList.toggle('hidden', message === '');
  docConfigValidation.classList.toggle('configValidation--notice', !error && message !== '');
  docConfigLaunchButton.disabled = Boolean(error);
  docConfigInputs().forEach(input => input.removeAttribute('aria-invalid'));
  if (field) document.getElementById(field).setAttribute('aria-invalid', 'true');
  return error;
};

const applyDocumentCameraConfig = () => {
  liveDocumentCamera.showBackButton = readConfigFlag('cfg-show-back-button');
  // Surfaced to the user as "hide help icon" (default off) while the SDK
  // property is the positive "showHelpIcon" (default on).
  liveDocumentCamera.showHelpIcon = !readConfigFlag('cfg-hide-help-icon');
  liveDocumentCamera.showPreviewScreen = readConfigFlag('cfg-show-preview-screen');
  liveDocumentCamera.successTime = readConfigMs('cfg-success-time');
  liveDocumentCamera.enableAutoCapture = readConfigFlag('cfg-enable-auto-capture');
  liveDocumentCamera.enableTapToCapture = readConfigFlag('cfg-enable-tap-to-capture');
  liveDocumentCamera.toggleAutoCaptureDelay = readConfigMs('cfg-toggle-delay');
  liveDocumentCamera.showToggle = readConfigFlag('cfg-show-toggle');
  liveDocumentCamera.enableAutoCaptureTimeout = readConfigFlag('cfg-enable-auto-capture-timeout');
  liveDocumentCamera.autoCaptureTimeout = readConfigMs('cfg-auto-capture-timeout');
  liveDocumentCamera.documentType = readConfigChoice('cfg-document-type');
  liveDocumentCamera.showBackOfDocumentAnimation =
    readConfigChoice('cfg-document-animation') === 'back';
};

const resetDocConfig = () => {
  Object.entries(DOC_CONFIG_DEFAULTS).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (typeof value === 'boolean') {
      input.checked = value;
    } else {
      input.value = String(value);
    }
  });
  refreshDocConfigValidation();
};

const openDocConfigModal = () => {
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');
  refreshDocConfigValidation();
  docConfigModal.classList.remove('hidden');
  syncBodyScrollLock();
  // The dialog declares aria-modal, so move focus into it rather than leaving
  // it on the home screen behind the overlay.
  document.getElementById('cfg-show-back-button').focus();
};

const closeDocConfigModal = () => {
  docConfigModal.classList.add('hidden');
  syncBodyScrollLock();
};

// Dismissing (X or Escape) leaves the user on the home screen, so hand focus
// back to the button that opened the modal. Without this the focused control is
// inside a `display: none` subtree, which strands keyboard and screen-reader
// users. See onLiveCameraShown for the launch path's own destination.
const dismissDocConfigModal = () => {
  closeDocConfigModal();
  liveDocumentCaptureButton.focus();
};

// The dialog markup sits before #menu in the document, so without a trap a Tab
// from the last control lands on the launch buttons and footer links behind the
// overlay. The backdrop already blocks the mouse and aria-modal scopes assistive
// tech; this is the keyboard half.
const docConfigFocusables = () =>
  [...docConfigModal.querySelectorAll('button, input, select')].filter(
    el => !el.disabled && el.offsetParent !== null,
  );

const trapDocConfigTab = (event) => {
  const focusables = docConfigFocusables();
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !docConfigModal.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

const onDocConfigKeydown = (event) => {
  if (docConfigModal.classList.contains('hidden')) return;
  if (event.key === 'Escape') {
    dismissDocConfigModal();
  } else if (event.key === 'Tab') {
    trapDocConfigTab(event);
  }
};

const launchFromDocConfig = () => {
  if (refreshDocConfigValidation()) return;
  closeDocConfigModal();
  openLiveCamera();
};

const openLiveCamera = () => {
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');
  // resetCamera() (the "Capture Backside" flow) leaves
  // showBackOfDocumentAnimation set to true on the component — every fresh
  // launch from the home screen starts a new document, so re-apply the
  // configured settings here instead of inheriting whatever the previous
  // session's flow left behind.
  applyDocumentCameraConfig();

  // The SDK never prompts for motion/orientation itself, and Document IAD does
  // not advertise motion signals, so the demo only asks under ?iad.
  const sensorPermissionsIfIadEnabled = SHOW_IAD_SIGNALS
    ? requestDeviceSensorPermissionsOnUserGesture().catch(() => {
        globalThis.__SC_MOTION_PERMISSION_STATE__ = globalThis.__SC_MOTION_PERMISSION_STATE__ || 'error';
        globalThis.__SC_ORIENTATION_PERMISSION_STATE__ = globalThis.__SC_ORIENTATION_PERMISSION_STATE__ || 'error';
      })
    : Promise.resolve();

  sensorPermissionsIfIadEnabled
    .then(() => navigator.mediaDevices.getUserMedia({ video: true }))
    .then((stream) => {
      menuButtons.classList.add('hidden');
      documentCameraShell.classList.add('documentCameraShellActive');
      liveDocumentCamera.classList.remove('hidden');
      liveDocumentCamera.isOpen = true;
      errorCamera.classList.add('hidden');
      // Launching from the modal leaves focus on a control that is now inside a
      // `display: none` subtree. The camera is what became visible, so send
      // focus to it (it carries tabindex="-1" for exactly this).
      liveDocumentCamera.focus();
      stream.getTracks().forEach(track => track.stop());
    })
    .catch((err) => {
      console.error('[SmartCapture LiveDocumentCamera Demo] error accessing the camera at', new Date().toISOString(), ':', err);
      errorCamera.classList.remove('hidden');
      // The camera never opened and the home screen is still up, so put focus
      // back on the launch button rather than leaving it in the hidden modal.
      liveDocumentCaptureButton.focus();
    });
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
  if (capturedJbx) {
    const url = URL.createObjectURL(
      new Blob([capturedJbx], { type: 'image/jpeg' }),
    );
    const link = document.createElement('a');
    document.body.appendChild(link);
    link.setAttribute('href', url);
    link.setAttribute('download', `${Date.now()}-jbx.jpg`);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!capturedImageBase64) return;

  const blobUrl = URL.createObjectURL(dataUrlToBlob(capturedImageBase64));

  const link = document.createElement('a');
  document.body.appendChild(link);

  link.setAttribute('href', blobUrl);
  link.setAttribute('download', `${Date.now()}.jpg`);
  link.click();

  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

const resetCamera = async () => {
  documentResult.classList.add('hidden');
  documentCameraShell.classList.add('documentCameraShellActive');
  liveDocumentCamera.isOpen = false;
  // Same as restartCamera: let the closed state render before re-opening, then
  // request the back-of-document animation unconditionally — this is what puts
  // the component back into the "capture the other side" state.
  await liveDocumentCamera.updateComplete;
  liveDocumentCamera.showBackOfDocumentAnimation = true;
  liveDocumentCamera.classList.remove('hidden');
  liveDocumentCamera.isOpen = true;
};

// --- Internal IAD signals view (?iad) --------------------------------------

const formatSignalValue = (value) => {
  if (value === undefined || value === null || value === '') return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join('\n') : '[]';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const humanizeLabel = (text) => text
  .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .replaceAll(/\b\w/g, c => c.toUpperCase());

const appendSignalRow = (container, key, value) => {
  const row = document.createElement('div');
  row.className = 'iadSignalRow';
  const label = document.createElement('div');
  label.className = 'iadSignalLabel';
  label.textContent = humanizeLabel(key);
  const valueEl = document.createElement('div');
  valueEl.className = 'iadSignalValue';
  valueEl.textContent = formatSignalValue(value);
  row.append(label, valueEl);
  container.appendChild(row);
};

const renderSignalObjectRows = (container, obj, prefix = '') => {
  Object.entries(obj).forEach(([key, value]) => {
    const compositeKey = prefix ? `${prefix} > ${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      renderSignalObjectRows(container, value, compositeKey);
      return;
    }
    appendSignalRow(container, compositeKey, value);
  });
};

const buildSignalSection = (sectionKey, sectionValue) => {
  const section = document.createElement('details');
  section.className = 'iadSection';
  section.open = sectionKey === 'captureProvenance';
  const title = document.createElement('summary');
  title.className = 'iadSectionTitle';
  title.textContent = humanizeLabel(sectionKey);
  const body = document.createElement('div');
  body.className = 'iadSectionBody';
  if (sectionValue && typeof sectionValue === 'object' && !Array.isArray(sectionValue)) {
    renderSignalObjectRows(body, sectionValue);
  } else {
    appendSignalRow(body, sectionKey, sectionValue);
  }
  section.append(title, body);
  return section;
};

const renderIadSignals = () => {
  iadSignalsView.replaceChildren();
  if (!capturedIadSignals) {
    const status = document.createElement('div');
    status.className = 'iadEmptyState';
    // A tap capture is not sealed; an auto capture from an obfuscated
    // (published) build never hands the signals back.
    status.textContent = capturedJbx
      ? 'This SDK build does not expose IAD signals. Run the demo with yarn start.'
      : 'No IAD signals: only auto-captured images are sealed. Tap-to-capture images carry no JBX.';
    iadSignalsView.appendChild(status);
    return;
  }
  Object.entries(capturedIadSignals).forEach(([sectionKey, sectionValue]) => {
    iadSignalsView.appendChild(buildSignalSection(sectionKey, sectionValue));
  });
};

const getIadSignalsJson = () =>
  capturedIadSignals ? JSON.stringify(capturedIadSignals, null, 2) : '';

const copyIadSignalsJson = async () => {
  const payload = getIadSignalsJson();
  if (!payload || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(payload);
    iadCopyJsonButton.classList.add('is-copied');
    setTimeout(() => iadCopyJsonButton.classList.remove('is-copied'), 1200);
  } catch (error) {
    // Clipboard access can be denied (permissions/insecure context); the demo
    // simply skips the copied-state feedback in that case.
    console.debug('[SmartCapture LiveDocumentCamera Demo] clipboard copy failed:', error);
  }
};

const downloadIadSignalsJson = () => {
  const payload = getIadSignalsJson();
  if (!payload) return;
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `iad-signals-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same tick as click() can cancel the download in some
  // browsers (historically Firefox); defer it until after the click is handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const openIadSignalsModal = () => {
  renderIadSignals();
  iadModal.classList.remove('hidden');
  syncBodyScrollLock();
};

const closeIadSignalsModal = () => {
  iadModal.classList.add('hidden');
  syncBodyScrollLock();
};

const setupDocCamera = () => {
  liveDocumentCamera.isOpen = false;
  // Configuration comes from the configuration modal, whose controls start at
  // the SDK defaults — apply it once up-front so the component is configured
  // before the first launch as well.
  applyDocumentCameraConfig();

  SmartCaptureModule.getInstance().init();
  liveDocumentCaptureButton.addEventListener('click', openDocConfigModal);
  docConfigCloseButton.addEventListener('click', dismissDocConfigModal);
  docConfigResetButton.addEventListener('click', resetDocConfig);
  docConfigLaunchButton.addEventListener('click', launchFromDocConfig);
  docConfigInputs().forEach(input =>
    input.addEventListener('input', refreshDocConfigValidation),
  );
  document.addEventListener('keydown', onDocConfigKeydown);
  saveButton.addEventListener('click', saveImage);
  resetCameraButton.addEventListener('click', resetCamera);
  const base64Field = document.getElementById('base64-img-input');
  if (base64Field) base64Field.addEventListener('focus', loadFullBase64);

  const docCloseBtn = document.getElementById('doc-close-results-button');
  if (docCloseBtn) docCloseBtn.addEventListener('click', goHome);
  if (SHOW_IAD_SIGNALS) {
    inspectSignalsButton.addEventListener('click', openIadSignalsModal);
    iadModalClose.addEventListener('click', closeIadSignalsModal);
    iadCopyJsonButton.addEventListener('click', copyIadSignalsJson);
    iadDownloadJsonButton.addEventListener('click', downloadIadSignalsJson);
  }
  liveDocumentCamera.addEventListener(LiveDocumentCamera.OpenEventName, onOpen);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.CaptureEventName, onCapture);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.DetectEventName, onDetect);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.CloseEventName, onClose);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.UserCanceledEventName, onUserCanceled);
  liveDocumentCamera.addEventListener(LiveDocumentCamera.FailureEventName, onFailure);

  loader.classList.add('hidden');
  modal.classList.add('hidden');
  syncBodyScrollLock();
  menuButtons.classList.remove('hidden');
};

setupDocCamera();
