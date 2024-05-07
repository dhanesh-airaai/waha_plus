import { Injectable } from '@nestjs/common';

import { SwaggerConfigServiceCore } from '../../core/config/SwaggerConfigServiceCore';
import { parseBool } from '../../helpers';

@Injectable()
export class SwaggerConfigServicePlus extends SwaggerConfigServiceCore {
  get enabled(): boolean {
    const value = this.configService.get('WHATSAPP_SWAGGER_ENABLED', 'true');
    return parseBool(value);
  }

  get credentials(): [string, string] | undefined {
    const user = this.configService.get('WHATSAPP_SWAGGER_USERNAME', undefined);
    const password = this.configService.get(
      'WHATSAPP_SWAGGER_PASSWORD',
      undefined,
    );
    if (!user || !password) {
      console.log(
        'Please set up both WHATSAPP_SWAGGER_USERNAME and WHATSAPP_SWAGGER_PASSWORD ' +
          'to enable swagger authentication.',
      );
      return undefined;
    }
    return [user, password];
  }
}
