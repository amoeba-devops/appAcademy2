import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AmaSsoUseCase } from '../../application/auth/ama-sso.use-case';
import {
  deriveCodeChallenge,
  generatePkceVerifier,
  generateState,
} from '../../infrastructure/external/ama/auth/ama-pkce.util';
import { AMA_OIDC_SERVICE } from '../../infrastructure/external/ama/auth/interfaces/ama-oidc.interface';
import type { AmaOidcService } from '../../infrastructure/external/ama/auth/interfaces/ama-oidc.interface';
import { AmaOidcStateStore } from './ama-oidc-state.store';

/** Wrap AMA_OIDC_SERVICE injection so the controller signature stays clean. */
@Injectable()
export class AmaOidcServiceRef {
  constructor(@Inject(AMA_OIDC_SERVICE) public readonly service: AmaOidcService) {}
}

/**
 * AMA SSO endpoints.
 *
 *   GET  /api/auth/ama/login     → 302 to AMA authorize URL (PKCE/state 발급)
 *   GET  /api/auth/ama/callback  → code 교환 → JWT 발급 → frontend 로 redirect
 *   POST /api/auth/ama/logout    → 세션 무효화 (JWT 는 stateless 라 클라이언트가 폐기)
 *
 * Phase 1 에서는 frontend redirect 시 access token 을 query 로 전달한다 (cookie 는 도메인 분리 후 도입).
 */
@ApiTags('Auth (AMA)')
@Controller('auth/ama')
export class AmaAuthController {
  constructor(
    private readonly sso: AmaSsoUseCase,
    private readonly stateStore: AmaOidcStateStore,
    private readonly config: ConfigService,
    private readonly oidcRef: AmaOidcServiceRef,
  ) {}

  @Get('login')
  @ApiOperation({ summary: 'AMA OIDC authorize 로 redirect' })
  @ApiQuery({ name: 'returnTo', required: false })
  login(
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ): void {
    const state = generateState();
    const verifier = generatePkceVerifier();
    const challenge = deriveCodeChallenge(verifier);
    const redirectUri = this.callbackUrl();
    this.stateStore.put(state, { codeVerifier: verifier, returnTo });
    const url = this.oidcRef.service.buildAuthorizeUrl({
      state,
      codeChallenge: challenge,
      redirectUri,
    });
    res.redirect(302, url);
  }

  @Get('callback')
  @ApiOperation({ summary: 'AMA OIDC callback (code → JWT)' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const entry = this.stateStore.consume(state);
    if (!entry) {
      res.status(400).json({ error: { code: 'INVALID_STATE', message: 'state expired or unknown' } });
      return;
    }
    const result = await this.sso.exchangeCodeAndIssueSession({
      code,
      codeVerifier: entry.codeVerifier,
      redirectUri: this.callbackUrl(),
    });
    const frontend = String(this.config.get('FRONTEND_URL', 'http://localhost:3009')).replace(/\/$/, '');
    const target = new URL(`${frontend}/admin/auth/ama/callback`);
    target.searchParams.set('token', result.accessToken);
    target.searchParams.set('next', result.nextStep);
    if (result.activeAcademyId != null) {
      target.searchParams.set('acdId', String(result.activeAcademyId));
    }
    if (entry.returnTo) {
      target.searchParams.set('returnTo', entry.returnTo);
    }
    res.redirect(302, target.toString());
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Logout (JWT 폐기는 클라이언트 책임)' })
  @ApiResponse({ status: 204 })
  logout(@Req() _req: Request): void {
    // stateless JWT — server-side blacklist 는 Phase 2.
    return;
  }

  private callbackUrl(): string {
    const explicit = this.config.get<string>('AMA_OIDC_REDIRECT_URI');
    if (explicit) return explicit;
    const backend = String(this.config.get('BACKEND_URL', 'http://localhost:4009')).replace(/\/$/, '');
    return `${backend}/api/auth/ama/callback`;
  }
}
