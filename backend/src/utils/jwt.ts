import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JwtPayload } from '../types/index.js';

export const generateToken = (payload: JwtPayload): string => {
  const secret: Secret = config.jwtSecret;
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, secret, options);
};

export const verifyToken = (token: string): JwtPayload => {
  const secret: Secret = config.jwtSecret;
  return jwt.verify(token, secret) as JwtPayload;
};

