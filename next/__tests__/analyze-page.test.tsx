/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import AnalyzePage from '../app/(routes)/analyze/page';
import * as queryClientModule from '../lib/queryClient';

jest.mock('../components/LoadingState', () => ({
  __esModule: true,
  default: ({ isVisible }: { isVisible: boolean }) =>
    isVisible ? <div data-testid="loading-indicator">Loading...</div> : null
}));

jest.mock('../components/ErrorState', () => ({
  __esModule: true,
  default: ({ isVisible, errorMessage, onRetry }: any) =>
    isVisible ? (
      <div data-testid="error-state">
        <p>{errorMessage}</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    ) : null
}));

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient();
  const result = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { queryClient, ...result };
};

describe('AnalyzePage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('submits the URL and renders analysis details when the API succeeds', async () => {
    const mockPayload = {
      analysis: {
        id: 1,
        url: 'https://example.com',
        totalCount: 3,
        seoCount: 1,
        socialCount: 1,
        technicalCount: 1,
        missingCount: 0,
        healthScore: 90,
        timestamp: '2024-01-01T00:00:00.000Z'
      },
      tags: [],
      recommendations: []
    };

    const apiRequestMock = jest
      .spyOn(queryClientModule, 'apiRequest')
      .mockResolvedValue(
        new Response(JSON.stringify(mockPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }) as unknown as Response
      );

    renderWithClient(<AnalyzePage />);

    const input = screen.getByLabelText(/website url/i);
    await userEvent.type(input, 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith('POST', '/api/analyze', { url: 'https://example.com' }));

    expect(await screen.findByText(/audit ready for https:\/\/example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/health score: 90/i)).toBeInTheDocument();
    expect(screen.getByText(/total tags: 3/i)).toBeInTheDocument();
  });

  it('shows an error message when the API rejects the request', async () => {
    const error = new Error('400: Please enter a valid URL');
    const apiRequestMock = jest
      .spyOn(queryClientModule, 'apiRequest')
      .mockRejectedValue(error);

    renderWithClient(<AnalyzePage />);

    const input = screen.getByLabelText(/website url/i);
    await userEvent.type(input, 'invalid-url');
    await userEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());

    expect(await screen.findByTestId('error-state')).toHaveTextContent('400: Please enter a valid URL');
  });
});
