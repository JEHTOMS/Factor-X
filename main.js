// --- Font loading with opentype.js for div-based text distortion ---

// Helper function to get element by ID, checking both desktop and mobile versions
function getElement(id) {
  const desktop = document.getElementById(id);
  const mobile = document.getElementById('md-' + id);
  return desktop || mobile;
}

// Helper function to get all elements (both desktop and mobile) by ID
function getAllElements(id) {
  const elements = [];
  const desktop = document.getElementById(id);
  const mobile = document.getElementById('md-' + id);
  if (desktop) elements.push(desktop);
  if (mobile) elements.push(mobile);
  return elements;
}

// Helper function to query selector with both desktop and mobile versions
function querySelectorDual(selector) {
  const desktop = document.querySelector(selector);
  const mobileSelector = selector.replace('#ctrls', '#md-ctrls').replace('#distorts', '#md-distorts');
  const mobile = document.querySelector(mobileSelector);
  return desktop || mobile;
}

// Helper function to query all selectors (both desktop and mobile)
function querySelectorAllDual(selector) {
  const elements = [];
  const desktop = document.querySelectorAll(selector);
  const mobileSelector = selector.replace('#ctrls', '#md-ctrls').replace('#distorts', '#md-distorts');
  const mobile = document.querySelectorAll(mobileSelector);
  elements.push(...desktop, ...mobile);
  return elements;
}

// Helper function to get the active input that has content
function getActiveInput() {
  const nameInputs = getAllElements('name-input');
  
  // Find which input has content
  for (const input of nameInputs) {
    if (input && input.value) {
      return input;
    }
  }
  
  // If no input has content, return the first available input
  return nameInputs.length > 0 ? nameInputs[0] : null;
}

let loadedFont = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let isAudioEnabled = false;
let animationFrame = null;

// Mouse tracking variables
let mouseX = 0;
let mouseY = 0;
let isMouseTracking = false;
let mouseAnimationFrame = null;

// Audio reactive variables
const baseHeights = {
  bar: [600, 538, 477, 415, 354, 292, 231],
  wave: [200, 267, 333, 400, 467, 533, 600, 533, 467, 400, 333, 267, 200],
  arc: [600, 533, 467, 400, 333, 267, 200, 267, 333, 400, 467, 533, 600]
};

// Get current sensitivity from slider (1-5, where 5 = highest sensitivity)
function getSensitivity() {
  // Check if we're on mobile
  const isMobile = window.innerWidth <= 768;
  
  let activeBits = [];
  
  if (isMobile) {
    // For mobile, look specifically in the mobile nav
    activeBits = document.querySelectorAll('#mobile-nav .range-bits.active');
    
    // If mobile nav isn't found, try the general approach
    if (activeBits.length === 0) {
      activeBits = document.querySelectorAll('.range-bits.active');
    }
  } else {
    // For desktop, look specifically in the desktop nav
    activeBits = document.querySelectorAll('#desktop-nav .range-bits.active');
    
    // If desktop nav isn't found, try the general approach
    if (activeBits.length === 0) {
      activeBits = document.querySelectorAll('.range-bits.active');
    }
  }
  
  const sensitivity = activeBits.length; // 1-5 scale
  return sensitivity === 0 ? 3 : sensitivity; // Default to middle sensitivity if none found
}

// Calculate sensitivity multiplier (higher sensitivity = lower threshold needed)
function getSensitivityMultiplier() {
  const sensitivity = getSensitivity(); // 1-5
  // Convert to multiplier with reduced sensitivity: 1=1.5x, 2=2x, 3=2.5x, 4=3.5x, 5=5x
  const multipliers = [1.5, 2, 2.5, 3.5, 5];
  return multipliers[sensitivity - 1];
}

// Calculate responsive font size based on screen width
function getResponsiveFontSize() {
  const screenWidth = window.innerWidth;
  
  // Mobile devices: use smaller font size to prevent layout jumping
  if (screenWidth <= 768) {
    return 120; // Smaller font size for mobile
  }
  
  let fontSize = 200; // Base font size for desktop
  
  if (screenWidth > 1440) {
    // Scale font size for larger screens
    // Increase by 20% for every 400px above 1440px
    const extraWidth = screenWidth - 1440;
    const scaleFactor = 1 + (extraWidth / 400) * 0.2;
    fontSize = Math.round(200 * Math.min(scaleFactor, 2.5)); // Cap at 2.5x (500px)
  }
  
  return fontSize;
}

// Calculate text scale factor to fit within container
function calculateTextScale() {
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value : '';
  if (!text) return 1;
  
  const distortionPath = document.querySelector('.distortion-path');
  if (!distortionPath) return 1;
  
  // Get container width and subtract padding (24px on each side = 48px total)
  const containerWidth = distortionPath.getBoundingClientRect().width - 48;
  if (containerWidth <= 0) return 1;
  
  const fontSize = getResponsiveFontSize();
  let totalWidth = 0;
  
  // Calculate total width of all characters
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === ' ') {
      totalWidth += 40; // Space width
    } else {
      const glyph = loadedFont.charToGlyph(char);
      const bounds = glyph.getBoundingBox();
      const scale = fontSize / loadedFont.unitsPerEm;
      const naturalWidth = (bounds.x2 - bounds.x1) * scale;
      const paddedWidth = naturalWidth + 4; // Add padding
      totalWidth += paddedWidth;
    }
  }
  
  // Add gap space between characters (0.676px per gap)
  const gaps = Math.max(0, text.length - 1) * 0.676;
  totalWidth += gaps;
  
  // If text is wider than container, calculate scale factor
  if (totalWidth > containerWidth) {
    return containerWidth / totalWidth;
  }
  
  return 1; // No scaling needed
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired - Setting up div-based text distortion');
  
  // Use the locally provided WiseSans.otf font file
  const fontUrl = './Assets-root/WiseSans.otf';

  opentype.load(fontUrl, function(err, font) {
    if (err) {
      console.error('Font could not be loaded:', err);
      return;
    }
    
    console.log('Font loaded successfully:', font.familyName);
    loadedFont = font;
    
    // Set up input listener for both desktop and mobile
    const nameInputs = getAllElements('name-input');
    nameInputs.forEach((nameInput, index) => {
      if (nameInput) {
        nameInput.addEventListener('input', function() {
          // Clear other inputs when typing in one
          nameInputs.forEach((otherInput, otherIndex) => {
            if (otherIndex !== index && otherInput) {
              otherInput.value = '';
              // Hide other clear buttons
              const clearBtns = getAllElements('clearbtn');
              if (clearBtns[otherIndex]) {
                clearBtns[otherIndex].style.display = 'none';
              }
            }
          });
          
          updateTextDistortion();
        });
        
        // Initial render if there's already text
        if (nameInput.value) {
          updateTextDistortion();
        }
      }
    });
    
    // Initialize mouse tracking
    setupMouseTracking();
    
    // Initialize bottom sheet for mobile navigation
    initBottomSheet();
    
    // Check if touch mode is active by default and start mouse tracking
    const touchButtons = getAllElements('touch');
    const touchButton = touchButtons.find(btn => btn && btn.classList.contains('active'));
    if (touchButton) {
      isMouseTracking = true;
    }
  });
  
    // Add window resize listener for responsive font scaling
  window.addEventListener('resize', () => {
    if (loadedFont) {
      const nameInput = getActiveInput();
      const text = nameInput ? nameInput.value : '';
      if (text) {
        updateTextDistortion();
      }
    }
  });
});

