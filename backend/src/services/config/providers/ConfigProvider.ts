export interface ConfigProvider {
  readonly type: string;
  supportsKey(key: string): boolean;
  getDefaultValue(key: string): any | undefined;
  validate?(key: string, value: any): Promise<void> | void;
  normalize?(key: string, value: any): any;
}

export type ConfigScope =
  | 'general'
  | 'order_options'
  | 'permissions'
  | 'assignment_rules';

export interface ConfigProviderDescriptor {
  scope: ConfigScope;
  provider: ConfigProvider;
}

