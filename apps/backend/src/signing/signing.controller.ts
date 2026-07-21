import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { SigningService } from './signing.service';

/**
 * Director signing endpoints.
 *
 * Split into prepare/commit because the director signs bytes and the server must know exactly
 * which bytes it handed out — see SigningService. Role and status are enforced in the service via
 * the shared workflow rules, so a direct call cannot bypass the UI.
 */
@UseGuards(JwtAuthGuard)
@Controller('cases/:id/sign')
export class SigningController {
  constructor(private readonly signing: SigningService) {}

  @Post('prepare')
  prepare(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.signing.prepare(id, user);
  }

  @Post('commit')
  commit(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { challengeId: string; pkcs7: string; signerInfo?: unknown },
  ) {
    return this.signing.commit(id, user, body);
  }

  /** The browser reporting that E-IMZO refused. Records the attempt; changes nothing on the case. */
  @Post('error')
  fail(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { challengeId?: string | null; stage?: string; error?: string },
  ) {
    return this.signing.fail(id, user, body);
  }
}
