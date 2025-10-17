import { TmpDir } from '@waha/utils/tmpdir';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from 'pino';
import { IMediaConverter } from '@waha/core/media/IConverter';

function IsMP3(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) return false;

  // ID3 header: 0x49 0x44 0x33 = 'I', 'D', '3'
  const b0 = buffer[0]; // 0x49
  const b1 = buffer[1]; // 0x44
  const b2 = buffer[2]; // 0x33

  const isID3 = b0 === 0x49 && b1 === 0x44 && b2 === 0x33;

  // MPEG frame sync (frame starts with 0xFF Ex, e.g. FB, F3, F2)
  const isMPEGFrame = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;

  return isID3 || isMPEGFrame;
}

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

class Ffmpeg implements IMediaConverter {
  private WhatsAppVoice = new FfmpegCommandBuilder(
    'ffmpeg -hide_banner -loglevel error -nostdin -i input.wav -c:a libopus -b:a 32k -ar 48000 -ac 1 output.opus',
    'input.wav',
    'output.opus',
  );

  private MP3toWAV = new FfmpegCommandBuilder(
    'ffmpeg -hide_banner -loglevel error -nostdin -y -i input.mp3 -vn -sn -dn -map 0:a:0 -map_metadata -1 -ac 1 -ar 48000 -c:a pcm_s16le output.wav',
    'input.mp3',
    'output.wav',
  );

  private WhatsAppVideo = new FfmpegCommandBuilder(
    'ffmpeg -hide_banner -loglevel error -nostdin -i input.mp4 -c:v libx264 -map 0 -movflags +faststart output.mp4',
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
    if (IsMP3(content)) {
      // mp3 to wav to clean up the metadata
      // https://github.com/devlikeapro/waha/issues/1393
      content = await this.process(this.MP3toWAV, content);
    }
    // whatever to opus
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
