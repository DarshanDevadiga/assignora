import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Prevent unhandled promise rejections when browser audio playback is interrupted
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const isAudioAbort =
      event.reason?.name === 'AbortError' ||
      event.reason?.message?.includes?.('The play() request was interrupted by a call to pause()') ||
      event.reason?.message?.includes?.('interrupted by a call to pause')
    if (isAudioAbort) {
      event.preventDefault() // Safely prevent browser console noise/crashes
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
