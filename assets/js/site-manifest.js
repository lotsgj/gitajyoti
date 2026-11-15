if (location.protocol === 'http:' || location.protocol === 'https:') {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = document.currentScript?.dataset.manifest || 'site.webmanifest';
  document.head.append(manifest);
}
