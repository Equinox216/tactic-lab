import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BandidosTacticLab from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BandidosTacticLab />
  </StrictMode>
)
