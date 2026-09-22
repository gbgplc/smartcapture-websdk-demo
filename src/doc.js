import { LiveDocumentCamera, SmartCaptureModule } from '@gbgplc/smartcapture-web';

const IAD_ENABLED = new URLSearchParams(globalThis.location?.search).has('iad');

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
const iadModal = document.getElementById('iad-modal');
const iadModalClose = document.getElementById('iad-modal-close');
const iadSignalsTextarea = document.getElementById('iad-signals-textarea');
const iadSignalsView = document.getElementById('iad-signals-view');
const iadCopyJsonButton = document.getElementById('iad-copy-json-button');
const iadDownloadJsonButton = document.getElementById('iad-download-json-button');
const documentResult = document.getElementById('doc-result');
const documentCanvas = document.getElementById('doc-canvas');
const saveButton = document.getElementById('doc-save-button');
const inspectSignalsButton = document.getElementById('doc-inspect-signals-button');
let capturedImageBase64 = null;
let capturedIadSignals = null;
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

// Configure timeout for auto-capture
liveDocumentCamera.autoCaptureTimeout = 60000; // 1 minute (default)
liveDocumentCamera.enableAutoCaptureTimeout = true;
// SDK-side IAD collection is opt-in and off by default — only turn it on when
// the demo's own ?iad flag is present, so the two stay in lockstep.
liveDocumentCamera.enableInjectionAttackDetection = IAD_ENABLED;

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

  liveDocumentCamera.classList.add('hidden');
  documentCameraShell.classList.remove('documentCameraShellActive');
  if (modal.classList.contains('hidden') && documentResult.classList.contains('hidden')) {
    menuButtons.classList.remove('hidden');
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
  capturedIadSignals = captureResponse.metrics?.iadSignals ?? null;
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
  if (iadModal) iadModal.classList.add('hidden');
  syncBodyScrollLock();
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');
  documentCameraShell.classList.remove('documentCameraShellActive');
  menuButtons.classList.remove('hidden');
};

const restartCamera = async () => {
  modal.classList.add('hidden');
  if (iadModal) iadModal.classList.add('hidden');
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

const openLiveCamera = () => {
  documentResult.classList.add('hidden');
  const faceResult = document.getElementById('face-result');
  if (faceResult) faceResult.classList.add('hidden');
  // resetCamera() (the "Capture Backside" flow) leaves this set to true on
  // the component — every fresh launch from the home screen starts a new
  // document, so this must default back to the frontside animation instead
  // of inheriting whatever the previous session's flow left behind.
  liveDocumentCamera.showBackOfDocumentAnimation = false;

  // Only pre-request motion/orientation permissions when IAD is enabled — this
  // is purely in service of the IAD motion signals; the normal capture flow
  // has no use for them and should not prompt for them.
  const sensorPermissionsIfIadEnabled = IAD_ENABLED
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
      stream.getTracks().forEach(track => track.stop());
    })
    .catch((err) => {
      console.error('[SmartCapture LiveDocumentCamera Demo] error accessing the camera at', new Date().toISOString(), ':', err);
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

  link.remove();
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

// Pretty-prints a string that looks like a JSON object/array; returns the
// original string unchanged when it is not valid JSON.
const tryPrettyJson = (text) => {
  const trimmed = text.trim();
  const looksLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!looksLikeJson) return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    // Looked like JSON but did not parse — show the raw string as-is.
    return text;
  }
};

