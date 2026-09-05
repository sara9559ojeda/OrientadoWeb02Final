export function createImageViewer(imageUrl) {
    const viewer = document.createElement('div')
    viewer.id = 'image-viewer'
    viewer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      max-width: 600px;
      max-height: 80vh;
      padding: 12px;
      background: rgba(0, 0, 0, 0.9);
      border-radius: 16px;
      box-shadow: 0 0 20px rgba(0, 255, 247, 0.5);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.5s ease;
    `
  
    const img = document.createElement('img')
    img.src = imageUrl
    img.style.cssText = `
      max-width: 100%;
      max-height: 70vh;
      border-radius: 12px;
      object-fit: contain;
    `
  
    const close = document.createElement('button')
    close.innerText = '✖'
    close.style.cssText = `
      position: absolute;
      top: 8px;
      right: 12px;
      background: transparent;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
    `
    close.onclick = () => viewer.remove()
  
    viewer.appendChild(close)
    viewer.appendChild(img)
    document.body.appendChild(viewer)
  }
  