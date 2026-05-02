import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<SafeUser> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const password = await bcrypt.hash(registerDto.password, this.saltRounds);
    const user = await this.usersService.createUser({
      name: registerDto.name,
      email: registerDto.email,
      password,
    });

    return this.sanitizeUser(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async validateUser(email: string, password: string): Promise<SafeUser> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user?.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: User): SafeUser {
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