const formatSignalValue = (value) => {
  if (value === undefined || value === null || value === '') return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join('\n') : '[]';
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}` : 'N/A';
  if (typeof value === 'string') return tryPrettyJson(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const humanizeLabel = (text) => text
  .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .replaceAll(/\b\w/g, c => c.toUpperCase());

const SECTION_TOOLTIPS = {
  schemaVersion: 'Schema version of the client IAD payload. Use it for parser compatibility and migration control.',
  captureProvenance: 'Capture lifecycle and camera settings evidence. Useful to detect inconsistent constraints, permission anomalies, and suspicious capture timing.',
  cameraDeviceFingerprint: 'Pseudonymous device/camera fingerprinting (FNV-1a hashes, not anonymized). Useful to detect virtual cameras, emulator patterns, and unusual device inventories.',
  streamIntegrity: 'Runtime stream behavior signals. Useful to detect replay/injection patterns through cadence anomalies, duplicate frames, and stream lifecycle interruptions.',
  imageConsistency: 'Frame-level statistical consistency. Useful to detect static/replayed feeds with low temporal variation.',
  clientIntegrity: 'Browser/runtime integrity hints. Useful for automation/emulation risk uplift.',
  motionIntegrity: 'Motion and orientation sensor consistency (best effort). Useful to identify static/replayed sessions and suspiciously flat sensor behavior on mobile devices.',
  replayProtection: 'Replay-window enforcement signals. Nonce binding is planned for a future iteration; timestampUtc is populated now.',
};

const FIELD_TOOLTIPS = {
  'captureProvenance.captureStartUtc': 'UTC timestamp when capture flow started. Use with end time and nonce TTL to detect replay windows.',
  'captureProvenance.captureEndUtc': 'UTC timestamp when selected frame was finalized. Helps correlate session chronology and replay checks.',
  'captureProvenance.monotonicDurationMs': 'High-resolution elapsed capture duration. Unexpectedly low/high durations can indicate automation or injection behavior.',
  'captureProvenance.requestedVideoConstraints': 'Requested WebRTC constraints. Compare against applied settings to spot mismatches.',
  'captureProvenance.appliedTrackSettings': 'Effective camera settings from MediaStreamTrack. Mismatch vs requested constraints can increase risk.',
  'captureProvenance.trackCapabilitiesPresent': 'Capabilities exposed by active track. Missing or unusual capability sets can be environment-specific signals.',
  'captureProvenance.permissionCameraBefore': 'Camera permission state before starting capture.',
  'captureProvenance.permissionCameraAfter': 'Camera permission state after stream acquisition. Unexpected transitions can be suspicious.',
  'cameraDeviceFingerprint.videoinputCount': 'Count of detected video input devices. Extremely unusual counts can indicate emulator/virtual environments.',
  'cameraDeviceFingerprint.audioinputCount': 'Count of detected audio input devices. Can support environment consistency checks.',
  'cameraDeviceFingerprint.selectedDeviceIdHash': 'Hashed selected device ID (privacy-safe). Use for per-device baselining without raw identifiers.',
  'cameraDeviceFingerprint.selectedGroupIdHash': 'Hashed device group ID (privacy-safe). Helps cluster related media hardware.',
  'cameraDeviceFingerprint.selectedLabelHash': 'Hashed selected camera label (privacy-safe).',
  'cameraDeviceFingerprint.selectedFacingMode': 'Applied facing mode (e.g., environment/user). Unexpected values can be suspicious for document capture.',
  'cameraDeviceFingerprint.backCameraDetected': 'Whether a back camera was detected in inventory.',
  'cameraDeviceFingerprint.suspiciousVirtualCameraLabelHashes': 'FNV-1a hashes of labels matching known virtual-camera keywords (OBS, ManyCam, Snap Camera, etc.). Empty if none detected. Backend decides whether to treat any as suspicious.',
  'streamIntegrity.avgFps': 'Average frame rate during analyzed frames.',
  'streamIntegrity.fpsStdDev': 'Frame rate variability. High instability can indicate injection/replay pipelines.',
  'streamIntegrity.duplicateFrameRatio': 'Ratio of repeated frame signatures. Elevated ratios can indicate replay/static feeds.',
  'streamIntegrity.duplicateFrames': 'Absolute count of duplicate frame signatures.',
  'streamIntegrity.analyzedFrames': 'Total frames analyzed for stream integrity signals.',
  'streamIntegrity.videoDimensionChangeCount': 'Number of active stream dimension changes. Unexpected changes can be suspicious.',
  'streamIntegrity.trackMutedEventCount': 'Count of track mute events during capture session.',
  'streamIntegrity.trackUnmutedEventCount': 'Count of track unmute events during capture session.',
  'streamIntegrity.trackEndedEventCount': 'Count of track ended events during capture session.',
  'streamIntegrity.visibilityHiddenCount': 'How many times app/tab went hidden while capture session was active.',
  'streamIntegrity.visibilityVisibleCount': 'How many times app/tab returned visible while capture session was active.',
  'streamIntegrity.browserResumeCount': 'Detection loop resumes after backgrounding/throttling. Frequent resumes can affect trust.',
  'streamIntegrity.canvasReadFailureCount': 'Frame extraction failures from canvas/video. Can indicate tampering or unstable environment.',
  'streamIntegrity.sequenceBreakCount': 'SDK sequence-break errors raised during capture.',
  'imageConsistency.luminanceMean': 'Average luminance of sampled frames.',
  'imageConsistency.luminanceStdDev': 'Luminance variation across sampled frames. Very low variation can indicate replay/static capture.',
  'imageConsistency.varianceMean': 'Average spatial variance within sampled frame region.',
  'imageConsistency.varianceStdDev': 'Spatial variance fluctuation over time. Low dynamics can indicate non-live content.',
  'clientIntegrity.webdriver': 'Browser automation hint. True typically indicates automated tooling or controlled environment.',
  'clientIntegrity.platform': 'Which SDK produced this payload. Always "Web" here; the Android SDK sends "Android". A fixed marker, not the host OS.',
  'clientIntegrity.osPlatform': 'Host OS reported by User-Agent Client Hints (macOS, Windows, Android, iOS). Empty on Firefox/Safari, which do not expose it.',
  'clientIntegrity.userAgent': 'User-agent string for backend policy/risk rules.',
  'clientIntegrity.language': 'Browser language setting.',
  'clientIntegrity.hardwareConcurrency': 'Reported logical CPU count; can assist in environment profiling.',
  'clientIntegrity.maxTouchPoints': 'Reported touch-point capability; helps classify mobile vs desktop-like environments.',
  'motionIntegrity.motionSupported': 'Whether DeviceMotionEvent is available in this environment.',
  'motionIntegrity.orientationSupported': 'Whether DeviceOrientationEvent is available in this environment.',
  'motionIntegrity.motionPermissionState': 'Runtime motion permission state (granted/denied/unsupported/gesture_required/blocked_by_policy/error).',
  'motionIntegrity.orientationPermissionState': 'Runtime orientation permission state (granted/denied/unsupported/gesture_required/blocked_by_policy/error).',
  'motionIntegrity.motionSamplesCount': 'Number of motion sensor samples collected during capture.',
  'motionIntegrity.orientationSamplesCount': 'Number of orientation samples collected during capture.',
  'motionIntegrity.motionCoverageMs': 'Duration covered by motion sampling during session.',
  'motionIntegrity.sensorSamplingHzMean': 'Average sensor sampling rate in Hz.',
  'motionIntegrity.sensorSamplingHzStdDev': 'Sensor sampling rate variability (Hz).',
  'motionIntegrity.accelerationMagnitudeMean': 'Average acceleration magnitude from motion samples.',
  'motionIntegrity.accelerationMagnitudeStdDev': 'Acceleration magnitude variability.',
  'motionIntegrity.accelerationMagnitudeVariance': 'Acceleration magnitude variance.',
  'motionIntegrity.rotationRateMagnitudeMean': 'Average rotation-rate magnitude from gyroscope-like data.',
  'motionIntegrity.rotationRateMagnitudeStdDev': 'Rotation-rate variability.',
  'motionIntegrity.rotationRateMagnitudeVariance': 'Rotation-rate variance.',
  'motionIntegrity.orientationChangeCount': 'Count of meaningful orientation changes during capture.',
  'motionIntegrity.motionFlatlineRatio': 'Ratio of near-zero motion samples. Higher values can indicate static/replayed sources.',
  'replayProtection.nonce': 'Server-issued nonce for binding the payload to a specific session. Null until nonce binding is implemented.',
  'replayProtection.timestampUtc': 'ISO 8601 UTC timestamp of capture end. Used for replay-window checks.',
};

const getFieldTooltip = (path, fieldKey) =>
  FIELD_TOOLTIPS[path] || FIELD_TOOLTIPS[`${path}.${fieldKey}`] || '';

const appendSignalRow = (container, key, value, tooltipText = '') => {
  const row = document.createElement('div');
  row.className = 'iadSignalRow';

  const label = document.createElement('div');
  label.className = 'iadSignalLabel';
  const labelText = document.createElement('span');
  labelText.textContent = humanizeLabel(key);
  label.appendChild(labelText);

  if (tooltipText) {
    const tip = document.createElement('span');
    tip.className = 'iadTooltipIcon';
    tip.textContent = 'i';
    tip.title = tooltipText;
    tip.setAttribute('aria-label', tooltipText);
    label.appendChild(tip);
  }

  const valueEl = document.createElement('div');
  valueEl.className = 'iadSignalValue';
  valueEl.textContent = formatSignalValue(value);

  row.appendChild(label);
  row.appendChild(valueEl);
  container.appendChild(row);
};

const renderSignalObjectRows = (container, obj, prefix = '', sectionPath = '') => {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const compositeKey = prefix ? `${prefix} > ${key}` : key;
    const fieldPath = sectionPath ? `${sectionPath}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      renderSignalObjectRows(container, value, compositeKey, fieldPath);
      return;
    }
    appendSignalRow(container, compositeKey, value, getFieldTooltip(fieldPath, key));
  });
};

