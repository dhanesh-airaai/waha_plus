import { PHONENUMBER_MCC } from '@adiwajshing/baileys';
import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumber } from 'libphonenumber-js';
import { sleep } from 'venom-bot/dist/utils/sleep';

import { WAHAInternalEvent } from '../core/abc/session.abc';
import { NotImplementedByEngineError } from '../core/exceptions';
import { QR } from '../core/QR';
import { WAHAEngine } from '../structures/enums.dto';
import { WhatsappSessionNoWebPlus } from './session.noweb.plus';

export class WhatsappSessionMobilePlus extends WhatsappSessionNoWebPlus {
  engine = WAHAEngine.MOBILE;

  get listenConnectionEventsFromTheStart() {
    return this.sock?.authState?.creds?.registered;
  }

  getSocketConfig(agent, state) {
    const config = super.getSocketConfig(agent, state);
    config.mobile = true;
    config.browser = undefined;
    return config;
  }

  public getQR(): QR {
    throw new NotImplementedByEngineError(
      "Use 'request-code' and 'authorize-code' flow instead.",
    );
  }

  public async requestCode(phoneNumber: string, method: string, params?: any) {
    if (this.sock.authState.creds.registered) {
      const msg =
        'The session has already been registered. ' +
        'Stop and logout the session to register again.';
      throw new BadRequestException(msg);
    }

    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    const phone = parsePhoneNumber(phoneNumber);
    let registration = this.sock.authState.creds?.registration || {};
    const currentPhoneNumber = registration.phoneNumber;
    if (currentPhoneNumber && currentPhoneNumber !== phone.format('E.164')) {
      const msg = `The session has already been registered with a different phone number. Stop and logout the session to register again. Current phone number: ${currentPhoneNumber}`;
      throw new BadRequestException(msg);
    }

    const mcc = PHONENUMBER_MCC[phone.countryCallingCode];
    if (!mcc) {
      const msg = `Could not find MCC for phone number: ${phone.format(
        'E.164',
      )}Please specify the MCC manually.`;
      throw new BadRequestException(msg);
    }

    registration = {
      ...registration,
      phoneNumber: phone.format('E.164'),
      phoneNumberCountryCode: phone.countryCallingCode,
      phoneNumberNationalNumber: phone.nationalNumber,
      phoneNumberMobileCountryCode: mcc,
      method: method,
      localeLanguage: params.localeLanguage,
      localeCountry: params.localeCountry,
    };

    this.log.log(
      `Requesting code with options... ${JSON.stringify(registration)}`,
    );
    try {
      return await this.sock.requestRegistrationCode(registration);
    } catch (error) {
      if (error?.reason === 'code_checkpoint') {
        this.log.log('Captcha code required');
        throw new BadRequestException('Captcha code required.');
      }
      throw error;
    }
  }

  public async authorizeCode(code: string) {
    code = code.replace(/["']/g, '').trim().toLowerCase();
    const registration = this.sock.authState.creds?.registration;
    this.log.log(
      `Authorizing with code '${code}' and options... ${JSON.stringify(
        registration,
      )}`,
    );

    try {
      const response = await this.sock.register(code);
      this.log.log('Successfully authorized');
      this.log.log('Restarting the session...');
      this.restart();
      return response;
    } catch (error) {
      if (error?.reason === 'code_checkpoint') {
        this.log.log('Captcha code required');
        throw new BadRequestException('Captcha code required.');
      }
      throw error;
    }
  }

  private async restart() {
    this.log.log('Stopping the session...');
    this.stop();
    await sleep(2000);
    this.log.log('Starting the session...');
    this.start();
  }

  public async getCaptcha(): Promise<QR> {
    const registration = this.sock.authState.creds?.registration;
    if (!registration.phoneNumber) {
      throw new BadRequestException('No registration found');
    }
    this.log.log(`Requesting captcha code... ${JSON.stringify(registration)}`);
    const response = await this.sock.requestRegistrationCode({
      ...registration,
      method: 'captcha',
    });
    const image = new QR();
    image.save(response.image_blob, '');
    return image;
  }

  public saveCaptcha(code: string) {
    const registration = this.sock.authState.creds?.registration;
    if (!registration) {
      throw new BadRequestException('No registration found');
    }
    registration.captcha = code.replace(/["']/g, '').trim().toLowerCase();
  }
}
