import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

import {
  BinaryFile,
  RemoteFile,
  VideoBinaryFile,
  VideoRemoteFile,
  VoiceBinaryFile,
  VoiceRemoteFile,
} from './files.dto';

export const BROADCAST_ID = 'status@broadcast';

export class StatusRequest {
  @ApiProperty({
    description: 'Contact list to send the status to.',
    example: ['55xxxxxxxxxxx@c.us'],
  })
  contacts = ['55xxxxxxxxxxx@c.us'];
}

export class TextStatus extends StatusRequest {
  text: string = 'Have a look! https://github.com/';
  backgroundColor: string = '#38b42f';
  font: number = 1;
}

@ApiExtraModels(RemoteFile, BinaryFile)
export class ImageStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(RemoteFile) },
      { $ref: getSchemaPath(BinaryFile) },
    ],
  })
  file: RemoteFile | BinaryFile;

  caption?: string;
}

@ApiExtraModels(VoiceRemoteFile, VoiceBinaryFile)
export class VoiceStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(VoiceRemoteFile) },
      { $ref: getSchemaPath(VoiceBinaryFile) },
    ],
  })
  file: VoiceRemoteFile | VoiceBinaryFile;

  backgroundColor: string = '#38b42f';
}

@ApiExtraModels(VideoRemoteFile, VideoBinaryFile)
export class VideoStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(VideoRemoteFile) },
      { $ref: getSchemaPath(VideoBinaryFile) },
    ],
  })
  file: VideoRemoteFile | VideoBinaryFile;

  caption?: string;
}

export class DeleteStatusRequest extends StatusRequest {
  @ApiProperty({
    description: 'status message id',
    example: 'AAAAAAAAAAAAAAAAA',
  })
  id: string;
}
