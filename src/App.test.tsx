import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app shell', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('nebulosa')
  expect(screen.getByText(/not affiliated with Synspective/)).toBeInTheDocument()
})
