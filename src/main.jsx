import {createRoot} from 'react-dom/client'
import AuthGate from './AuthGate.jsx'
import './styles.css'
createRoot(document.getElementById('root')).render(<AuthGate/>)
if('serviceWorker' in navigator&&import.meta.env.PROD)navigator.serviceWorker.register('./sw.js')
