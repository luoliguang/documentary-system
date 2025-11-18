declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    endpoint?: string;
    secure?: boolean;
  }

  interface PutObjectOptions {
    mime?: string;
    headers?: Record<string, string>;
  }

  interface PutObjectResult {
    url: string;
    name: string;
    res: {
      status: number;
      statusCode: number;
      headers: Record<string, string>;
    };
  }

  interface SignatureUrlOptions {
    expires?: number;
    method?: string;
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer | string, options?: PutObjectOptions): Promise<PutObjectResult>;
    signatureUrl(name: string, options?: SignatureUrlOptions): string;
    delete(name: string): Promise<{ res: { status: number } }>;
    head(name: string): Promise<any>;
  }

  export = OSS;
}

