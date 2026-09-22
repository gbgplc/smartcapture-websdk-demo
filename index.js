const basePath = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}`;

const configure = () => {
  const documentCamera = document.createElement('script');
  documentCamera.src = `${basePath}/src/doc.js`;
  documentCamera.type = 'module';
  document.body.appendChild(documentCamera);

  // The face camera module does expensive background work as soon as it's
  // mounted (confirmed via profiling: it stalls page rendering even during
  // unrelated document-camera interactions). Defer creating the element and
  // loading its script until the user actually asks for the face camera,
  // instead of always paying that cost on page load.
  const liveFaceButton = document.getElementById('live-face-button');
  let faceModuleLoaded = false;
  liveFaceButton.addEventListener('click', () => {
    if (faceModuleLoaded) {
      return;
    }
    faceModuleLoaded = true;

    const liveFaceCamera = document.createElement('live-face-camera');
    liveFaceCamera.id = 'live-face-camera';
    document.body.appendChild(liveFaceCamera);

    const face = document.createElement('script');
    face.src = `${basePath}/src/face.js`;
    face.type = 'module';
    // face.js wires its own click listener onto this same button once loaded —
    // re-dispatch the click so the camera actually opens on this first click
    // instead of requiring the user to click twice.
    face.onload = () => liveFaceButton.click();
    document.body.appendChild(face);
  });
};

configure();
