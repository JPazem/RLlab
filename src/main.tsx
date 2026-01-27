import InteractiveRLLab from './InteractiveRLLAb'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

document.documentElement.classList.add("dark");
document.documentElement.style.colorScheme = "dark";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InteractiveRLLab />
  </React.StrictMode>,
)
