/* eslint-disable @typescript-eslint/no-explicit-any */

// Optional dependency — only required at runtime when TelegramAdapter (gramjs) is used
declare module "telegram" {
  export class TelegramClient {
    constructor(session: any, apiId: number, apiHash: string, opts?: any);
    session: { save(): unknown };
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isUserAuthorized(): Promise<boolean>;
    signInUserWithQrCode(apiCreds: any, opts: any): Promise<void>;
    getMe(): Promise<any>;
    sendMessage(peer: any, opts: any): Promise<any>;
    addEventHandler(handler: (event: any) => void, filter: any): void;
  }
}

declare module "telegram/sessions/index.js" {
  export class StringSession {
    constructor(session?: string);
  }
}

declare module "telegram/events/index.js" {
  export class NewMessage {
    constructor(opts?: any);
  }
}

// Optional dependency — only required at runtime when WeChatAdapter is used
declare module "wechaty" {
  export const WechatyBuilder: {
    build(opts?: any): any;
  };
}
