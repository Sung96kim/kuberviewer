import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { getRouter, getQueryClient } from './router'
import { PollingProvider } from './hooks/use-polling'
import 'xterm/css/xterm.css'
import './styles.css'

const queryClient = getQueryClient()
const router = getRouter(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PollingProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </PollingProvider>
  </StrictMode>,
)
