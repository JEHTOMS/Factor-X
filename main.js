// This script handles the button click events for the controls section
// It adds an 'active' class to the clicked button and removes it from others
document.querySelectorAll('#ctrls .ctrls-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#ctrls .ctrls-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});
// This script handles the button click events for the distortions section
// It adds an 'active' class to the clicked button and removes it from others
// It is similar to the previous script but targets a different section
// The buttons are used to control different distortion effects in the application
document.querySelectorAll('#distorts .ctrls-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#distorts .ctrls-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

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