// ---------------------------------------------------------------------------
// Risk assessment is delegated to the IAD evaluation engine so that all
// platforms (Android, iOS, Web) share a single scoring implementation.
// ---------------------------------------------------------------------------
const DEFAULT_IAD_ENGINE_URL = 'http://localhost:3000/evaluate';

// The full IAD signals payload (device/camera/sensor/browser data) is POSTed
// to this URL. Only a same-machine local-dev evaluator is a legitimate use of
// the ?iadEngine override — anything else would let a crafted link exfiltrate
// a visitor's signals to an arbitrary origin. Reject anything that isn't
// http(s) to localhost/127.0.0.1/[::1] and fall back to the default.
const isTrustedIadEngineUrl = (candidate) => {
  try {
    const url = new URL(candidate, globalThis.location?.href);
    const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      LOCAL_HOSTNAMES.has(url.hostname)
    );
  } catch {
    // Not a parseable URL — treat as untrusted rather than throwing.
    return false;
  }
};

const requestedIadEngineUrl = new URLSearchParams(globalThis.location?.search).get('iadEngine');
if (requestedIadEngineUrl && !isTrustedIadEngineUrl(requestedIadEngineUrl)) {
  console.warn(
    '[SmartCapture LiveDocumentCamera Demo] ignoring iadEngine override — only http(s) to localhost/127.0.0.1/[::1] is allowed:',
    requestedIadEngineUrl,
  );
}
const IAD_ENGINE_URL =
  requestedIadEngineUrl && isTrustedIadEngineUrl(requestedIadEngineUrl)
    ? requestedIadEngineUrl
    : DEFAULT_IAD_ENGINE_URL;

const RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const FINDING_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

// Raised when the engine did reply but the body is not a risk assessment we can
// render. Kept distinct from a transport failure so the UI does not tell people
// the engine is unreachable when it answered — that sends them looking for a
// networking problem that isn't there.
class UnexpectedEngineResponseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnexpectedEngineResponseError';
  }
}

const normalizeFinding = (finding, index) => {
  if (!finding || typeof finding !== 'object') {
    throw new UnexpectedEngineResponseError(
      `findings[${index}] is not an object`,
    );
  }
  if (typeof finding.signal !== 'string' || !finding.signal) {
    throw new UnexpectedEngineResponseError(
      `findings[${index}].signal is missing or not a string`,
    );
  }
  return {
    signal: finding.signal,
    // A finding without usable prose still renders — fall back to its signal
    // path rather than an empty bullet.
    detail:
      typeof finding.detail === 'string' && finding.detail
        ? finding.detail
        : finding.signal,
    severity: FINDING_SEVERITIES.has(finding.severity)
      ? finding.severity
      : 'medium',
  };
};

// Single place where an engine response becomes a shape the renderers can rely
// on. Both renderRiskBanner() and the flagged-section logic previously assumed
// every 200 carried findings[] with a string `signal` on each entry; a
// valid-but-unexpected body made them throw mid-render.
const normalizeAssessment = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new UnexpectedEngineResponseError('response body is not an object');
  }

  const level = typeof raw.level === 'string' ? raw.level.toUpperCase() : '';
  if (!RISK_LEVELS.has(level)) {
    throw new UnexpectedEngineResponseError(
      `unrecognised risk level ${JSON.stringify(raw.level)}`,
    );
  }
  if (!Array.isArray(raw.findings)) {
    throw new UnexpectedEngineResponseError('findings is not an array');
  }

  const findings = raw.findings.map(normalizeFinding);

  return {
    level,
    // Rendered as "n/a" rather than "NaN / 100" when absent or non-finite.
    score: Number.isFinite(raw.score) ? raw.score : null,
    findings,
    flaggedSections: new Set(findings.map(f => f.signal.split('.')[0])),
  };
};

