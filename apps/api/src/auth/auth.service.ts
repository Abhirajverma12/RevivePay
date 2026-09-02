import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'revivepay_development_secret_key_12345';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a new merchant and generate JWT
   */
  async signup(dto: SignupDto) {
    if (!dto.name || !dto.email || !dto.password) {
      throw new BadRequestException('Name, email, and password are required');
    }

    const email = dto.email.toLowerCase().trim();

    // Check existing
    const existing = await this.prisma.merchant.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException(`Merchant with email "${email}" already exists`);
    }

    // Hash password
    const password_hash = await bcrypt.hash(dto.password, 10);

    // Create Merchant with default policy
    const merchant = await this.prisma.merchant.create({
      data: {
        name: dto.name.trim(),
        email,
        password_hash,
        policy: {
          create: {
            max_retries: 3,
            max_discount_pct: 15.0,
            high_value_approval_threshold: 50000.0,
          },
        },
      },
      include: {
        policy: true,
      },
    });

    const token = this.generateToken(merchant.id, merchant.email);

    return {
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        policy: merchant.policy,
      },
    };
  }

  /**
   * Log in an existing merchant
   */
  async login(dto: LoginDto) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password are required');
    }

    const email = dto.email.toLowerCase().trim();

    const merchant = await this.prisma.merchant.findUnique({
      where: { email },
      include: { policy: true },
    });

    if (!merchant) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check password
    let passwordValid = false;

    if (merchant.password_hash) {
      passwordValid = await bcrypt.compare(dto.password, merchant.password_hash);
    } else {
      // For pre-seeded demo merchants without initial password_hash, allow standard password or update it
      passwordValid = dto.password === 'password123' || dto.password.length >= 4;
      if (passwordValid) {
        // Save hash for subsequent logins
        const newHash = await bcrypt.hash(dto.password, 10);
        await this.prisma.merchant.update({
          where: { id: merchant.id },
          data: { password_hash: newHash },
        });
      }
    }

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.generateToken(merchant.id, merchant.email);

    return {
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        policy: merchant.policy,
      },
    };
  }

  /**
   * Get current authenticated merchant from Bearer token
   */
  async getProfileFromToken(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: decoded.sub },
        include: { policy: true },
      });

      if (!merchant) {
        throw new UnauthorizedException('Merchant account no longer exists');
      }

      return {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        policy: merchant.policy,
      };
    } catch {
      throw new UnauthorizedException('Token is expired or invalid');
    }
  }

  /**
   * Sign JWT
   */
  private generateToken(merchantId: string, email: string): string {
    return jwt.sign(
      {
        sub: merchantId,
        email,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
  }
}
