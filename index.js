const basePath = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}`;

const configure = () => {
  const documentCamera = document.createElement('script');
  documentCamera.src = `${basePath}/src/doc.js`
  documentCamera.type = 'module';
  document.body.appendChild(documentCamera);

  const face = document.createElement('script');
  face.src = `${basePath}/src/face.js`
  face.type = 'module';
  document.body.appendChild(face);

  // const credential = document.createElement('script');
  // credential.src = `${basePath}/Credential.js`;
  // document.body.appendChild(credential);
};

configure();
