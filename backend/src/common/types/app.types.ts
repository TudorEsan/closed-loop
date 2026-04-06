export type AppConfig = {
  port: number;
  nodeEnv: string;
  apiVersion: string;
  isProduction: boolean;
  isDevelopment: boolean;
  allowedOrigins: string | string[];
};
