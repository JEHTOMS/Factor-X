# Factor X - Interactive Text Distortion

An interactive web application that creates dynamic text distortion effects using SVG paths and real-time audio/mouse input.

## Features

### 🎨 **Three Distortion Patterns**
- **Bar**: Top-aligned distortion with left-to-right emphasis
- **Wave**: Center-aligned distortion with middle emphasis  
- **Arc**: Bottom-aligned distortion with edge emphasis

### 🎵 **Audio-Reactive Mode**
- Real-time microphone input analysis
- Voice-responsive text distortion
- Adjustable sensitivity (1-5 levels)
- Frequency-based height modulation

### 🖱️ **Touch/Mouse Mode** 
- Interactive mouse-based distortion
- Horizontal position affects letter selection
- Vertical position controls distortion intensity
- Real-time response to cursor movement

### 📱 **Responsive Design**
- Scales automatically for screens >1440px
- Font size increases 20% per 400px width
- Maximum 2.5x scaling (500px font size)
- Dynamic window resize support

### ⚡ **Performance Features**
- Smooth 60fps animations
- Efficient SVG rendering
- Clean mode switching
- Minimal height protection

## How to Use

1. **Enter Text**: Type any text in the input field
2. **Choose Mode**: 
   - **Touch**: Move your mouse over the text for interactive distortion
   - **Sound**: Allow microphone access for voice-reactive effects
3. **Select Pattern**: Choose Bar, Wave, or Arc distortion style
4. **Adjust Sensitivity**: Use the slider to control responsiveness (Sound mode only)

## Technical Details

- **Font**: Custom Ausano-Bold.otf with OpenType.js rendering
- **Audio**: Web Audio API with real-time frequency analysis
- **Graphics**: SVG path generation with precise baseline alignment
- **Responsive**: CSS flexbox with JavaScript viewport scaling
- **Browser Support**: Modern browsers with Web Audio API support

## Local Development

```bash
# Start a local server
python3 -m http.server 8000

# Open in browser
http://localhost:8000/index.html
```

## Browser Permissions

- **Microphone Access**: Required for Sound mode functionality
- **HTTPS**: Recommended for full audio features in production

## Project Structure

```
Source/
├── index.html          # Main HTML structure
├── main.js            # Core JavaScript functionality  
├── styles.css         # CSS styles and responsive design
└── ../Assets/
    └── Ausano-Bold.otf # Custom font file
```

---

Created with ❤️ for interactive typography and audio-visual experiences.
