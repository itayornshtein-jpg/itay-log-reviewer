import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  it('shows upload instructions and output placeholders by default', () => {
    render(<App />);

    expect(screen.getByText(/Drop log files, folders, or .zip archives here/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload a file to see extracted errors and timing details/i)).toBeInTheDocument();
    expect(screen.getByText(/We will summarize the final actions once analysis finishes/i)).toBeInTheDocument();
    expect(screen.getByText(/Actionable next steps will appear here after processing/i)).toBeInTheDocument();
  });

  it('lets users select and list multiple files', async () => {
    const user = userEvent.setup();
    render(<App />);

    const fileInput = screen.getByLabelText(/Or browse to choose files or folders/i);
    const files = [
      new File(['log content'], 'sample.log', { type: 'text/plain' }),
      new File(['more content'], 'second.err', { type: 'text/plain' }),
    ];

    await user.upload(fileInput, files);

    expect(screen.getByText('sample.log')).toBeInTheDocument();
    expect(screen.getByText('second.err')).toBeInTheDocument();
  });

  it('allows removing previously added files', async () => {
    const user = userEvent.setup();
    render(<App />);

    const fileInput = screen.getByLabelText(/Or browse to choose files or folders/i);
    const files = [
      new File(['log content'], 'sample.log', { type: 'text/plain' }),
      new File(['error content'], 'remove.out', { type: 'text/plain' }),
    ];

    await user.upload(fileInput, files);

    await user.click(screen.getAllByText(/Remove/i)[0]);

    expect(screen.queryByText('sample.log')).not.toBeInTheDocument();
    expect(screen.getByText('remove.out')).toBeInTheDocument();
  });

  it('supports dropping a file into the dropzone', () => {
    render(<App />);
    const dropzone = screen.getByText(/Drop log files, folders, or .zip archives here/i).closest('div');
    const file = new File(['error'], 'dropped.out', { type: 'text/plain' });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(screen.getByText('dropped.out')).toBeInTheDocument();
  });
});
