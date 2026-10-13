import { registerRootComponent } from 'expo'
import { LogBox } from 'react-native'
import App from './App'

// Suppress known React Navigation v7 internal warning about navigate(object) API
// This fires from bottom-tabs internals on startup, not from app code
LogBox.ignoreLogs([
  "Passing an object as the argument to 'navigate' is deprecated",
])

// Also suppress from Metro terminal output
const _consoleWarn = console.warn
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes("Passing an object as the argument to 'navigate'")) {
    return
  }
  _consoleWarn(...args)
}

registerRootComponent(App)
