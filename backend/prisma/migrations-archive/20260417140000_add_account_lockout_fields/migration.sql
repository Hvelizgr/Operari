-- Persistent account-lockout state on User. The rate limiter in
-- middleware handles burst attacks (5/min per email + IP); these
-- columns catch the slow patient attacker whose attempts would
-- otherwise stay under the ratelimit window but still accumulate
-- over hours or days.
--
-- `failedLoginAttempts` — rolling count inside the lockout window.
-- `lastFailedLoginAt`   — window anchor, used to decide if the
--                         counter should reset before incrementing.
-- `lockedUntil`         — non-null when the account is currently
--                         locked; the login handler fails fast if
--                         this is in the future.

ALTER TABLE "User"
    ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastFailedLoginAt"   TIMESTAMP(3),
    ADD COLUMN "lockedUntil"         TIMESTAMP(3);