const fetchRiskAssessment = async (signals) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(IAD_ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signals),
      signal: controller.signal,
    });
    if (!response.ok) {
      // The engine answered — a status-code failure is not unreachability.
      throw new UnexpectedEngineResponseError(`HTTP ${response.status}`);
    }
    let body;
    try {
      body = await response.json();
    } catch (error) {
      throw new UnexpectedEngineResponseError(
        `response body is not valid JSON (${error.message})`,
      );
    }
    return normalizeAssessment(body);
  } finally {
    clearTimeout(timeoutId);
  }
};

const SEVERITY_LABEL = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };

const renderRiskBanner = (assessment) => {
  const banner = document.createElement('div');
  banner.className = `iadRiskBanner iadRiskBanner--${assessment.level.toLowerCase()}`;

  const header = document.createElement('div');
  header.className = 'iadRiskHeader';

  const badge = document.createElement('span');
  badge.className = 'iadRiskBadge';
  badge.textContent = `${assessment.level} RISK`;

  const scoreEl = document.createElement('span');
  scoreEl.className = 'iadRiskScore';
  scoreEl.textContent =
    assessment.score === null
      ? 'Score: n/a'
      : `Score: ${assessment.score} / 100`;

  header.appendChild(badge);
  header.appendChild(scoreEl);
  banner.appendChild(header);

  if (assessment.findings.length > 0) {
    const list = document.createElement('ul');
    list.className = 'iadRiskFindings';
    assessment.findings.forEach(f => {
      const item = document.createElement('li');
      item.className = `iadRiskFinding iadRiskFinding--${f.severity}`;
      const dot = document.createElement('span');
      dot.className = 'iadRiskFindingDot';
      dot.setAttribute('aria-label', SEVERITY_LABEL[f.severity]);
      const text = document.createElement('span');
      text.textContent = f.detail;
      item.appendChild(dot);
      item.appendChild(text);
      list.appendChild(item);
    });
    banner.appendChild(list);
  } else {
    const clean = document.createElement('p');
    clean.className = 'iadRiskClean';
    clean.textContent = 'No suspicious signals detected in this capture.';
    banner.appendChild(clean);
  }

  const disclaimer = document.createElement('p');
  disclaimer.className = 'iadRiskDisclaimer';
  disclaimer.textContent = 'Assessment produced by the IAD evaluation engine.';
  banner.appendChild(disclaimer);

  return banner;
};

const SIGNAL_SECTION_ORDER = [
  'schemaVersion',
  'captureProvenance',
  'cameraDeviceFingerprint',
  'streamIntegrity',
  'imageConsistency',
  'clientIntegrity',
  'motionIntegrity',
  'replayProtection',
];

const buildSignalSectionTitle = (sectionKey, isFlagged) => {
  const title = document.createElement('summary');
  title.className = 'iadSectionTitle';
  const titleText = document.createElement('span');
  titleText.textContent = humanizeLabel(sectionKey);
  title.appendChild(titleText);
  if (isFlagged) {
    const flag = document.createElement('span');
    flag.className = 'iadSectionFlag';
    flag.textContent = '⚠ Flagged';
    title.appendChild(flag);
  }
  const sectionTip = SECTION_TOOLTIPS[sectionKey];
  if (sectionTip) {
    const tip = document.createElement('span');
    tip.className = 'iadTooltipIcon';
    tip.textContent = 'i';
    tip.title = sectionTip;
    tip.setAttribute('aria-label', sectionTip);
    title.appendChild(tip);
  }
  return title;
};

const buildSignalSection = (sectionKey, signals, assessment) => {
  const isFlagged = assessment?.flaggedSections.has(sectionKey) ?? false;
  const section = document.createElement('details');
  section.className = `iadSection${isFlagged ? ' iadSectionFlagged' : ''}`;
  section.open =
    isFlagged ||
    sectionKey === 'schemaVersion' ||
    sectionKey === 'captureProvenance';
  section.appendChild(buildSignalSectionTitle(sectionKey, isFlagged));

  const body = document.createElement('div');
  body.className = 'iadSectionBody';
  const sectionValue = signals[sectionKey];
  const isObject =
    sectionValue && typeof sectionValue === 'object' && !Array.isArray(sectionValue);
  if (isObject) {
    renderSignalObjectRows(body, sectionValue, '', sectionKey);
  } else {
    appendSignalRow(body, 'value', sectionValue, getFieldTooltip(sectionKey, sectionKey));
  }
  section.appendChild(body);
  return section;
};

const appendStatusMessage = (message) => {
  const status = document.createElement('div');
  status.className = 'iadEmptyState';
  status.textContent = message;
  iadSignalsView.appendChild(status);
};