// Function to update text distortion based on input
function updateTextDistortion() {
  if (!loadedFont) return;
  
  // Get the input that actually has content
  const nameInputs = getAllElements('name-input');
  let activeInput = null;
  let text = '';
  
  // Find which input has content
  for (const input of nameInputs) {
    if (input && input.value) {
      activeInput = input;
      text = input.value.toUpperCase();
      break;
    }
  }
  
  // If no input has content, check for any input (for clearing)
  if (!activeInput && nameInputs.length > 0) {
    activeInput = nameInputs[0];
    text = activeInput ? activeInput.value.toUpperCase() : '';
  }
  
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  
  // Clear all divs first and reset properties
  distortionEffects.forEach(div => {
    div.innerHTML = '';
    div.style.height = '0px';
    div.style.width = '0px';
    div.style.flex = '0 0 0px'; // Don't grow, don't shrink, no base size
    div.style.minWidth = '0px';
    div.style.maxWidth = 'none';
  });
  
  if (text.length === 0) return;
  
  // Calculate text scale to fit container
  const textScale = calculateTextScale(text);
  
  // Apply scaled gap to distortion-path to eliminate spacing issues
  if (distortionPath) {
    const scaledGap = 0.676 * textScale;
    distortionPath.style.gap = `${scaledGap}px`;
  }
  
  // Convert text to SVG paths and distribute across divs
  const fontSize = getResponsiveFontSize(); // Responsive font size based on screen width
  
  for (let i = 0; i < Math.min(text.length, distortionEffects.length); i++) {
    const char = text[i];
    const div = distortionEffects[i];
    
    if (char === ' ') {
      // Handle spaces - create a thin div with no content, also scaled
      div.style.height = `${fontSize}px`;
      const scaledSpaceWidth = 40 * textScale;
      div.style.width = `${scaledSpaceWidth}px`;
      div.style.flex = `0 0 ${scaledSpaceWidth}px`;
      continue;
    }
    
    // Get the glyph path for this character
    // Draw the glyph at baseline equal to fontSize for correct orientation
    const glyph = loadedFont.charToGlyph(char);
    const path = glyph.getPath(0, 0, fontSize);

    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Calculate natural width of the character with padding to prevent cutoff
    const bounds = glyph.getBoundingBox();
    const scale = fontSize / loadedFont.unitsPerEm;
    const naturalWidth = (bounds.x2 - bounds.x1) * scale;
    const paddedWidth = naturalWidth + 4; // Add 4px padding to prevent cutoff

    // Apply scaling to the div width to prevent container expansion
    const scaledWidth = paddedWidth * textScale;

    // Set div to scaled character width
    div.style.width = `${scaledWidth}px`;
    div.style.flex = `0 0 ${scaledWidth}px`;

    // Set up SVG with proper top alignment - adjust viewBox to position text at top
    svg.setAttribute('viewBox', `0 -${fontSize * 0.71} ${paddedWidth} ${fontSize}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.display = 'block';
    
    // Don't scale SVG - let it fill the scaled div completely

    // Set up the path with correct positioning
    pathElement.setAttribute('d', path.toPathData());
    pathElement.setAttribute('fill', '#404040');
    
    svg.appendChild(pathElement);
    div.appendChild(svg);
    
    // Set initial height to font size
    div.style.height = `${fontSize}px`;
  }
  
  // Apply current distortion if bar is active - but only if audio is active
  // Text starts at default height, distortions only activate with sound
  const barButtons = getAllElements('bar');
  const soundButtons = getAllElements('sound');
  const barButton = barButtons.find(btn => btn);
  const soundButton = soundButtons.find(btn => btn);
  if (barButton && barButton.classList.contains('active') && 
      soundButton && soundButton.classList.contains('active') && isAudioEnabled) {
    // Don't apply static distortion, wait for audio input
    startAudioAnalysis();
  }
}

// Function to update SVG viewBox based on div height for consistent baseline
function updateViewBoxForBaseline(div, svg, paddedWidth, fontSize) {
    const viewBoxHeight = fontSize;
    const hasWaveEffect = div.classList.contains('wave-effect');
    const hasArcEffect = div.classList.contains('arc-effect');
    let yOffset;

    if (hasWaveEffect) {
        // Wave effect: center baseline via standard offset
        yOffset = fontSize * 0.71;
    } else if (hasArcEffect) {
        // Arc effect: flush baseline to bottom of viewBox (lift slightly to avoid cutoff)
        yOffset = fontSize * 0.985; // lift baseline up 1% of fontSize to prevent clipping
    } else {
        // Bar effect: use standard baseline offset
        yOffset = fontSize * 0.71;
    }

    svg.setAttribute('viewBox', `0 -${yOffset} ${paddedWidth} ${viewBoxHeight}`);
}

// Audio setup and analysis functions
async function setupAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    microphone.connect(analyser);
    isAudioEnabled = true;
    
    console.log('Audio setup successful');
    startAudioAnalysis();
  } catch (err) {
    console.error('Error accessing microphone:', err);
    isAudioEnabled = false;
  }
}

function getAudioData() {
  if (!isAudioEnabled || !analyser) return { volume: 0, frequencies: [] };
  
  analyser.getByteFrequencyData(dataArray);
  
  // Calculate volume (average of all frequencies)
  const volume = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length / 255;
  
  // Get frequency bands for different distortion patterns
  const frequencies = [];
  const bandSize = Math.floor(dataArray.length / 14); // 14 divs
  
  for (let i = 0; i < 14; i++) {
    const start = i * bandSize;
    const end = Math.min(start + bandSize, dataArray.length);
    const bandAverage = dataArray.slice(start, end).reduce((sum, val) => sum + val, 0) / (end - start) / 255;
    frequencies.push(bandAverage);
  }
  
  return { volume, frequencies };
}

function startAudioAnalysis() {
  if (!isAudioEnabled) return;
  
  // Don't start audio analysis if touch mode is active
  const touchButtons = getAllElements('touch');
  const touchButton = touchButtons.find(btn => btn && btn.classList.contains('active'));
  if (touchButton) {
    return;
  }
  
  function analyze() {
    const audioData = getAudioData();
    updateDistortionWithAudio(audioData);
    animationFrame = requestAnimationFrame(analyze);
  }
  
  analyze();
}

function stopAudioAnalysis() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function updateDistortionWithAudio(audioData) {
  const activeButton = querySelectorDual('#distorts .ctrls-btn.active');
  if (!activeButton) return;
  
  const distortionType = activeButton.id.replace('md-', ''); // Handle both desktop and mobile IDs
  const { volume, frequencies } = audioData;
  
  // Apply audio-reactive distortion based on active effect
  if (distortionType === 'bar') {
    applyAudioReactiveBar(volume, frequencies);
  } else if (distortionType === 'wave') {
    applyAudioReactiveWave(volume, frequencies);
  } else if (distortionType === 'arc') {
    applyAudioReactiveArc(volume, frequencies);
  }
}

// Mouse tracking functions
function setupMouseTracking() {
  const resultContainer = document.querySelector('.result-container');
  if (!resultContainer) return;
  
  // Check if device has touch capability (but don't exclude mouse support)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Always set up mouse events for devices that support them
  resultContainer.addEventListener('mousemove', (e) => {
    if (!isMouseTracking) return;
    const rect = resultContainer.getBoundingClientRect();
    // Normalize mouse position to 0-1 range
    mouseX = (e.clientX - rect.left) / rect.width;
    mouseY = (e.clientY - rect.top) / rect.height;
    // Clamp values
    mouseX = Math.max(0, Math.min(1, mouseX));
    mouseY = Math.max(0, Math.min(1, mouseY));
  });
  
  // Activate tracking on mouse enter
  resultContainer.addEventListener('mouseenter', () => {
    const touchBtn = getElement('touch');
    if (!touchBtn || !touchBtn.classList.contains('active')) return;
    isMouseTracking = true;
    startMouseDistortion();
  });
  
  resultContainer.addEventListener('mouseleave', () => {
    isMouseTracking = false;
    stopMouseDistortion();
    resetToDefaultHeight();
  });
  
  // If device supports touch, also add touch events
  if (hasTouch) {
    resultContainer.addEventListener('touchmove', (e) => {
      if (!isMouseTracking) return;
      const touch = e.touches[0];
      const rect = resultContainer.getBoundingClientRect();
      mouseX = (touch.clientX - rect.left) / rect.width;
      mouseY = (touch.clientY - rect.top) / rect.height;
      mouseX = Math.max(0, Math.min(1, mouseX));
      mouseY = Math.max(0, Math.min(1, mouseY));
      e.preventDefault();
    }, { passive: false });
    
    // Start tracking on touch start
    resultContainer.addEventListener('touchstart', (e) => {
      const touchBtn = getElement('touch');
      if (!touchBtn || !touchBtn.classList.contains('active')) return;
      isMouseTracking = true;
      
      // Set initial position
      const touch = e.touches[0];
      const rect = resultContainer.getBoundingClientRect();
      mouseX = (touch.clientX - rect.left) / rect.width;
      mouseY = (touch.clientY - rect.top) / rect.height;
      mouseX = Math.max(0, Math.min(1, mouseX));
      mouseY = Math.max(0, Math.min(1, mouseY));
      
      startMouseDistortion();
      e.preventDefault();
    }, { passive: false });
    
    // Stop tracking on touch end
    resultContainer.addEventListener('touchend', () => {
      isMouseTracking = false;
      stopMouseDistortion();
      resetToDefaultHeight();
    });
  }
}

function startMouseDistortion() {
  if (!isMouseTracking) return;
  
  function updateMouse() {
    updateDistortionWithMouse();
    mouseAnimationFrame = requestAnimationFrame(updateMouse);
  }
  
  updateMouse();
}

function stopMouseDistortion() {
  if (mouseAnimationFrame) {
    cancelAnimationFrame(mouseAnimationFrame);
    mouseAnimationFrame = null;
  }
}

function updateDistortionWithMouse() {
  const activeButton = querySelectorDual('#distorts .ctrls-btn.active');
  if (!activeButton) return;
  
  const distortionType = activeButton.id.replace('md-', ''); // Handle both desktop and mobile IDs
  
  // Apply mouse-reactive distortion based on active effect
  if (distortionType === 'bar') {
    applyMouseReactiveBar();
  } else if (distortionType === 'wave') {
    applyMouseReactiveWave();
  } else if (distortionType === 'arc') {
    applyMouseReactiveArc();
  }
}

// Mouse-reactive distortion functions
function applyMouseReactiveBar() {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set bar alignment classes
  distortionPath.classList.remove('wave-alignment', 'arc-alignment');
  distortionPath.classList.add('bar-alignment');
  
  // Get sensitivity multiplier
  const sensitivityMultiplier = getSensitivityMultiplier();
  
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Remove other effect classes
    div.classList.remove('wave-effect', 'arc-effect');
    
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      continue;
    }
    
    // Bar effect: left-to-right progression affected by mouseX
    const positionFactor = i / Math.max(letterCount - 1, 1); // 0 to 1
    const mouseInfluence = Math.abs(mouseX - positionFactor); // Distance from mouse X position
    const heightFactor = (1 - mouseInfluence) * mouseY; // Combine X distance with Y position
    
    const baseHeight = getResponsiveFontSize(); // Use responsive font size as base height
    const maxMultiplier = 1 + (sensitivityMultiplier * 0.5); // Scale down for mouse
    const mouseMultiplier = 1 + (heightFactor * (maxMultiplier - 1));
    
    const newHeight = Math.max(baseHeight, baseHeight * mouseMultiplier); // Never go below base height
    div.style.height = `${Math.round(newHeight)}px`;
    
    // Update viewBox
    updateAudioViewBox(div, text[i]);
  }
}

function applyMouseReactiveWave() {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set wave alignment classes
  distortionPath.classList.remove('bar-alignment', 'arc-alignment');
  distortionPath.classList.add('wave-alignment');
  
  // Get sensitivity multiplier
  const sensitivityMultiplier = getSensitivityMultiplier();
  
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Add wave effect class
    div.classList.remove('arc-effect');
    div.classList.add('wave-effect');
    
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      continue;
    }
    
    // Wave effect: center-out pattern affected by mouse position
    const midPoint = letterCount / 2;
    const positionFactor = i / Math.max(letterCount - 1, 1);
    const distanceFromCenter = Math.abs(positionFactor - 0.5) * 2; // 0 to 1
    const mouseInfluence = 1 - Math.abs(mouseX - positionFactor);
    const heightFactor = mouseInfluence * mouseY * (1 - distanceFromCenter * 0.5);
    
    const baseHeight = getResponsiveFontSize(); // Use responsive font size as base height
    const maxMultiplier = 1 + (sensitivityMultiplier * 0.5);
    const mouseMultiplier = 1 + (heightFactor * (maxMultiplier - 1));
    
    const newHeight = Math.max(baseHeight, baseHeight * mouseMultiplier); // Never go below base height
    div.style.height = `${Math.round(newHeight)}px`;
    
    // Update viewBox
    updateAudioViewBox(div, text[i]);
  }
}

function applyMouseReactiveArc() {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set arc alignment classes
  distortionPath.classList.remove('bar-alignment', 'wave-alignment');
  distortionPath.classList.add('arc-alignment');
  
  // Get sensitivity multiplier
  const sensitivityMultiplier = getSensitivityMultiplier();
  
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Add arc effect class
    div.classList.remove('wave-effect');
    div.classList.add('arc-effect');
    
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      continue;
    }
    
    // Arc effect: edge-focused pattern affected by mouse position (inverted Y - up = more distortion)
    const positionFactor = i / Math.max(letterCount - 1, 1);
    const distanceFromEdge = Math.min(positionFactor, 1 - positionFactor) * 2; // 0 at edges, 1 at center
    const edgeFactor = 1 - distanceFromEdge; // 1 at edges, 0 at center
    const mouseInfluence = 1 - Math.abs(mouseX - positionFactor);
    const heightFactor = mouseInfluence * (1 - mouseY) * edgeFactor; // Inverted mouseY for upward distortion
    
    const baseHeight = getResponsiveFontSize(); // Use responsive font size as base height
    const maxMultiplier = 1 + (sensitivityMultiplier * 0.5);
    const mouseMultiplier = 1 + (heightFactor * (maxMultiplier - 1));
    
    const newHeight = Math.max(baseHeight, baseHeight * mouseMultiplier); // Never go below base height
    div.style.height = `${Math.round(newHeight)}px`;
    
    // Update viewBox
    updateAudioViewBox(div, text[i]);
  }
}

// Audio-reactive distortion functions
function applyAudioReactiveBar(volume, frequencies) {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set bar alignment classes
  distortionPath.classList.remove('wave-alignment', 'arc-alignment');
  distortionPath.classList.add('bar-alignment');
  
  // Get sensitivity multiplier
  const sensitivityMultiplier = getSensitivityMultiplier();
  
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Remove other effect classes (bar uses default CSS)
    div.classList.remove('wave-effect', 'arc-effect');
    
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      continue;
    }
    
    // Bar effect: center-out pattern - start from left, highest impact on first chars
    const centerImpact = Math.max(0.2, 1 - (i / 14)); // Extend impact to all 14 divs with minimum 0.2 impact
    const baseHeight = getResponsiveFontSize(); // Use responsive font size as base height
    
    // Apply sensitivity: higher sensitivity = more responsive to quiet sounds
    const adjustedVolume = Math.min(volume * sensitivityMultiplier, 1);
    const audioMultiplier = 1 + (adjustedVolume * centerImpact * 2.5); // Increased multiplier for better effect
    
    const newHeight = Math.max(baseHeight, baseHeight * audioMultiplier); // Never go below base height
    div.style.height = `${Math.round(newHeight)}px`;
    
    // Update viewBox
    updateAudioViewBox(div, text[i]);
  }
}

function applyAudioReactiveWave(volume, frequencies) {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set wave alignment classes
  distortionPath.classList.remove('bar-alignment', 'arc-alignment');
  distortionPath.classList.add('wave-alignment');
  
  // Get sensitivity multiplier
  const sensitivityMultiplier = getSensitivityMultiplier();
  
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Add wave effect class for centered vertical alignment
    div.classList.remove('arc-effect');
    div.classList.add('wave-effect');
    
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      continue;
    }
    
    // Wave effect: center-out pattern - highest impact in middle
    const midPoint = Math.floor(letterCount / 2);
    const distanceFromCenter = Math.abs(i - midPoint);
    const centerImpact = Math.max(0, 1 - (distanceFromCenter / 7)); // Stronger in center
    
    const baseHeight = getResponsiveFontSize(); // Use responsive font size as base height
    
    // Apply sensitivity: higher sensitivity = more responsive to quiet sounds
    const adjustedVolume = Math.min(volume * sensitivityMultiplier, 1);
    const audioMultiplier = 1 + (adjustedVolume * centerImpact * 2);
    
    const newHeight = Math.max(baseHeight, baseHeight * audioMultiplier); // Never go below base height
    div.style.height = `${Math.round(newHeight)}px`;
    
    // Update viewBox
    updateAudioViewBox(div, text[i]);
  }
}

function applyAudioReactiveArc(volume, frequencies) {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set arc alignment classes
  distortionPath.classList.remove('bar-alignment', 'wave-alignment');
  distortionPath.classList.add('arc-alignment');
  
  // Get sensitivity multiplier
  const sensitivityMultiplier = getSensitivityMultiplier();
  
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Add arc effect class for bottom alignment
    div.classList.remove('wave-effect');
    div.classList.add('arc-effect');
    
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      continue;
    }
    
    // Arc effect: center-out pattern - starts high on edges, low in center
    const midPoint = Math.floor(letterCount / 2);
    const distanceFromCenter = Math.abs(i - midPoint);
    const edgeImpact = distanceFromCenter / 7; // Stronger on edges
    
    const baseHeight = getResponsiveFontSize(); // Use responsive font size as base height
    
    // Apply sensitivity: higher sensitivity = more responsive to quiet sounds
    const adjustedVolume = Math.min(volume * sensitivityMultiplier, 1);
    const audioMultiplier = 1 + (adjustedVolume * edgeImpact * 2);
    
    const newHeight = Math.max(baseHeight, baseHeight * audioMultiplier); // Never go below base height
    div.style.height = `${Math.round(newHeight)}px`;
    
    // Update viewBox
    updateAudioViewBox(div, text[i]);
  }
}

function updateAudioViewBox(div, char) {
  const svg = div.querySelector('svg');
  if (svg && loadedFont) {
    const fontSize = getResponsiveFontSize();
    const bounds = loadedFont.charToGlyph(char).getBoundingBox();
    const scale = fontSize / loadedFont.unitsPerEm;
    const naturalWidth = (bounds.x2 - bounds.x1) * scale;
    const paddedWidth = naturalWidth + 4;
    updateViewBoxForBaseline(div, svg, paddedWidth, fontSize);
    
    // Maintain text scaling on SVG
    const nameInput = getActiveInput();
    const text = nameInput ? nameInput.value.toUpperCase() : '';
    const textScale = calculateTextScale(text);
    // Remove SVG scaling - div scaling handles it
    svg.style.transform = '';
    svg.style.transformOrigin = '';
  }
}

// Handle distortion type controls
querySelectorAllDual('#distorts .ctrls-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    querySelectorAllDual('#distorts .ctrls-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    
    // Stop audio analysis when switching effects
    stopAudioAnalysis();
    
    // Reset to default height and set proper alignment classes
    resetToDefaultHeight();
    
    // Only start audio analysis if sound mode is active and audio is enabled
    const soundButton = getElement('sound');
    if (soundButton && soundButton.classList.contains('active') && isAudioEnabled) {
      startAudioAnalysis();
    }
  });
});

// Handle sound/touch controls
querySelectorAllDual('#ctrls .ctrls-btn').forEach(btn => {
  btn.addEventListener('click', async function() {
    querySelectorAllDual('#ctrls .ctrls-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    
    const buttonType = this.id.replace('md-', ''); // Handle both desktop and mobile IDs
    
    if (buttonType === 'sound') {
      // Enable audio-reactive mode: stop mouse tracking
      stopMouseDistortion();
      isMouseTracking = false;
      resetToDefaultHeight();
      
      if (!isAudioEnabled) {
        await setupAudio();
      }
      if (isAudioEnabled) {
        startAudioAnalysis();
      }
    } else if (buttonType === 'touch') {
      // Enable touch-reactive mode
      stopAudioAnalysis(); // Stop audio analysis first
      isMouseTracking = true;
      
      // Reset to default height to clear any audio effects
      resetToDefaultHeight();
      
      // Check if mouse is over the result container (for devices with mouse support)
      const resultContainer = document.querySelector('.result-container');
      if (resultContainer && event.clientX !== undefined) {
        // Only check mouse position if the event has mouse coordinates
        const rect = resultContainer.getBoundingClientRect();
        const mouseOverContainer = 
          event.clientX >= rect.left && 
          event.clientX <= rect.right && 
          event.clientY >= rect.top && 
          event.clientY <= rect.bottom;
          
        if (mouseOverContainer) {
          startMouseDistortion();
        } else {
          resetToDefaultHeight();
        }
      }
      // For touch devices or when mouse position is unknown, distortion will start when user interacts with the area
    }
  });
});

// Function to reset all divs to default height
function resetToDefaultHeight() {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  
  // Set appropriate alignment class but keep default heights
  distortionPath.classList.remove('wave-alignment', 'arc-alignment', 'bar-alignment');
  const activeDistortion = querySelectorDual('#distorts .ctrls-btn.active');
  if (activeDistortion) {
    const distortionType = activeDistortion.id.replace('md-', ''); // Handle both desktop and mobile IDs
    if (distortionType === 'wave') {
      distortionPath.classList.add('wave-alignment');
    } else if (distortionType === 'arc') {
      distortionPath.classList.add('arc-alignment');
    } else {
      distortionPath.classList.add('bar-alignment');
    }
  }
  
  // Recalculate text scale and apply to SVGs
  const textScale = calculateTextScale(text);
  
  // Apply scaled gap to distortion-path
  if (distortionPath) {
    const scaledGap = 0.676 * textScale;
    distortionPath.style.gap = `${scaledGap}px`;
  }
  
  distortionEffects.forEach((div, i) => {
    // Remove effect classes
    div.classList.remove('wave-effect', 'arc-effect');
    
    if (i < text.length && div.innerHTML) {
      const fontSize = getResponsiveFontSize();
      div.style.height = `${fontSize}px`; // Use responsive font size
      
      // Apply scaling to SVG if it exists
      const svg = div.querySelector('svg');
      if (svg) {
        // Remove any transform scaling - div scaling handles it
        svg.style.transform = '';
        svg.style.transformOrigin = '';
      }
    } else {
      div.style.height = '0px';
    }
    div.style.transition = 'height 0.1s ease-in-out';
  });
}

// Bar distortion effect function
function applyBarDistortion() {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set bar alignment
  distortionPath.classList.remove('wave-alignment', 'arc-alignment');
  distortionPath.classList.add('bar-alignment');
  
  // Apply heights based on number of letters
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Remove effect classes for bar distortion
    div.classList.remove('wave-effect', 'arc-effect');
    
    // Empty divs go to 0px
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      div.style.transition = 'height 0.1s ease-in-out';
      continue;
    }
    
    let height;
    const fontSize = getResponsiveFontSize();
    const scaleFactor = fontSize / 200; // Scale relative to base 200px
    
    if (letterCount <= 8) {
      // For 8 or fewer letters, distribute across the first letterCount divs
      // Linear reduction from 600px to 330px over letterCount-1 intervals (scaled)
      if (letterCount === 1) {
        height = 600 * scaleFactor; // Single letter gets max height
      } else {
        const step = (270 * scaleFactor) / (letterCount - 1); // Scaled reduction
        height = (600 * scaleFactor) - (step * i);
      }
    } else {
      // For more than 8 letters, use the original pattern (scaled)
      if (i < 8) {
        // Divs 1-8: reduce from 600 to 330px (scaled)
        const step = (270 * scaleFactor) / 7; // Scaled step
        height = (600 * scaleFactor) - (step * i);
      } else {
        // Divs 9-14: reduce from 330 to 200px (scaled)
        const step = (130 * scaleFactor) / 5; // Scaled step
        height = (330 * scaleFactor) - (step * (i - 8));
      }
    }
    
    div.style.height = `${Math.round(height)}px`;
    div.style.transition = 'height 0.1s ease-in-out';
    
    // Update viewBox for consistent baseline
    const svg = div.querySelector('svg');
    if (svg) {
      const fontSize = getResponsiveFontSize();
      const bounds = loadedFont.charToGlyph(text[i]).getBoundingBox();
      const scale = fontSize / loadedFont.unitsPerEm;
      const naturalWidth = (bounds.x2 - bounds.x1) * scale;
      const paddedWidth = naturalWidth + 4;
      updateViewBoxForBaseline(div, svg, paddedWidth, fontSize);
    }
  }
}

// Wave distortion effect function
function applyWaveDistortion() {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set wave alignment
  distortionPath.classList.remove('bar-alignment', 'arc-alignment');
  distortionPath.classList.add('wave-alignment');
  
  // Apply wave pattern heights
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Add wave effect class for centered vertical alignment
    if (i < letterCount && div.innerHTML) {
      div.classList.remove('arc-effect');
      div.classList.add('wave-effect');
    }
    
    // Empty divs go to 0px
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      div.style.transition = 'height 0.1s ease-in-out';
      continue;
    }
    
    let height;
    const fontSize = getResponsiveFontSize();
    const scaleFactor = fontSize / 200; // Scale relative to base 200px
    
    if (letterCount <= 14) {
      // For letters that fit within 14 divs, create wave pattern
      const midPoint = Math.floor(letterCount / 2);
      
      if (i < midPoint) {
        // First half: increase from 200px to 600px (scaled)
        const step = (400 * scaleFactor) / (midPoint === 0 ? 1 : midPoint);
        height = (200 * scaleFactor) + (step * i);
      } else {
        // Second half: decrease from 600px to 200px (scaled)
        const step = (400 * scaleFactor) / (letterCount - midPoint - 1 === 0 ? 1 : letterCount - midPoint - 1);
        height = (600 * scaleFactor) - (step * (i - midPoint));
      }
      
      // Ensure minimum height of 200px (scaled)
      height = Math.max(200 * scaleFactor, height);
    } else {
      // For more than 14 letters, use fixed pattern (scaled)
      if (i < 7) {
        // Divs 1-7: increase from 200px to 600px (scaled)
        const step = (400 * scaleFactor) / 6;
        height = (200 * scaleFactor) + (step * i);
      } else {
        // Divs 8-14: decrease from 600px to 200px (scaled)
        const step = (400 * scaleFactor) / 6;
        height = (600 * scaleFactor) - (step * (i - 7));
      }
    }
    
    div.style.height = `${Math.round(height)}px`;
    div.style.transition = 'height 0.1s ease-in-out';
    
    // Update viewBox for consistent baseline
    const svg = div.querySelector('svg');
    if (svg) {
      const fontSize = getResponsiveFontSize();
      const bounds = loadedFont.charToGlyph(text[i]).getBoundingBox();
      const scale = fontSize / loadedFont.unitsPerEm;
      const naturalWidth = (bounds.x2 - bounds.x1) * scale;
      const paddedWidth = naturalWidth + 4;
      updateViewBoxForBaseline(div, svg, paddedWidth, fontSize);
    }
  }
}

// Arc distortion effect function
function applyArcDistortion() {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = getActiveInput();
  const text = nameInput ? nameInput.value.toUpperCase() : '';
  const letterCount = text.length;
  
  // Set arc alignment
  distortionPath.classList.remove('bar-alignment', 'wave-alignment');
  distortionPath.classList.add('arc-alignment');
  
  // Apply arc pattern heights
  for (let i = 0; i < distortionEffects.length; i++) {
    const div = distortionEffects[i];
    
    // Add arc effect class for top-aligned growth
    if (i < letterCount && div.innerHTML) {
      div.classList.remove('wave-effect');
      div.classList.add('arc-effect');
    }
    
    // Empty divs go to 0px
    if (i >= letterCount || !div.innerHTML) {
      div.style.height = '0px';
      div.style.transition = 'height 0.1s ease-in-out';
      continue;
    }
    
    let height;
    const fontSize = getResponsiveFontSize();
    const scaleFactor = fontSize / 200; // Scale relative to base 200px
    
    if (letterCount <= 14) {
      // For letters that fit within 14 divs, create arc pattern
      const midPoint = Math.floor(letterCount / 2);
      
      if (i < midPoint) {
        // First half: decrease from 600px to 200px (scaled)
        const step = (400 * scaleFactor) / (midPoint === 0 ? 1 : midPoint);
        height = (600 * scaleFactor) - (step * i);
      } else {
        // Second half: increase from 200px to 600px (scaled)
        const step = (400 * scaleFactor) / (letterCount - midPoint - 1 === 0 ? 1 : letterCount - midPoint - 1);
        height = (200 * scaleFactor) + (step * (i - midPoint));
      }
      
      // Ensure minimum height of 200px and maximum of 600px (scaled)
      height = Math.max(200 * scaleFactor, Math.min(600 * scaleFactor, height));
    } else {
      // For more than 14 letters, use fixed pattern (scaled)
      if (i < 7) {
        // Divs 1-7: decrease from 600px to 200px (scaled)
        const step = (400 * scaleFactor) / 6;
        height = (600 * scaleFactor) - (step * i);
      } else {
        // Divs 8-14: increase from 200px to 600px (scaled)
        const step = (400 * scaleFactor) / 6;
        height = (200 * scaleFactor) + (step * (i - 7));
      }
    }
    
    div.style.height = `${Math.round(height)}px`;
    div.style.transition = 'height 0.1s ease-in-out';
    
    // Update viewBox for consistent baseline
    const svg = div.querySelector('svg');
    if (svg) {
      const fontSize = getResponsiveFontSize();
      const bounds = loadedFont.charToGlyph(text[i]).getBoundingBox();
      const scale = fontSize / loadedFont.unitsPerEm;
      const naturalWidth = (bounds.x2 - bounds.x1) * scale;
      const paddedWidth = naturalWidth + 4;
      updateViewBoxForBaseline(div, svg, paddedWidth, fontSize);
    }
  }
}

// This script handles the clear button functionality for the input field
// It shows the clear button when there is text in the input field
// and hides it when the input is empty.
// The clear button clears the input field and hides itself when clicked
// It also focuses back on the input field after clearing
document.addEventListener('DOMContentLoaded', function() {
  // Set up both desktop and mobile input/clear button pairs
  getAllElements('name-input').forEach((input, index) => {
    const clearBtns = getAllElements('clearbtn');
    const clearBtn = clearBtns[index];
    
    if (!input || !clearBtn) return;

    // Hide clear button initially
    clearBtn.style.display = 'none';

    // Show/hide clear button on input
    input.addEventListener('input', function() {
      clearBtn.style.display = input.value.length > 0 ? 'flex' : 'none';
    });

    // Clear input and hide button on click
    clearBtn.addEventListener('click', function() {
      // Clear all inputs and hide all clear buttons
      getAllElements('name-input').forEach(inp => {
        if (inp) inp.value = '';
      });
      getAllElements('clearbtn').forEach(btn => {
        if (btn) btn.style.display = 'none';
      });
      
      input.focus();
      
      // Clear all distortion effect divs
      const distortionEffects = document.querySelectorAll('.distortion-effect');
      distortionEffects.forEach(div => {
        div.innerHTML = '';
        div.style.height = '0px';
        div.style.width = '0px';
        div.style.flex = '0 0 0px';
        div.style.minWidth = '0px';
        div.style.maxWidth = 'none';
      });
      
      // Stop any ongoing audio or mouse analysis
      stopAudioAnalysis();
    });
  });
});

// Slider functionality for custom range input
// This script allows users to drag a thumb along a slider to select a value
// and visually fills the slider based on the selected value.
// It also allows clicking on specific bits to set the value directly.
// The slider has 5 bits, each representing a value from 1 to 5.
// The thumb can be dragged or clicked to change the value, and the fill adjusts accordingly.
// The slider is styled to look like a custom range input with a thumb and fill.
// The bits are highlighted based on the current value, and the thumb's position is updated accordingly
document.addEventListener('DOMContentLoaded', function() {
  // Set up both desktop and mobile sliders
  getAllElements('custom-slider').forEach((slider, index) => {
    const thumbs = getAllElements('slider-thumb');
    const thumb = thumbs[index];
    
    if (!slider || !thumb) return;
    
    const fill = slider.querySelector('.range-fill');
    const bits = slider.closest('section').querySelectorAll('.range-bits');
    let dragging = false;
    let value = 3; // default value

    function setThumbPosition(val) {
      const min = 1, max = 5;
      const targetBit = bits[val - 1];
      if (targetBit) {
        const bitRect = targetBit.getBoundingClientRect();
        const sliderRect = slider.getBoundingClientRect();
        // Align thumb's left edge with bit's left edge
        const bitLeft = bitRect.left - sliderRect.left;
        thumb.style.left = `${bitLeft}px`;
        // Fill up to the right edge of the bit
        if (val === max) {
          fill.style.width = '100%';
        } else {
          fill.style.width = `${bitLeft + bitRect.width}px`;
        }
      }
      for (let i = 0; i < bits.length; i++) {
        bits[i].classList.toggle('active', i < val);
      }
    }

    thumb.addEventListener('mousedown', (e) => {
      dragging = true;
      document.body.style.userSelect = 'none';
    });
    
    // Add touch events for mobile support
    thumb.addEventListener('touchstart', (e) => {
      dragging = true;
      document.body.style.userSelect = 'none';
      e.preventDefault(); // Prevent scrolling
    }, { passive: false });
    
    document.addEventListener('mouseup', () => {
      dragging = false;
      document.body.style.userSelect = '';
    });
    
    document.addEventListener('touchend', () => {
      dragging = false;
      document.body.style.userSelect = '';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = slider.getBoundingClientRect();
      let x = e.clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      const min = 1, max = 5;
      const val = Math.round((x / rect.width) * (max - min) + min);
      value = Math.max(min, Math.min(val, max));
      setThumbPosition(value);
    });
    
    // Add touch move support for mobile
    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const rect = slider.getBoundingClientRect();
      const touch = e.touches[0];
      let x = touch.clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      const min = 1, max = 5;
      const val = Math.round((x / rect.width) * (max - min) + min);
      value = Math.max(min, Math.min(val, max));
      setThumbPosition(value);
      e.preventDefault(); // Prevent scrolling
    }, { passive: false });

    // Click on bits to set value
    for (let i = 0; i < bits.length; i++) {
      bits[i].addEventListener('click', () => {
        value = i + 1;
        setThumbPosition(value);
      });
    }

    // Click on slider bar
    slider.addEventListener('click', (e) => {
      const rect = slider.getBoundingClientRect();
      let x = e.clientX - rect.left;
      const min = 1, max = 5;
      const val = Math.round((x / rect.width) * (max - min) + min);
      value = Math.max(min, Math.min(val, max));
      setThumbPosition(value);
    });
    
    // Add touch support for slider bar
    slider.addEventListener('touchstart', (e) => {
      if (e.target === thumb) return; // Don't interfere with thumb dragging
      const rect = slider.getBoundingClientRect();
      const touch = e.touches[0];
      let x = touch.clientX - rect.left;
      const min = 1, max = 5;
      const val = Math.round((x / rect.width) * (max - min) + min);
      value = Math.max(min, Math.min(val, max));
      setThumbPosition(value);
      e.preventDefault();
    }, { passive: false });

    // Initialize
    setThumbPosition(value);
  });
});

// Bottom sheet interaction for mobile navigation
function initBottomSheet() {
  const mobileNav = document.getElementById('mobile-nav');
  const navContainer = mobileNav?.querySelector('.nav-container');
  const inputContainer = mobileNav?.querySelector('#input-container');
  const controlsContainers = mobileNav?.querySelectorAll('.controls-container');
  const mobileGrabber = mobileNav?.querySelector('.mobile-grabber');
  
  if (!mobileNav || !navContainer || !inputContainer || !controlsContainers || controlsContainers.length === 0 || !mobileGrabber) return;
  
  let isDragging = false;
  let startY = 0;
  let currentY = 0;
  let dragStartTime = 0;
  let hasMovedEnough = false; // Track if user has moved enough to be considered "dragging"
  let isCollapsed = false;
  let lastFrameTime = 0;
  const frameDelay = 16; // ~60fps (16ms between frames)
  const DRAG_THRESHOLD = 15; // Minimum pixels to move before considering it a drag
  const COLLAPSE_THRESHOLD = 100; // Reduced from 120 for row layout (less height difference)
  const VELOCITY_THRESHOLD = 0.3; // Velocity threshold for quick gestures
  
  // Calculate initial heights for smooth interpolation
  let initialNavHeight = 0;
  let collapsedNavHeight = 0;
  
  // Measure heights on init and when needed
  function measureHeights() {
    // Store current visual state to prevent jumps
    const currentVisualHeight = navContainer.getBoundingClientRect().height;
    const shouldPreserveHeight = navContainer.style.height !== 'auto';
    
    // Temporarily ensure all containers are visible to get accurate measurements
    const originalStyles = [];
    controlsContainers.forEach((container, index) => {
      originalStyles[index] = {
        display: container.style.display,
        opacity: container.style.opacity,
        height: container.style.height,
        overflow: container.style.overflow
      };
      container.style.display = '';
      container.style.opacity = '1';
      container.style.height = 'auto';
      container.style.overflow = 'visible';
    });
    
    // Temporarily set height to auto to get natural height, but hide it to prevent flash
    const originalNavHeight = navContainer.style.height;
    const originalNavOverflow = navContainer.style.overflow;
    navContainer.style.height = 'auto';
    navContainer.style.overflow = 'hidden';
    navContainer.style.visibility = 'hidden';
    
    // Force layout calculation
    initialNavHeight = navContainer.getBoundingClientRect().height;
    
    // For collapsed height calculation, hide the mobile-controls container specifically
    // Since mobile-controls now uses row layout, hiding it provides meaningful height reduction
    const mobileControlsContainer = document.getElementById('mobile-controls');
    const originalMobileControlsDisplay = mobileControlsContainer?.style.display || '';
    
    // Hide mobile-controls (which contains both Controls and Distortion sections)
    if (mobileControlsContainer) {
      mobileControlsContainer.style.display = 'none';
    }
    
    // Also hide any other control containers except input
    controlsContainers.forEach(container => {
      if (container.contains(inputContainer)) return; // Keep input container
      if (container.id === 'mobile-controls') return; // Already handled above
      container.style.display = 'none';
    });
    
    collapsedNavHeight = navContainer.getBoundingClientRect().height;
    
    // Restore visibility and height immediately to prevent flash
    navContainer.style.visibility = 'visible';
    if (shouldPreserveHeight) {
      navContainer.style.height = `${currentVisualHeight}px`;
    } else {
      navContainer.style.height = originalNavHeight;
    }
    navContainer.style.overflow = originalNavOverflow;
    
    // Restore mobile-controls display
    if (mobileControlsContainer) {
      mobileControlsContainer.style.display = originalMobileControlsDisplay;
    }
    
    // Restore original styles for other containers
    controlsContainers.forEach((container, index) => {
      container.style.display = originalStyles[index].display;
      container.style.opacity = originalStyles[index].opacity;
      container.style.height = originalStyles[index].height;
      container.style.overflow = originalStyles[index].overflow;
    });
    
    // Log height difference for debugging (can be removed in production)
    const heightDifference = initialNavHeight - collapsedNavHeight;
    console.log(`Bottom sheet heights - Expanded: ${initialNavHeight}px, Collapsed: ${collapsedNavHeight}px, Difference: ${heightDifference}px`);
  }
  
  // Initial measurement
  measureHeights();
  
  // Debounced resize handler for better performance
  let resizeTimeout;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Store current state before measuring
      const wasCollapsed = isCollapsed;
      
      // Temporarily remove transitions to prevent jumping during resize
      navContainer.style.transition = 'none';
      controlsContainers.forEach(container => {
        container.style.transition = 'none';
      });
      
      measureHeights();
      
      // Immediately apply the correct state without transitions
      if (wasCollapsed) {
        updateNavHeight(1, true);
      } else {
        updateNavHeight(0, true);
      }
      
      // Re-enable transitions after a frame
      requestAnimationFrame(() => {
        navContainer.style.transition = '';
        controlsContainers.forEach(container => {
          container.style.transition = '';
        });
      });
    }, 150);
  }
  
  // Re-measure on window resize
  window.addEventListener('resize', handleResize);
  
  // Update result container height for real-time scaling
  function updateResultContainerHeight(dragProgress) {
    const resultContainer = document.querySelector('.result-container');
    if (!resultContainer) return;
    
    // Base height for mobile
    const baseHeight = window.innerWidth <= 599 ? 300 : 500;
    
    // Calculate additional height based on how much of the nav is hidden
    // Adjusted for row layout - less dramatic height changes but still noticeable
    const heightDifference = initialNavHeight - collapsedNavHeight;
    const extraHeight = dragProgress * Math.min(heightDifference * 0.8, 150); // Cap at 150px
    
    const newHeight = baseHeight + extraHeight;
    resultContainer.style.height = `${newHeight}px`;
    
    // Trigger redraw of distortion if active
    if (window.currentDistortionType && window.distortedFont) {
      requestAnimationFrame(() => {
        drawText(window.currentDistortionType);
      });
    }
  }
  
  // Smoothly update nav container height and control visibility
  function updateNavHeight(dragProgress, isFinalized = false) {
    // Use requestAnimationFrame for smoother updates
    if (!isFinalized) {
      requestAnimationFrame(() => applyHeightUpdate(dragProgress, isFinalized));
    } else {
      applyHeightUpdate(dragProgress, isFinalized);
    }
  }
  
  function applyHeightUpdate(dragProgress, isFinalized = false) {
    // Interpolate between initial and collapsed heights
    const heightDiff = initialNavHeight - collapsedNavHeight;
    const currentHeight = initialNavHeight - (heightDiff * dragProgress);
    
    // Apply height to nav container with smooth transition
    // Avoid jumping by never switching back to 'auto' - always use calculated height
    navContainer.style.height = `${currentHeight}px`;
    navContainer.style.overflow = dragProgress > 0 ? 'hidden' : 'visible';
    
    // Get the mobile-controls container specifically for row-layout handling
    const mobileControlsContainer = document.getElementById('mobile-controls');
    
    // Improved fade curve for more natural feel
    // Start fading when 20% dragged, fully hidden at 75% dragged
    let controlOpacity = 1;
    if (dragProgress > 0.2) {
      const fadeProgress = (dragProgress - 0.2) / 0.55; // 0.2 to 0.75 mapped to 0 to 1
      controlOpacity = Math.max(0, 1 - easeInQuart(fadeProgress));
    }
    
    // Apply opacity and transform adjustments to control containers (except input)
    controlsContainers.forEach(container => {
      if (container.contains(inputContainer)) {
        // Keep input container always visible and at full opacity
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
        container.style.maxHeight = 'none';
        container.style.overflow = 'visible';
        return;
      }
      
      // For mobile-controls container (row layout), apply special handling
      if (container.id === 'mobile-controls' || container === mobileControlsContainer) {
        container.style.opacity = controlOpacity;
        
        // Smooth translateY that follows an easing curve to prevent jumps
        const translateY = dragProgress * 10 * easeOutQuart(dragProgress);
        container.style.transform = `translateY(${translateY}px)`;
        
        // Keep containers unmasked with full visibility
        container.style.maxHeight = 'none';
        container.style.overflow = 'visible';
        return;
      }
      
      // For other containers, apply standard opacity fade with smooth transform reset
      container.style.opacity = controlOpacity;
      
      // Always keep containers unmasked with full visibility
      container.style.maxHeight = 'none';
      container.style.overflow = 'visible';
      
      // Ensure smooth transform reset
      container.style.transform = 'translateY(0)';
    });
    
    // Update result container height
    updateResultContainerHeight(dragProgress);
  }
  
  // Easing function for fade in
  function easeInQuart(t) {
    return t * t * t * t;
  }
  
  function getTouchY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }
  
  function handleDragStart(e) {
    // Prevent multiple simultaneous drags
    if (isDragging) return;
    
    // Don't start drag if the target is an input or button
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || 
        target.closest('#input-container') || target.closest('.controls-container')) {
      return;
    }
    
    // Prevent default to avoid conflicts
    e.preventDefault();
    
    isDragging = true;
    hasMovedEnough = false; // Reset movement tracking
    startY = getTouchY(e);
    currentY = startY;
    dragStartTime = performance.now(); // Track when drag started
    
    // Disable transitions and prevent text selection
    navContainer.style.transition = 'none';
    controlsContainers.forEach(container => {
      container.style.transition = 'none';
    });
    document.body.style.userSelect = 'none';
    
    // Clean up any existing listeners first (prevents duplicate listeners)
    cleanupEventListeners();
    
    // Attach move and end listeners to document for both mouse and touch
    if (e.type === 'mousedown') {
      document.addEventListener('mousemove', handleDragMove, { passive: false });
      document.addEventListener('mouseup', handleDragEnd, { passive: false });
      // Prevent context menu on long mouse press
      document.addEventListener('contextmenu', preventContextMenu, { passive: false });
    } else if (e.type === 'touchstart') {
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd, { passive: false });
      document.addEventListener('touchcancel', handleDragEnd, { passive: false });
    }
  }
  
  // Helper function to prevent context menu during drag
  function preventContextMenu(e) {
    if (isDragging) {
      e.preventDefault();
    }
  }
  
  // Clean up event listeners
  function cleanupEventListeners() {
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
    document.removeEventListener('touchcancel', handleDragEnd);
    document.removeEventListener('contextmenu', preventContextMenu);
  }
  
  function handleDragMove(e) {
    if (!isDragging) return;
    
    // Prevent default scroll/zoom behaviors
    e.preventDefault();
    
    currentY = getTouchY(e);
    const deltaY = currentY - startY;
    
    // Check if user has moved enough to be considered "dragging"
    if (!hasMovedEnough && Math.abs(deltaY) < DRAG_THRESHOLD) {
      return; // Don't start visual feedback until minimum movement
    }
    
    // User has moved enough, start visual feedback
    hasMovedEnough = true;
    
    // Throttle updates to ~60fps for smoother performance
    const now = performance.now();
    if (now - lastFrameTime < frameDelay) return;
    lastFrameTime = now;
    
    // Calculate drag progress (positive deltaY = dragging down = collapsing)
    const maxDragDistance = 200; // Reduced from 250 to account for smaller height difference in row layout
    let dragProgress = Math.max(0, Math.min(deltaY / maxDragDistance, 1)); // 0 to 1
    
    // Add subtle easing for more natural feel
    dragProgress = easeOutQuart(dragProgress);
    
    // Apply smooth height-based collapse
    updateNavHeight(dragProgress);
  }
  
  // Easing function for smoother animation
  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }
  
  function handleDragEnd(e) {
    if (!isDragging) return;
    
    // Prevent any default behaviors
    e.preventDefault();
    
    isDragging = false;
    const deltaY = currentY - startY;
    const dragDistance = Math.abs(deltaY);
    const dragDuration = performance.now() - dragStartTime;
    
    // If user didn't move enough, treat as a tap - don't change state
    if (!hasMovedEnough || dragDistance < DRAG_THRESHOLD) {
      // Reset visual state to current state without changing collapsed status
      if (isCollapsed) {
        updateNavHeight(1, true);
      } else {
        updateNavHeight(0, true);
      }
      
      // Re-enable interactions and clean up
      document.body.style.userSelect = '';
      cleanupEventListeners();
      return;
    }
    
    // Calculate velocity (pixels per millisecond)
    const velocity = dragDistance / Math.max(dragDuration, 1);
    
    // Add smooth transitions for final animation with better easing
    navContainer.style.transition = 'height 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    controlsContainers.forEach(container => {
      container.style.transition = 'opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), max-height 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    });
    
    // Determine final state based on drag distance and velocity
    // Adjusted thresholds for row layout (smaller height differences)
    const shouldCollapse = (deltaY > COLLAPSE_THRESHOLD) || 
                          (deltaY > 50 && velocity > VELOCITY_THRESHOLD); // Reduced from 60
    const shouldExpand = (deltaY < -COLLAPSE_THRESHOLD) || 
                        (deltaY < -50 && velocity > VELOCITY_THRESHOLD); // Reduced from -60
    
    if (shouldCollapse && !isCollapsed) {
      // Dragged down enough - collapse to show only input
      isCollapsed = true;
      mobileNav.classList.add('collapsed');
      updateNavHeight(1, true); // Fully collapsed and finalized
    } else if (shouldExpand && isCollapsed) {
      // Dragged up enough - expand to full height
      isCollapsed = false;
      mobileNav.classList.remove('collapsed');
      updateNavHeight(0, true); // Fully expanded and finalized
    } else {
      // Not dragged enough - return to current state
      if (isCollapsed) {
        updateNavHeight(1, true);
      } else {
        updateNavHeight(0, true);
      }
    }
    
    // Clean up transitions after animation completes
    setTimeout(() => {
      navContainer.style.transition = '';
      controlsContainers.forEach(container => {
        container.style.transition = '';
      });
      
      // Recalculate and set the correct height after transitions to prevent jumps
      // This ensures we maintain the proper height without layout shifts
      if (!isCollapsed) {
        // Force a height recalculation for expanded state
        const currentFullHeight = navContainer.getBoundingClientRect().height;
        navContainer.style.height = `${currentFullHeight}px`;
      } else {
        // Force a height recalculation for collapsed state
        const currentCollapsedHeight = navContainer.getBoundingClientRect().height;
        navContainer.style.height = `${currentCollapsedHeight}px`;
      }
    }, 400);
    
    // Re-enable interactions and clean up
    document.body.style.userSelect = '';
    cleanupEventListeners();
  }
  
  // Initialize drag listeners - use consistent passive: false for better control
  mobileNav.addEventListener('touchstart', handleDragStart, { passive: false });
  mobileNav.addEventListener('mousedown', handleDragStart);
  mobileGrabber.addEventListener('touchstart', handleDragStart, { passive: false });
  mobileGrabber.addEventListener('mousedown', handleDragStart);
  // Fallback: toggle collapse/expand on grabber click
  mobileGrabber.addEventListener('click', (e) => {
    // Prevent if this was part of a drag gesture or if user moved significantly
    if (hasMovedEnough || Math.abs(currentY - startY) > DRAG_THRESHOLD) return;
    
    e.preventDefault();
    isCollapsed = !isCollapsed;
    
    // Add smooth transitions for click toggle with better easing
    navContainer.style.transition = 'height 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    controlsContainers.forEach(container => {
      container.style.transition = 'opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), max-height 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    });
    
    if (isCollapsed) {
      mobileNav.classList.add('collapsed');
      updateNavHeight(1, true); // Fully collapsed and finalized
    } else {
      mobileNav.classList.remove('collapsed');
      updateNavHeight(0, true); // Fully expanded and finalized
    }
    
    // Clean up transitions and prevent jumps
    setTimeout(() => {
      navContainer.style.transition = '';
      controlsContainers.forEach(container => {
        container.style.transition = '';
      });
      
      // Recalculate height to prevent jumps after click animation
      if (!isCollapsed) {
        const currentFullHeight = navContainer.getBoundingClientRect().height;
        navContainer.style.height = `${currentFullHeight}px`;
      } else {
        const currentCollapsedHeight = navContainer.getBoundingClientRect().height;
        navContainer.style.height = `${currentCollapsedHeight}px`;
      }
    }, 400);
  });
}