import winston from 'winston';

const SERVICE_NAME = process.env.SERVICE_NAME ?? 'api-gateway';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.sssZ' }),
    winston.format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [new winston.transports.Console()],
});
