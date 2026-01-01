import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { getFilesFromDataTransfer } from './App';

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

  it('supports dropping a file into the dropzone', async () => {
    render(<App />);
    const dropzone = screen.getByText(/Drop log files, folders, or .zip archives here/i).closest('div');
    const file = new File(['error'], 'dropped.out', { type: 'text/plain' });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => expect(screen.getByText('dropped.out')).toBeInTheDocument());
  });

  it('expands directories from a dropped folder and keeps relative paths', async () => {
    const nestedFile = new File(['nested'], 'nested.log', { type: 'text/plain' });
    const fileEntry = {
      isFile: true,
      isDirectory: false,
      file: (callback) => callback(nestedFile),
    };

    const directoryEntry = {
      isFile: false,
      isDirectory: true,
      name: 'logs',
      createReader: () => {
        let called = false;
        return {
          readEntries: (callback) => {
            if (called) {
              callback([]);
            } else {
              called = true;
              callback([fileEntry]);
            }
          },
        };
      },
    };

    const dataTransfer = {
      items: [
        {
          webkitGetAsEntry: () => directoryEntry,
        },
      ],
      files: [],
    };

    const files = await getFilesFromDataTransfer(dataTransfer);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('nested.log');
    expect(files[0].webkitRelativePath).toBe('logs/nested.log');
  });
});
