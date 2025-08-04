// --- Font loading with opentype.js for div-based text distortion ---

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
  // Find the current slider value by checking active bits
  const activeBits = document.querySelectorAll('.range-bits.active');
  const sensitivity = activeBits.length; // 1-5 scale
  return sensitivity === 0 ? 1 : sensitivity; // Minimum sensitivity of 1
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
  let fontSize = 200; // Base font size
  
  if (screenWidth > 1440) {
    // Scale font size for larger screens
    // Increase by 20% for every 400px above 1440px
    const extraWidth = screenWidth - 1440;
    const scaleFactor = 1 + (extraWidth / 400) * 0.2;
    fontSize = Math.round(200 * Math.min(scaleFactor, 2.5)); // Cap at 2.5x (500px)
  }
  
  return fontSize;
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired - Setting up div-based text distortion');
  
  // Use the locally provided ausano-bold.otf font file
  const fontUrl = '../Assets/Ausano-Bold.otf';

  opentype.load(fontUrl, function(err, font) {
    if (err) {
      console.error('Font could not be loaded:', err);
      return;
    }
    
    console.log('Font loaded successfully:', font.familyName);
    loadedFont = font;
    
    // Set up input listener
    const nameInput = document.getElementById('name-input');
    if (nameInput) {
      nameInput.addEventListener('input', updateTextDistortion);
      // Initial render if there's already text
      if (nameInput.value) {
        updateTextDistortion();
      }
    }
    
    // Initialize mouse tracking
    setupMouseTracking();
    
    // Check if touch mode is active by default and start mouse tracking
    const touchButton = document.getElementById('touch') || document.getElementById('torch');
    if (touchButton && touchButton.classList.contains('active')) {
      isMouseTracking = true;
    }
  });
  
  // Add window resize listener for responsive font scaling
  window.addEventListener('resize', () => {
    if (loadedFont) {
      updateTextDistortion(); // Regenerate text with new responsive font size
    }
  });
});

