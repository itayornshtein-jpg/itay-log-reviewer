import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  it('shows upload instructions and output placeholders by default', () => {
    render(<App />);

    expect(screen.getByText(/Drop log files here/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload a file to see extracted errors and timing details/i)).toBeInTheDocument();
    expect(screen.getByText(/We will summarize the final actions once analysis finishes/i)).toBeInTheDocument();
    expect(screen.getByText(/Actionable next steps will appear here after processing/i)).toBeInTheDocument();
  });

  it('updates the chosen file name when a user selects a file', async () => {
    const user = userEvent.setup();
    render(<App />);

    const fileInput = screen.getByLabelText(/Or browse to choose a file/i);
    const file = new File(['log content'], 'sample.log', { type: 'text/plain' });

    await user.upload(fileInput, file);

    expect(screen.getByText('sample.log')).toBeInTheDocument();
  });

  it('supports dropping a file into the dropzone', () => {
    render(<App />);
    const dropzone = screen.getByText(/Drop log files here/i).closest('div');
    const file = new File(['error'], 'dropped.out', { type: 'text/plain' });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(screen.getByText('dropped.out')).toBeInTheDocument();
  });
});
