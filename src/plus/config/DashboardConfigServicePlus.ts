import { Injectable } from '@nestjs/common';

import { DashboardConfigServiceCore } from '../../core/config/DashboardConfigServiceCore';

@Injectable()
export class DashboardConfigServicePlus extends DashboardConfigServiceCore {
  get credentials(): [string, string] | null {
    const user = this.configService.get('WAHA_DASHBOARD_USERNAME', 'waha');
    const password = this.configService.get('WAHA_DASHBOARD_PASSWORD', 'waha');
    if (!user || !password) {
      this.logger.info(
        'Please set up both WAHA_DASHBOARD_USERNAME and WAHA_DASHBOARD_PASSWORD ' +
          'to enable swagger authentication.',
      );
      return null;
    }
    return [user, password];
  }
}
