import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'



// Detect Android devices to apply exclusive layout density scaling
if (typeof window !== 'undefined' && /Android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('android-device')
}

// Bypass SecurityError: Failed to read 'cssRules' property on cross-origin stylesheets (e.g. Google Fonts)
// This is a known issue in html-to-image/dom-to-image libraries that causes sharing/exporting to crash.
try {
  const originalDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules')
  if (originalDescriptor) {
    Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', {
      get() {
        try {
          return originalDescriptor.get ? originalDescriptor.get.call(this) : []
        } catch (e) {
          return []
        }
      },
      configurable: true
    })
  }

  const originalRulesDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'rules')
  if (originalRulesDescriptor) {
    Object.defineProperty(CSSStyleSheet.prototype, 'rules', {
      get() {
        try {
          return originalRulesDescriptor.get ? originalRulesDescriptor.get.call(this) : []
        } catch (e) {
          return []
        }
      },
      configurable: true
    })
  }
} catch (e) {
  console.warn('Failed to apply CSSRules fallback shield:', e)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
