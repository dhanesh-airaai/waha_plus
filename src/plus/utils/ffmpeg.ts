import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from 'pino';

import { TmpDir } from './tmpdir';

class FfmpegCommandBuilder {
  private readonly parts: string[] = [];
  private readonly inputIndex: number;
  private readonly outputIndex: number;

  constructor(
    command: string,
    public input: string,
    public output: string,
  ) {
    const parts = command.split(' ');
    if (parts[0] != 'ffmpeg') {
      throw new Error('Invalid command, must start with ffmpeg');
    }
    this.parts = parts.slice(1);
    this.inputIndex = this.parts.indexOf(input);
    if (this.inputIndex < 0) {
      throw new Error(
        `Invalid command "${command}", must contain input "${input}"`,
      );
    }
    this.outputIndex = this.parts.indexOf(output);
    if (this.outputIndex < 0) {
      throw new Error(
        `Invalid command "${command}", must contain output "${output}"`,
      );
    }
  }

  args(input: string, output: string): string[] {
    const args = this.parts.slice();
    args[this.inputIndex] = input;
    args[this.outputIndex] = output;
    return args;
  }
}

class Ffmpeg {
  private WhatsAppVoice = new FfmpegCommandBuilder(
    'ffmpeg -i input.mp3 -c:a libopus -b:a 32k -ar 48000 -ac 1 output.opus',
    'input.mp3',
    'output.opus',
  );

  private WhatsAppVideo = new FfmpegCommandBuilder(
    'ffmpeg -i input.mp4 -c:v libx264 -map 0 -movflags +faststart output.mp4',
    'input.mp4',
    'output.mp4',
  );

  private readonly tmpdir: TmpDir;

  constructor(
    session: string,
    private logger: Logger,
  ) {
    this.tmpdir = new TmpDir(logger, `waha-ffmpeg-${session}-`);
  }

  protected spawn(args: string[]): Promise<void> {
    this.logger.debug(`Executing command: 'ffmpeg ${args.join(' ')}'...`);
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      ffmpeg.stderr.on('data', (data) => {
        // ffmpeg outputs progress information to stderr
        this.logger.debug(`ffmpeg: ${data}`);
      });

      ffmpeg.on('close', (code) => {
        this.logger.debug(`ffmpeg exited with code ${code}`);
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `ffmpeg process exited with code ${code}. Check logs to find the reason`,
            ),
          );
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`Failed to start ffmpeg process: ${err.message}`));
      });
    });
  }

  protected command(
    cmd: FfmpegCommandBuilder,
    input: string,
    output: string,
  ): Promise<void> {
    const args = cmd.args(input, output);
    return this.spawn(args);
  }

  protected async process(
    cmd: FfmpegCommandBuilder,
    content: Buffer,
  ): Promise<Buffer> {
    return await this.tmpdir.use(async (dir) => {
      const inputFile = path.join(dir, cmd.input);
      const outputFile = path.join(dir, cmd.output);
      await fs.writeFile(inputFile, content);
      await this.command(cmd, inputFile, outputFile);
      return await fs.readFile(outputFile);
    });
  }

  /**
   * Process audio content to make it compatible with WhatsApp
   * @param content Audio buffer to process
   * @returns Processed audio buffer or original buffer if processing fails
   */
  public async voice(content: Buffer): Promise<Buffer> {
    return this.process(this.WhatsAppVoice, content);
  }

  /**
   * Process video content to make it compatible with WhatsApp
   * @param content Video buffer to process
   * @returns Processed video buffer or original buffer if processing fails
   */
  public async video(content: Buffer): Promise<Buffer> {
    return this.process(this.WhatsAppVideo, content);
  }
}

export { Ffmpeg, FfmpegCommandBuilder };
