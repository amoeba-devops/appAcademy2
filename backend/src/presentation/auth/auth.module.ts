import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { ParentEntity } from '../../infrastructure/database/entities/parent.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ParentAuthController } from './parent-auth.controller';
import { ParentAuthService } from './parent-auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'tac-dev-secret-change-in-production'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '8h'),
        },
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, ParentEntity]),
  ],
  controllers: [AuthController, ParentAuthController],
  providers: [AuthService, ParentAuthService, JwtStrategy],
  exports: [AuthService, ParentAuthService, JwtModule, PassportModule],
})
export class AuthModule {}