// Function to update text distortion based on input
function updateTextDistortion() {
  if (!loadedFont) return;
  
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  
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
  
  // Convert text to SVG paths and distribute across divs
  const fontSize = getResponsiveFontSize(); // Responsive font size based on screen width
  
  for (let i = 0; i < Math.min(text.length, distortionEffects.length); i++) {
    const char = text[i];
    const div = distortionEffects[i];
    
    if (char === ' ') {
      // Handle spaces - create a thin div with no content
      div.style.height = `${fontSize}px`;
      div.style.width = '24px';
      div.style.flex = '0 0 24px';
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

    // Set div to padded character width
    div.style.width = `${paddedWidth}px`;
    div.style.flex = `0 0 ${paddedWidth}px`;

    // Set up SVG with proper top alignment - adjust viewBox to position text at top
    svg.setAttribute('viewBox', `0 -${fontSize * 0.71} ${paddedWidth} ${fontSize}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.display = 'block';

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
  const barButton = document.getElementById('bar');
  const soundButton = document.getElementById('sound');
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
  const touchButton = document.getElementById('touch');
  if (touchButton && touchButton.classList.contains('active')) {
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
  const activeButton = document.querySelector('#distorts .ctrls-btn.active');
  if (!activeButton) return;
  
  const distortionType = activeButton.id;
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
  
  resultContainer.addEventListener('mousemove', (e) => {
    // Don't track mouse if sound mode is active
    const soundButton = document.getElementById('sound');
    if (soundButton && soundButton.classList.contains('active')) {
      return;
    }
    
    const rect = resultContainer.getBoundingClientRect();
    // Normalize mouse position to 0-1 range
    mouseX = (e.clientX - rect.left) / rect.width;
    mouseY = (e.clientY - rect.top) / rect.height;
    
    // Clamp values between 0 and 1
    mouseX = Math.max(0, Math.min(1, mouseX));
    mouseY = Math.max(0, Math.min(1, mouseY));
  });
  
  resultContainer.addEventListener('mouseenter', () => {
    // Don't activate mouse tracking if sound mode is active
    const soundButton = document.getElementById('sound');
    if (soundButton && soundButton.classList.contains('active')) {
      return;
    }
    
    isMouseTracking = true;
    startMouseDistortion();
  });
  
  resultContainer.addEventListener('mouseleave', () => {
    isMouseTracking = false;
    stopMouseDistortion();
    resetToDefaultHeight();
  });
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
  const activeButton = document.querySelector('#distorts .ctrls-btn.active');
  if (!activeButton) return;
  
  const distortionType = activeButton.id;
  
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  }
}

// Handle distortion type controls
document.querySelectorAll('#distorts .ctrls-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#distorts .ctrls-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    
    // Stop audio analysis when switching effects
    stopAudioAnalysis();
    
    // Reset to default height and set proper alignment classes
    resetToDefaultHeight();
    
    // Only start audio analysis if sound mode is active and audio is enabled
    const soundButton = document.getElementById('sound');
    if (soundButton && soundButton.classList.contains('active') && isAudioEnabled) {
      startAudioAnalysis();
    }
  });
});

// Handle sound/touch controls
document.querySelectorAll('#ctrls .ctrls-btn').forEach(btn => {
  btn.addEventListener('click', async function() {
    document.querySelectorAll('#ctrls .ctrls-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    
    if (this.id === 'sound') {
      // Enable audio-reactive mode
      stopMouseDistortion(); // Stop mouse tracking first
      isMouseTracking = false;
      
      // Reset to default height to clear any mouse effects
      resetToDefaultHeight();
      
      if (!isAudioEnabled) {
        await setupAudio();
      }
      if (isAudioEnabled) {
        startAudioAnalysis();
      }
    } else if (this.id === 'touch') {
      // Enable mouse-reactive mode
      stopAudioAnalysis(); // Stop audio analysis first
      isMouseTracking = true;
      
      // Reset to default height to clear any audio effects
      resetToDefaultHeight();
      
      // Check if mouse is over the result container
      const resultContainer = document.querySelector('.result-container');
      if (resultContainer) {
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
    }
  });
});

// Function to reset all divs to default height
function resetToDefaultHeight() {
  const distortionEffects = document.querySelectorAll('.distortion-effect');
  const distortionPath = document.querySelector('.distortion-path');
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
  
  // Set appropriate alignment class but keep default heights
  distortionPath.classList.remove('wave-alignment', 'arc-alignment', 'bar-alignment');
  const activeDistortion = document.querySelector('#distorts .ctrls-btn.active');
  if (activeDistortion) {
    if (activeDistortion.id === 'wave') {
      distortionPath.classList.add('wave-alignment');
    } else if (activeDistortion.id === 'arc') {
      distortionPath.classList.add('arc-alignment');
    } else {
      distortionPath.classList.add('bar-alignment');
    }
  }
  
  distortionEffects.forEach((div, i) => {
    // Remove effect classes
    div.classList.remove('wave-effect', 'arc-effect');
    
    if (i < text.length && div.innerHTML) {
      const fontSize = getResponsiveFontSize();
      div.style.height = `${fontSize}px`; // Use responsive font size
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  const nameInput = document.getElementById('name-input');
  const text = nameInput.value.toUpperCase();
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
  const input = document.getElementById('name-input');
  const clearBtn = document.getElementById('clearbtn');

  // Hide clear button initially
  clearBtn.style.display = 'none';

  // Show/hide clear button on input
  input.addEventListener('input', function() {
    clearBtn.style.display = input.value.length > 0 ? 'flex' : 'none';
  });

  // Clear input and hide button on click
  clearBtn.addEventListener('click', function() {
    input.value = '';
    clearBtn.style.display = 'none';
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

// Slider functionality for custom range input
// This script allows users to drag a thumb along a slider to select a value
// and visually fills the slider based on the selected value.
// It also allows clicking on specific bits to set the value directly.
// The slider has 5 bits, each representing a value from 1 to 5.
// The thumb can be dragged or clicked to change the value, and the fill adjusts accordingly.
// The slider is styled to look like a custom range input with a thumb and fill.
// The bits are highlighted based on the current value, and the thumb's position is updated accordingly
document.addEventListener('DOMContentLoaded', function() {
  const slider = document.getElementById('custom-slider');
  const thumb = document.getElementById('slider-thumb');
  const fill = slider.querySelector('.range-fill');
  const bits = document.querySelectorAll('.range-bits');
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
  document.addEventListener('mouseup', () => {
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

  // Initialize
  setThumbPosition(value);
});