const renderIadSignalsSummary = (signals, assessment, statusMessage) => {
  if (!iadSignalsView) return;
  iadSignalsView.replaceChildren();

  if (!signals) {
    appendStatusMessage('No IAD signals available for this capture.');
    return;
  }

  if (assessment) {
    iadSignalsView.appendChild(renderRiskBanner(assessment));
  } else if (statusMessage) {
    appendStatusMessage(statusMessage);
  }

  SIGNAL_SECTION_ORDER.forEach(sectionKey => {
    if (sectionKey in signals) {
      iadSignalsView.appendChild(
        buildSignalSection(sectionKey, signals, assessment),
      );
    }
  });
};

const getIadSignalsJson = () => {
  if (!capturedIadSignals) return '';
  return JSON.stringify(capturedIadSignals, null, 2);
};

const copyIadSignalsJson = async () => {
  const payload = getIadSignalsJson();
  if (!payload || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(payload);
    if (iadCopyJsonButton) iadCopyJsonButton.classList.add('is-copied');
    setTimeout(() => {
      if (iadCopyJsonButton) iadCopyJsonButton.classList.remove('is-copied');
    }, 1200);
  } catch (error) {
    // Clipboard access can be denied (permissions/insecure context); the demo
    // simply skips the copied-state feedback in that case.
    console.debug('[SmartCapture LiveDocumentCamera Demo] clipboard copy failed:', error);
  }
};

const downloadIadSignalsJson = () => {
  const payload = getIadSignalsJson();
  if (!payload) return;
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
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
  if (!iadModal || !iadSignalsTextarea) return;
  renderIadSignalsSummary(capturedIadSignals, null, 'Evaluating signals…');

  iadSignalsTextarea.value = capturedIadSignals
    ? JSON.stringify(capturedIadSignals, null, 2)
    : 'No IAD signals available for this capture.';
  iadModal.classList.remove('hidden');
  syncBodyScrollLock();

  if (capturedIadSignals) {
    fetchRiskAssessment(capturedIadSignals)
      .then(assessment => {
        renderIadSignalsSummary(capturedIadSignals, assessment, null);
      })
      .catch(error => {
        const reason =
          error instanceof UnexpectedEngineResponseError
            ? `IAD evaluation engine at ${IAD_ENGINE_URL} returned an unexpected response — ${error.message}.`
            : `IAD evaluation engine unreachable at ${IAD_ENGINE_URL}.`;
        renderIadSignalsSummary(
          capturedIadSignals,
          null,
          `${reason} Signals are shown without a risk assessment.`,
        );
      });
  }
};

const closeIadSignalsModal = () => {
  if (iadModal) iadModal.classList.add('hidden');
  syncBodyScrollLock();
};


const setupDocCamera = () => {
  liveDocumentCamera.isOpen = false;
  liveDocumentCamera.showToggle = true;
  liveDocumentCamera.showBackButton = true; // Example: Configure back button visibility
  liveDocumentCamera.successTime = 1500;
  liveDocumentCamera.showHelpIcon = true;
  liveDocumentCamera.forceManualCamera = false;
  liveDocumentCamera.showPreviewScreen = true; // Opt-in: false by default (see docs/web/document-camera.md)

  SmartCaptureModule.getInstance().init();
  liveDocumentCaptureButton.addEventListener('click', openLiveCamera);
  saveButton.addEventListener('click', saveImage);
  resetCameraButton.addEventListener('click', resetCamera);
  const base64Field = document.getElementById('base64-img-input');
  if (base64Field) base64Field.addEventListener('focus', loadFullBase64);

  if (IAD_ENABLED) {
    if (inspectSignalsButton) inspectSignalsButton.addEventListener('click', openIadSignalsModal);
    if (iadModalClose) iadModalClose.addEventListener('click', closeIadSignalsModal);
    if (iadCopyJsonButton) iadCopyJsonButton.addEventListener('click', copyIadSignalsJson);
    if (iadDownloadJsonButton) iadDownloadJsonButton.addEventListener('click', downloadIadSignalsJson);
  } else {
    if (inspectSignalsButton) inspectSignalsButton.classList.add('hidden');
    if (iadModal) iadModal.classList.add('hidden');
  }
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
  syncBodyScrollLock();
  menuButtons.classList.remove('hidden');
};

setupDocCamera();
